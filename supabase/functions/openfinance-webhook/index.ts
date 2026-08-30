/**
 * Open Finance — receptor de webhooks do provedor (Pluggy).
 * Eventos: item/updated, transactions/created, transactions/updated, item/error.
 * Sem JWT (verify_jwt=false) — valida por itemId conhecido no banco.
 *
 * POST /openfinance-webhook  body: { event, itemId, ... }
 *
 * Hardening 29/08/2026:
 * - Sem teto: quem descobrisse um itemId forçava sincronização atrás de
 *   sincronização, e cada uma consome chamada paga no provedor. O balde é por
 *   item, não por origem, porque o provedor chama de IPs que mudam.
 * - O catch devolvia `String(err)` para um chamador sem autenticação nenhuma,
 *   entregando mensagem interna do banco a quem só mandou um POST.
 * - Corpo sem teto de bytes.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";
import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";
import { syncPluggyConnection } from "../_shared/openfinance-sync.ts";
import { checarLimite, corpoLimitado } from "../_shared/limite.ts";

/** Pluggy reenvia evento em rajada legítima; 30/min por item cobre isso com folga. */
const TETO_POR_ITEM = 30;
const JANELA_SEGUNDOS = 60;
const MAX_CORPO_BYTES = 128 * 1024;

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const preflight = corsPreflightResponse(req);
  if (preflight) return preflight;

  const service = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const corpo = await corpoLimitado(req, MAX_CORPO_BYTES);
    if ("erro" in corpo) {
      return new Response(JSON.stringify({ error: corpo.erro }), {
        status: 413,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    let body: Record<string, unknown> = {};
    try {
      const lido = JSON.parse(corpo.texto);
      if (lido && typeof lido === "object" && !Array.isArray(lido)) {
        body = lido as Record<string, unknown>;
      }
    } catch { /* corpo ilegível cai no skipped: no-item abaixo */ }
    const event = body.event as string | undefined;
    const itemId = (body.itemId || body.item_id) as string | undefined;
    console.log("[openfinance-webhook]", event, itemId);

    if (!itemId) {
      return new Response(JSON.stringify({ ok: true, skipped: "no-item" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Só processa itens que conhecemos (conexão registrada)
    const { data: conn } = await service
      .from("bank_connections")
      .select("id, company_id, external_id, last_synced_at, history_calls_month, history_calls_reset_at")
      .eq("provider", "pluggy")
      .eq("external_id", itemId)
      .maybeSingle();

    if (!conn) {
      return new Response(JSON.stringify({ ok: true, skipped: "unknown-item" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Só depois de saber que o item é nosso é que o teto entra: contar antes
    // encheria a tabela com o lixo de quem chuta itemId.
    const teto = await checarLimite(
      service,
      `openfinance-webhook:${conn.id}`,
      TETO_POR_ITEM,
      JANELA_SEGUNDOS,
    );
    if (teto.excedeu) return teto.resposta(corsHeaders);

    // Eventos que disparam sincronização incremental
    const syncEvents = ["item/updated", "transactions/created", "transactions/updated", "item/created"];
    if (event && syncEvents.includes(event)) {
      const result = await syncPluggyConnection(service, conn, { initial: false });
      return new Response(JSON.stringify({ ok: true, ...result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // item/error, item/waiting_user_input → só atualiza status via próximo sync manual
    return new Response(JSON.stringify({ ok: true, event }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    // A mensagem crua vai para o log, não para a resposta: este endpoint
    // atende sem autenticação e não deve descrever o próprio banco.
    console.error("[openfinance-webhook] error", err);
    return new Response(JSON.stringify({ error: "Erro ao processar o evento" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
