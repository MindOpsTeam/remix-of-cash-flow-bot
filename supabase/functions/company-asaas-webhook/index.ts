import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";
import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";
import { processEvent } from "../_shared/asaas-processor.ts";
import { segredoDaIntegracao } from "../_shared/segredos.ts";
import { checarLimite, corpoLimitado, origemDaChamada, segredosBatem } from "../_shared/limite.ts";

/**
 * Hardening 29/08/2026: sem teto, cada POST anônimo obrigava uma leitura de
 * Vault POR EMPRESA com Asaas ligado. Quem quisesse só precisava repetir a
 * requisição para multiplicar trabalho no nosso cofre — e nada contava. O
 * balde é por origem porque aqui ainda não se sabe de qual empresa é a chamada.
 */
const TETO_POR_ORIGEM = 60;
const JANELA_SEGUNDOS = 60;
const MAX_CORPO_BYTES = 256 * 1024;

const EXTRA_HEADERS = "asaas-access-token";

function getEventCategory(event: string): string {
  if (event.startsWith("PAYMENT_")) return "PAYMENT";
  if (event.startsWith("SUBSCRIPTION_")) return "SUBSCRIPTION";
  if (event.startsWith("INVOICE_")) return "INVOICE";
  if (event.startsWith("TRANSFER_")) return "TRANSFER";
  if (event.startsWith("BILL_")) return "BILL";
  if (event.startsWith("RECEIVABLE_ANTICIPATION_")) return "RECEIVABLE_ANTICIPATION";
  if (event.startsWith("MOBILE_PHONE_RECHARGE_")) return "MOBILE_PHONE_RECHARGE";
  if (event.startsWith("ACCOUNT_STATUS_")) return "ACCOUNT_STATUS";
  if (event.startsWith("CHECKOUT_")) return "CHECKOUT";
  if (event.startsWith("BALANCE_")) return "BALANCE";
  if (event.startsWith("INTERNAL_TRANSFER_")) return "INTERNAL_TRANSFER";
  if (event.startsWith("ACCESS_TOKEN_")) return "ACCESS_TOKEN";
  return "OTHER";
}

function getEntityFromPayload(body: Record<string, unknown>): { id: string | null; type: string | null } {
  if (body.payment) return { id: (body.payment as any)?.id || null, type: "payment" };
  if (body.subscription) return { id: (body.subscription as any)?.id || null, type: "subscription" };
  if (body.transfer) return { id: (body.transfer as any)?.id || null, type: "transfer" };
  if (body.bill) return { id: (body.bill as any)?.id || null, type: "bill" };
  if (body.invoice) return { id: (body.invoice as any)?.id || null, type: "invoice" };
  if (body.anticipation) return { id: (body.anticipation as any)?.id || null, type: "anticipation" };
  if (body.checkout) return { id: (body.checkout as any)?.id || null, type: "checkout" };
  return { id: null, type: null };
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req, EXTRA_HEADERS);
  const preflight = corsPreflightResponse(req, EXTRA_HEADERS);
  if (preflight) return preflight;

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const teto = await checarLimite(
      supabase,
      `asaas-webhook:${origemDaChamada(req)}`,
      TETO_POR_ORIGEM,
      JANELA_SEGUNDOS,
    );
    if (teto.excedeu) return teto.resposta(corsHeaders);

    const accessToken = req.headers.get("asaas-access-token");
    if (!accessToken) {
      return new Response(JSON.stringify({ error: "Missing access token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find company config by webhook auth token
    // O token vive no Vault, então não dá para filtrar por igualdade no SQL:
    // varremos as configs e comparamos o valor do cofre. O volume é o número de
    // empresas com Asaas ligado, não de eventos.
    const { data: candidatos } = await supabase
      .from("company_asaas_config")
      .select("id, company_id, enabled_events");

    // Tipo nomeado: `c as typeof config` estreitava para `null` na análise de
    // fluxo do TypeScript, e todo acesso a config.company_id depois virava erro
    // de tipo. O código rodava, mas o type-check ficava vermelho para sempre e
    // por isso deixou de ser lido.
    type ConfigAsaas = { id: string; company_id: string; enabled_events: unknown };
    let config: ConfigAsaas | null = null;
    for (const c of candidatos ?? []) {
      const esperado = await segredoDaIntegracao(
        supabase, c.company_id as string, "asaas", "webhook_auth_token",
      );
      // Comparação em tempo constante: `===` sai no primeiro byte diferente, e
      // num endpoint aberto essa diferença é medível.
      if (segredosBatem(accessToken, esperado)) {
        config = c as ConfigAsaas;
        break;
      }
    }

    if (!config) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const corpo = await corpoLimitado(req, MAX_CORPO_BYTES);
    if ("erro" in corpo) {
      return new Response(JSON.stringify({ error: corpo.erro }), {
        status: 413,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const body = JSON.parse(corpo.texto);
    const event = body.event as string;
    const eventId = body.id as string;
    const eventCategory = getEventCategory(event);
    const entity = getEntityFromPayload(body);

    // Check if event is enabled
    const enabledEvents = (config.enabled_events as string[]) || [];
    if (enabledEvents.length > 0 && !enabledEvents.includes(event)) {
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert event (idempotent via UNIQUE(company_id, event_id))
    const { error: insertError } = await supabase
      .from("company_asaas_webhook_events")
      .insert({
        company_id: config.company_id,
        event_id: eventId || `${event}_${entity.id || "unknown"}_${Date.now()}`,
        event_type: event,
        event_category: eventCategory,
        entity_id: entity.id,
        entity_type: entity.type,
        payload: body,
      });

    if (insertError) {
      if (insertError.code === "23505") {
        return new Response(JSON.stringify({ ok: true, duplicate: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.error("Insert error:", insertError);
      return new Response(JSON.stringify({ error: "Failed to log" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Process event into structured table (payments, transfers, bills, etc.)
    await processEvent(supabase, config.company_id, eventCategory, body);

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Company webhook error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
