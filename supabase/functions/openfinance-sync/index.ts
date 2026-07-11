/**
 * Open Finance — sync on-demand e importação p/ transactions.
 *
 * POST /openfinance-sync
 *   { action: "sync", company_id, connection_id }   → puxa incrementais para o staging
 *   { action: "import", company_id, raw_ids: [] }   → move do staging p/ transactions
 *
 * Autenticado por JWT.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";
import { authenticate, assertMembership, jsonResp } from "../_shared/auth.ts";
import { syncPluggyConnection } from "../_shared/openfinance-sync.ts";

Deno.serve(async (req) => {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const { user, supabase, corsHeaders } = auth;

  const service = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action as string;
    const companyId = body.company_id as string | undefined;
    if (!companyId) return jsonResp({ error: "company_id é obrigatório" }, 400, corsHeaders);
    const forbidden = await assertMembership(supabase, user.id, companyId, corsHeaders);
    if (forbidden) return forbidden;

    if (action === "sync") {
      const connectionId = body.connection_id as string;
      const { data: conn, error } = await service
        .from("bank_connections")
        .select("id, company_id, external_id, last_synced_at, history_calls_month, history_calls_reset_at")
        .eq("id", connectionId)
        .eq("company_id", companyId)
        .single();
      if (error || !conn) return jsonResp({ error: "conexão não encontrada" }, 404, corsHeaders);
      const result = await syncPluggyConnection(service, conn, { initial: false });
      return jsonResp({ ok: true, ...result }, 200, corsHeaders);
    }

    if (action === "import") {
      const rawIds = (body.raw_ids as string[]) ?? [];
      if (rawIds.length === 0) return jsonResp({ error: "raw_ids vazio" }, 400, corsHeaders);

      const { data: rows, error } = await service
        .from("bank_transactions_raw")
        .select("*")
        .eq("company_id", companyId)
        .in("id", rawIds)
        .eq("status", "new");
      if (error) throw error;

      let imported = 0;
      for (const r of rows ?? []) {
        // Cria o lançamento (status pendente — usuário classifica conta contábil depois)
        const { data: tx, error: txErr } = await service
          .from("transactions")
          .insert({
            company_id: companyId,
            user_id: user.id,
            date: r.date,
            description: r.description,
            amount: r.amount,
            type: r.direction === "revenue" ? "revenue" : "expense",
            status: "pending",
            source: "openfinance",
            external_id: r.external_id,
          })
          .select("id")
          .single();
        if (txErr) continue;
        await service
          .from("bank_transactions_raw")
          .update({ status: "imported", transaction_id: tx.id })
          .eq("id", r.id);
        imported += 1;
      }
      return jsonResp({ ok: true, imported }, 200, corsHeaders);
    }

    return jsonResp({ error: `Ação inválida: ${action}` }, 400, corsHeaders);
  } catch (err) {
    console.error("[openfinance-sync] error", err);
    return jsonResp({ error: String(err) }, 500, corsHeaders);
  }
});
