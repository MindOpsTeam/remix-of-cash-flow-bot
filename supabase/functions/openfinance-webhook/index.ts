/**
 * Open Finance — receptor de webhooks do provedor (Pluggy).
 * Eventos: item/updated, transactions/created, transactions/updated, item/error.
 * Sem JWT (verify_jwt=false) — valida por itemId conhecido no banco.
 *
 * POST /openfinance-webhook  body: { event, itemId, ... }
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";
import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";
import { syncPluggyConnection } from "../_shared/openfinance-sync.ts";

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const preflight = corsPreflightResponse(req);
  if (preflight) return preflight;

  const service = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = await req.json().catch(() => ({}));
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
    console.error("[openfinance-webhook] error", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
