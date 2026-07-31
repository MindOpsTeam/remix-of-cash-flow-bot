/**
 * reconcile-transactions — Supabase Edge Function
 *
 * Conciliação automática: ao receber dados de API (Inter, Asaas),
 * busca transações manuais/whatsapp similares para evitar duplicatas.
 *
 * Ações:
 *   reconcile_pj — concilia transactions (PJ)
 *   list_pending — lista transações com possíveis duplicatas
 *   resolve       — resolve manualmente (confirm/reject)
 *
 * Auth: exige JWT do usuário + membership em company_id.
 * Chamadas internas (ex: inter-banking) devem repassar o Authorization
 * do usuário via `headers: { Authorization }` no functions.invoke.
 */

import { corsPreflightResponse } from "../_shared/cors.ts";
import { authenticate, assertMembership, assertCanWrite, jsonResp } from "../_shared/auth.ts";

const EXTRA_HEADERS = "authorization, x-client-info, apikey, content-type";

// Matching config
const DATE_WINDOW_DAYS = 2;
const VALUE_TOLERANCE = 0.05; // 5%

interface ReconcileCandidate {
  incoming_id: string;
  match_id: string;
  match_score: number;
  match_description: string;
  match_date: string;
  match_amount: number;
  match_source: string;
}

Deno.serve(async (req) => {
  const preflight = corsPreflightResponse(req, EXTRA_HEADERS);
  if (preflight) return preflight;

  // ── Auth first, then dispatch ──
  const auth = await authenticate(req, { extraHeaders: EXTRA_HEADERS });
  if (auth instanceof Response) return auth;
  const { user, supabase, corsHeaders } = auth;

  try {
    const body = await req.json();
    const { action } = body;

    // ── reconcile_pj: Find matching PJ transaction or insert new ──
    if (action === "reconcile_pj") {
      const {
        company_id, amount, date, type, description, source, external_id,
        bank_account_id, account_id, cost_center_id,
      } = body;
      if (!company_id || !amount || !date || !type) {
        return jsonResp({ error: "company_id, amount, date, type required" }, 400, corsHeaders);
      }

      // O user que chama deve ser member da empresa e poder escrever.
      const forbidden = await assertMembership(supabase, user.id, company_id, corsHeaders);
      if (forbidden) return forbidden;
      const readonly = await assertCanWrite(supabase, user.id, company_id, corsHeaders);
      if (readonly) return readonly;

      // Idempotency check
      if (external_id) {
        const { data: existing } = await supabase
          .from("transactions")
          .select("id")
          .eq("company_id", company_id)
          .eq("external_id", external_id)
          .maybeSingle();
        if (existing) {
          return jsonResp({ ok: true, action: "skipped", reason: "external_id_exists", id: existing.id }, 200, corsHeaders);
        }
      }

      const dateObj = new Date(date);
      const startDate = new Date(dateObj);
      startDate.setDate(startDate.getDate() - DATE_WINDOW_DAYS);
      const endDate = new Date(dateObj);
      endDate.setDate(endDate.getDate() + DATE_WINDOW_DAYS);

      const { data: candidates } = await supabase
        .from("transactions")
        .select("id, description, amount, date, type, source, status")
        .eq("company_id", company_id)
        .eq("type", type)
        // "receivable" incluído: um crédito do extrato/OF concilia com a receita já
        // lançada pela baixa do contas a receber, em vez de gerar uma 2ª receita.
        .in("source", ["manual", "whatsapp", "receivable"])
        .neq("status", "reconciled")
        .gte("date", startDate.toISOString().split("T")[0])
        .lte("date", endDate.toISOString().split("T")[0]);

      const absAmount = Math.abs(amount);
      const match = (candidates || []).find((c: { amount: number }) => {
        const diff = Math.abs(Math.abs(c.amount) - absAmount);
        return diff <= absAmount * VALUE_TOLERANCE;
      });

      if (match) {
        await supabase
          .from("transactions")
          .update({
            external_id: external_id || null,
            source: "reconciled",
            status: "reconciled",
          })
          .eq("id", match.id);

        return jsonResp({
          ok: true,
          action: "reconciled",
          matched_id: match.id,
          matched_description: match.description,
        }, 200, corsHeaders);
      }

      // user_id sempre do JWT autenticado — nunca aceitar do body
      const { data: inserted, error: insertErr } = await supabase
        .from("transactions")
        .insert({
          company_id,
          user_id: user.id,
          description: description || "Transação via API",
          amount: absAmount,
          type,
          date,
          source: source || "api",
          external_id: external_id || null,
          bank_account_id: bank_account_id || null,
          account_id: account_id || null,
          cost_center_id: cost_center_id || null,
          status: "confirmed",
        })
        .select("id")
        .single();

      if (insertErr) throw new Error(`Insert failed: ${insertErr.message}`);

      return jsonResp({ ok: true, action: "inserted", id: inserted.id }, 200, corsHeaders);
    }

    // ── list_pending: Find potential duplicates ──
    if (action === "list_pending") {
      const { company_id } = body;
      if (!company_id) {
        return jsonResp({ error: "company_id required" }, 400, corsHeaders);
      }
      const forbidden = await assertMembership(supabase, user.id, company_id, corsHeaders);
      if (forbidden) return forbidden;

      const { data: apiTxs } = await supabase
        .from("transactions")
        .select("id, description, amount, date, type, source, external_id, status")
        .eq("company_id", company_id)
        .in("source", ["asaas", "api", "inter"])
        .neq("status", "reconciled")
        .order("date", { ascending: false })
        .limit(200);

      const { data: manualTxs } = await supabase
        .from("transactions")
        .select("id, description, amount, date, type, source, status")
        .eq("company_id", company_id)
        // inclui "receivable" p/ o crédito do extrato conciliar com a receita já
        // lançada na baixa do contas a receber (anti-duplicidade com Open Finance).
        .in("source", ["manual", "whatsapp", "receivable"])
        .neq("status", "reconciled")
        .order("date", { ascending: false })
        .limit(200);

      const candidates: ReconcileCandidate[] = [];
      const matchedApiIds = new Set<string>();
      const matchedManualIds = new Set<string>();

      for (const api of (apiTxs || [])) {
        for (const manual of (manualTxs || [])) {
          if (api.type !== manual.type) continue;
          const dateDiff = Math.abs(new Date(api.date).getTime() - new Date(manual.date).getTime());
          if (dateDiff > DATE_WINDOW_DAYS * 86400000) continue;
          const valueDiff = Math.abs(Math.abs(api.amount) - Math.abs(manual.amount));
          if (valueDiff > Math.abs(api.amount) * VALUE_TOLERANCE) continue;

          const score = (1 - valueDiff / Math.abs(api.amount)) * 50 + (1 - dateDiff / (DATE_WINDOW_DAYS * 86400000)) * 50;
          candidates.push({
            incoming_id: api.id,
            match_id: manual.id,
            match_score: Math.round(score),
            match_description: manual.description,
            match_date: manual.date,
            match_amount: manual.amount,
            match_source: manual.source,
          });
          matchedApiIds.add(api.id);
          matchedManualIds.add(manual.id);
        }
      }

      interface OrphanTx {
        id: string;
        description: string;
        amount: number;
        date: string;
        type: string;
        source: string;
        status: string;
      }
      const orphans: OrphanTx[] = [];

      for (const api of (apiTxs || [])) {
        if (!matchedApiIds.has(api.id)) {
          orphans.push({
            id: api.id,
            description: api.description || "Transação via API",
            amount: api.amount,
            date: api.date,
            type: api.type,
            source: api.source,
            status: api.status,
          });
        }
      }

      for (const manual of (manualTxs || [])) {
        if (!matchedManualIds.has(manual.id)) {
          orphans.push({
            id: manual.id,
            description: manual.description || "Lançamento manual",
            amount: manual.amount,
            date: manual.date,
            type: manual.type,
            source: manual.source,
            status: manual.status,
          });
        }
      }

      return jsonResp({
        candidates: candidates.sort((a, b) => b.match_score - a.match_score),
        orphans: orphans.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
      }, 200, corsHeaders);
    }

    // ── resolve: Manual reconciliation decision ──
    if (action === "resolve") {
      const { transaction_id, match_id, decision } = body;
      if (!transaction_id || !match_id || !decision) {
        return jsonResp({ error: "transaction_id, match_id, decision required" }, 400, corsHeaders);
      }

      // Carrega ambas as transactions e valida que o user é membro das duas companies
      const { data: txs, error: txErr } = await supabase
        .from("transactions")
        .select("id, company_id")
        .in("id", [transaction_id, match_id]);
      if (txErr || !txs || txs.length !== 2) {
        return jsonResp({ error: "transactions not found" }, 404, corsHeaders);
      }
      const companyIds: string[] = [...new Set((txs as { company_id: string }[]).map((t) => t.company_id))];
      if (companyIds.length !== 1) {
        return jsonResp({ error: "transactions belong to different companies" }, 400, corsHeaders);
      }
      const forbidden = await assertMembership(supabase, user.id, companyIds[0], corsHeaders);
      if (forbidden) return forbidden;

      if (decision === "confirm") {
        // Snapshot the transaction being removed for audit trail
        const { data: removedTx } = await supabase
          .from("transactions")
          .select("*")
          .eq("id", transaction_id)
          .maybeSingle();

        await supabase
          .from("transactions")
          .update({ status: "reconciled", source: "reconciled", reconciled_at: new Date().toISOString() })
          .eq("id", match_id);

        // Log before deleting
        if (removedTx) {
          await supabase.from("reconciliation_log").insert({
            company_id: removedTx.company_id,
            kept_transaction_id: match_id,
            removed_transaction_id: transaction_id,
            decision: "confirm",
            resolved_by: user.id,
            removed_snapshot: removedTx,
          });
        }

        await supabase.from("transactions").delete().eq("id", transaction_id);

        return jsonResp({ ok: true, action: "confirmed" }, 200, corsHeaders);
      }

      if (decision === "reject") {
        await supabase
          .from("transactions")
          .update({ status: "confirmed" })
          .eq("id", match_id);

        return jsonResp({ ok: true, action: "rejected" }, 200, corsHeaders);
      }

      return jsonResp({ error: "Invalid decision" }, 400, corsHeaders);
    }

    return jsonResp({ error: `Unknown action: ${action}` }, 400, corsHeaders);

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[reconcile-transactions]", message);
    return jsonResp({ error: message }, 500, corsHeaders);
  }
});
