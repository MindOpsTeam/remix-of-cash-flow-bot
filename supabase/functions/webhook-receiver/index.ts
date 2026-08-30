/**
 * Receptor de webhook de entrada, por webhook cadastrado.
 *
 * POST /webhook-receiver/{webhookId}   header: x-webhook-token: <segredo>
 *
 * Hardening 29/08/2026:
 * - O token era aceito também por `?token=` na URL. Query string entra em log de
 *   proxy, em histórico e no Referer — um segredo que anda na URL vaza sozinho.
 *   Agora só header.
 * - A comparação era `token !== webhook.secret_token`, que sai no primeiro byte
 *   diferente. Num endpoint aberto isso é medível e troca adivinhar o token
 *   inteiro por adivinhar um byte de cada vez.
 * - "Webhook not found" (404) e "Invalid token" (401) diziam ao chamador quais
 *   ids existem. As duas respostas viraram a mesma.
 * - Sem teto de requisição e sem teto de corpo: agora 60/min por webhook e
 *   corpo de no máximo 256 KB.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";
import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";
import { checarLimite, corpoLimitado, origemDaChamada, segredosBatem } from "../_shared/limite.ts";

const EXTRA_HEADERS = "x-webhook-token";
const TETO_POR_MINUTO = 60;
const JANELA_SEGUNDOS = 60;
const MAX_CORPO_BYTES = 256 * 1024;

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req, EXTRA_HEADERS);
  const preflight = corsPreflightResponse(req, EXTRA_HEADERS);
  if (preflight) return preflight;

  const responder = (body: unknown, status: number, extra: Record<string, string> = {}) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, ...extra, "Content-Type": "application/json" },
    });

  /**
   * Resposta única para id inexistente, webhook desligado e token errado.
   *
   * Antes, um 404 confirmava "este id não existe" e um 401 confirmava "este id
   * existe, erraste o segredo". Quem varre ids ganhava metade do trabalho de
   * graça.
   */
  const recusar = () => responder({ error: "Webhook inválido" }, 401);

  try {
    const url = new URL(req.url);
    // Extract webhook ID from path: /webhook-receiver/{webhookId}
    const pathParts = url.pathname.split("/").filter(Boolean);
    const webhookId = pathParts[pathParts.length - 1];

    if (!webhookId || webhookId === "webhook-receiver") {
      return responder({ error: "Webhook ID required" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Conta antes de consultar o banco: o balde tem que segurar quem varre id,
    // e quem varre id nunca chega na parte cara.
    const teto = await checarLimite(
      supabase,
      `webhook-receiver:${webhookId}:${origemDaChamada(req)}`,
      TETO_POR_MINUTO,
      JANELA_SEGUNDOS,
    );
    if (teto.excedeu) return teto.resposta(corsHeaders);

    // Um id que não é UUID nunca vai casar; morre aqui sem tocar no banco.
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(webhookId)) {
      return recusar();
    }

    // Find webhook config
    const { data: webhook, error: whError } = await supabase
      .from("webhooks")
      .select("*")
      .eq("id", webhookId)
      .eq("direction", "inbound")
      .eq("active", true)
      .maybeSingle();

    if (whError || !webhook) return recusar();

    // Validate token — só header, e em tempo constante.
    if (!segredosBatem(req.headers.get("x-webhook-token"), webhook.secret_token)) {
      return recusar();
    }

    // Parse payload
    let payload: Record<string, unknown> = {};
    if (req.method === "POST" || req.method === "PUT") {
      const corpo = await corpoLimitado(req, MAX_CORPO_BYTES);
      if ("erro" in corpo) {
        return responder({ error: corpo.erro }, 413);
      }
      try {
        const lido = JSON.parse(corpo.texto);
        payload = lido && typeof lido === "object" && !Array.isArray(lido)
          ? lido as Record<string, unknown>
          : { raw: corpo.texto };
      } catch {
        payload = { raw: corpo.texto };
      }
    }

    // Log the webhook
    const logEntry: Record<string, unknown> = {
      webhook_id: webhook.id,
      company_id: webhook.company_id,
      direction: "inbound",
      payload,
      status: "received",
    };

    // Auto-create transaction if enabled
    if (webhook.auto_create_transaction) {
      try {
        const amount = Number(payload.amount || payload.valor || payload.value || 0);
        const description =
          String(payload.description || payload.descricao || payload.memo || "Webhook automático");
        const date =
          String(payload.date || payload.data || new Date().toISOString().split("T")[0]);
        const type = webhook.default_type || "expense";

        if (amount > 0) {
          // We need a user_id for the transaction — use the first admin member
          const { data: member } = await supabase
            .from("company_members")
            .select("user_id")
            .eq("company_id", webhook.company_id)
            .eq("role", "admin")
            .limit(1)
            .maybeSingle();

          if (member) {
            const { data: tx, error: txError } = await supabase
              .from("transactions")
              .insert({
                company_id: webhook.company_id,
                user_id: member.user_id,
                description,
                amount,
                type,
                date,
                source: "webhook",
                status: "pending",
                account_id: webhook.default_account_id || null,
                cost_center_id: webhook.default_cost_center_id || null,
              })
              .select("id")
              .single();

            if (txError) {
              logEntry.status = "failed";
              logEntry.error_message = txError.message;
            } else {
              logEntry.status = "processed";
              logEntry.transaction_id = tx?.id;
            }
          } else {
            logEntry.status = "failed";
            logEntry.error_message = "No admin member found";
          }
        } else {
          logEntry.status = "processed";
          logEntry.error_message = "Amount is zero or missing, skipped transaction";
        }
      } catch (err) {
        logEntry.status = "failed";
        logEntry.error_message = err instanceof Error ? err.message : "Unknown error";
      }
    } else {
      logEntry.status = "processed";
    }

    await supabase.from("webhook_logs").insert(logEntry);

    return responder({ success: true, status: logEntry.status }, 200);
  } catch (error) {
    console.error("Webhook error:", error);
    return responder({ error: "Internal server error" }, 500);
  }
});
