/**
 * reconcile-transactions — Supabase Edge Function
 *
 * Conciliação automática: ao receber dados de API (Inter, Asaas),
 * busca transações manuais/whatsapp similares para evitar duplicatas.
 *
 * Ações:
 *   reconcile_pf — concilia personal_transactions
 *   reconcile_pj — concilia transactions (PJ)
 *   list_pending — lista transações com possíveis duplicatas
 *   resolve       — resolve manualmente (confirm/reject)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";

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
  const corsHeaders = getCorsHeaders(req, EXTRA_HEADERS);
  const preflight = corsPreflightResponse(req, EXTRA_HEADERS);
  if (preflight) return preflight;

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json();
    const { action } = body;

    // ── reconcile_pf: Find matching PF transaction or insert new ──
    if (action === "reconcile_pf") {
      const { user_id, amount, date, type, description, source, external_id, account_id, category_id } = body;
      if (!user_id || !amount || !date || !type) {
        return jsonResp({ error: "user_id, amount, date, type required" }, 400, corsHeaders);
      }

      // Check if external_id already exists (idempotency)
      if (external_id) {
        const { data: existing } = await supabase
          .from("personal_transactions")
          .select("id")
          .eq("user_id", user_id)
          .eq("external_id", external_id)
          .maybeSingle();
        if (existing) {
          return jsonResp({ ok: true, action: "skipped", reason: "external_id_exists", id: existing.id }, 200, corsHeaders);
        }
      }

      // Search for matching manual/whatsapp transactions
      const dateObj = new Date(date);
      const startDate = new Date(dateObj);
      startDate.setDate(startDate.getDate() - DATE_WINDOW_DAYS);
      const endDate = new Date(dateObj);
      endDate.setDate(endDate.getDate() + DATE_WINDOW_DAYS);

      const pfType = type === "revenue" ? "receita" : type === "receita" ? "receita" : type === "expense" ? "despesa" : type;

      const { data: candidates } = await supabase
        .from("personal_transactions")
        .select("id, title, amount, date, type, source, status")
        .eq("user_id", user_id)
        .eq("type", pfType)
        .in("source", ["manual", "whatsapp"])
        .neq("status", "reconciled")
        .gte("date", startDate.toISOString().split("T")[0])
        .lte("date", endDate.toISOString().split("T")[0]);

      const absAmount = Math.abs(amount);
      const match = (candidates || []).find((c: any) => {
        const diff = Math.abs(Math.abs(c.amount) - absAmount);
        return diff <= absAmount * VALUE_TOLERANCE;
      });

      if (match) {
        // Reconcile: update existing transaction with external_id
        await supabase
          .from("personal_transactions")
          .update({
            external_id: external_id || null,
            source: "reconciled",
            status: "reconciled",
            reconciled_at: new Date().toISOString(),
          })
          .eq("id", match.id);

        return jsonResp({
          ok: true,
          action: "reconciled",
          matched_id: match.id,
          matched_description: match.title,
        }, 200, corsHeaders);
      }

      // No match found — insert as new transaction
      const { data: inserted, error: insertErr } = await supabase
        .from("personal_transactions")
        .insert({
          user_id,
          title: description || "Transação via API",
          amount: absAmount,
          type: pfType,
          date,
          source: source || "api",
          external_id: external_id || null,
          account_id: account_id || null,
          category_id: category_id || null,
          status: "confirmed",
        })
        .select("id")
        .single();

      if (insertErr) throw new Error(`Insert failed: ${insertErr.message}`);

      return jsonResp({ ok: true, action: "inserted", id: inserted.id }, 200, corsHeaders);
    }

    // ── reconcile_pj: Find matching PJ transaction or insert new ──
    if (action === "reconcile_pj") {
      const { company_id, user_id, amount, date, type, description, source, external_id, bank_account_id, account_id, cost_center_id } = body;
      if (!company_id || !amount || !date || !type) {
        return jsonResp({ error: "company_id, amount, date, type required" }, 400, corsHeaders);
      }

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
        .in("source", ["manual", "whatsapp"])
        .neq("status", "reconciled")
        .gte("date", startDate.toISOString().split("T")[0])
        .lte("date", endDate.toISOString().split("T")[0]);

      const absAmount = Math.abs(amount);
      const match = (candidates || []).find((c: any) => {
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

      const { data: inserted, error: insertErr } = await supabase
        .from("transactions")
        .insert({
          company_id,
          user_id: user_id || "00000000-0000-0000-0000-000000000000",
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

    // ── list_pending: Find potential duplicates AND orphan (single-entry) transactions ──
    if (action === "list_pending") {
      const { user_id, company_id } = body;

      if (user_id) {
        // PF: find transactions from API sources
        const { data: apiTxs } = await supabase
          .from("personal_transactions")
          .select("id, title, amount, date, type, source, external_id, status")
          .eq("user_id", user_id)
          .in("source", ["asaas", "api", "inter"])
          .neq("status", "reconciled")
          .order("date", { ascending: false })
          .limit(200);

        // PF: find transactions from manual/whatsapp sources
        const { data: manualTxs } = await supabase
          .from("personal_transactions")
          .select("id, title, amount, date, type, source, status")
          .eq("user_id", user_id)
          .in("source", ["manual", "whatsapp"])
          .neq("status", "reconciled")
          .order("date", { ascending: false })
          .limit(200);

        const candidates: ReconcileCandidate[] = [];
        const matchedApiIds = new Set<string>();
        const matchedManualIds = new Set<string>();

        // Find potential duplicates (double-entry matches)
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
              match_description: manual.title,
              match_date: manual.date,
              match_amount: manual.amount,
              match_source: manual.source,
            });
            matchedApiIds.add(api.id);
            matchedManualIds.add(manual.id);
          }
        }

        // Orphans: transactions with no counterpart (single-entry)
        interface OrphanTx {
          id: string;
          title: string;
          amount: number;
          date: string;
          type: string;
          source: string;
          status: string;
        }
        const orphans: OrphanTx[] = [];

        // API-only transactions (no matching manual/whatsapp entry)
        for (const api of (apiTxs || [])) {
          if (!matchedApiIds.has(api.id)) {
            orphans.push({
              id: api.id,
              title: api.title || "Transação via API",
              amount: api.amount,
              date: api.date,
              type: api.type,
              source: api.source,
              status: api.status,
            });
          }
        }

        // WhatsApp/manual-only transactions (no matching API entry)
        for (const manual of (manualTxs || [])) {
          if (!matchedManualIds.has(manual.id)) {
            orphans.push({
              id: manual.id,
              title: manual.title || "Lançamento manual",
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

      return jsonResp({ candidates: [], orphans: [] }, 200, corsHeaders);
    }

    // ── resolve: Manual reconciliation decision ──
    if (action === "resolve") {
      const { transaction_id, match_id, decision, table } = body;
      const targetTable = table === "pj" ? "transactions" : "personal_transactions";

      if (decision === "confirm") {
        // Mark the manual entry as reconciled, delete the API duplicate
        await supabase
          .from(targetTable)
          .update({ status: "reconciled", source: "reconciled", reconciled_at: new Date().toISOString() })
          .eq("id", match_id);

        // Delete the API-imported duplicate
        await supabase.from(targetTable).delete().eq("id", transaction_id);

        return jsonResp({ ok: true, action: "confirmed" }, 200, corsHeaders);
      }

      if (decision === "reject") {
        // Keep both — mark them as reviewed so they don't show up again
        await supabase
          .from(targetTable)
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

function jsonResp(data: unknown, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}
