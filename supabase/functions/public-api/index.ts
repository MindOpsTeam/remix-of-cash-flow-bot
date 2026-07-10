/**
 * API pública v1 (read-only) — autenticação por chave de API da empresa.
 *
 * Header: X-API-Key: cfk_<64 hex>
 * Rotas (GET):
 *   /public-api/v1/ping
 *   /public-api/v1/transactions?from=YYYY-MM-DD&to=YYYY-MM-DD&limit=100
 *   /public-api/v1/margin            (v_company_margin — mensal consolidável)
 *   /public-api/v1/invoices?limit=100
 *   /public-api/v1/bills?status=a_vencer|vencido|pago
 *
 * Respostas seguem o envelope { success, data, error }.
 * Doc completa: docs/PUBLIC-API.md no repositório.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";
import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";

const MAX_LIMIT = 500;

function json(body: unknown, status: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req, "x-api-key");
  const preflight = corsPreflightResponse(req);
  if (preflight) return preflight;

  if (req.method !== "GET") {
    return json({ success: false, data: null, error: "Somente GET na v1" }, 405, cors);
  }

  const apiKey = req.headers.get("x-api-key") ?? "";
  if (!apiKey.startsWith("cfk_")) {
    return json({ success: false, data: null, error: "X-API-Key ausente ou inválida" }, 401, cors);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const keyHash = await sha256Hex(apiKey);
  const { data: keyRow } = await supabase
    .from("api_keys")
    .select("id, company_id, scopes, revoked_at")
    .eq("key_hash", keyHash)
    .maybeSingle();

  if (!keyRow || keyRow.revoked_at) {
    return json({ success: false, data: null, error: "Chave inválida ou revogada" }, 401, cors);
  }

  // Telemetria de uso (best-effort)
  supabase
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", keyRow.id)
    .then(() => {});

  const companyId = keyRow.company_id as string;
  const url = new URL(req.url);
  // Path após o nome da função: /public-api/v1/<recurso>
  const path = url.pathname.replace(/^.*\/public-api/, "");
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "100", 10) || 100, MAX_LIMIT);

  try {
    if (path === "/v1/ping" || path === "/v1/ping/") {
      return json({ success: true, data: { pong: true, company_id: companyId }, error: null }, 200, cors);
    }

    if (path === "/v1/transactions") {
      let q = supabase
        .from("transactions")
        .select("id, date, description, amount, type, status, payment_method, project, is_intercompany, created_at")
        .eq("company_id", companyId)
        .order("date", { ascending: false })
        .limit(limit);
      const from = url.searchParams.get("from");
      const to = url.searchParams.get("to");
      if (from) q = q.gte("date", from);
      if (to) q = q.lte("date", to);
      const { data, error } = await q;
      if (error) throw error;
      return json({ success: true, data, error: null }, 200, cors);
    }

    if (path === "/v1/margin") {
      const { data, error } = await supabase
        .from("v_company_margin")
        .select("month, receita, custos, despesas")
        .eq("company_id", companyId)
        .order("month", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return json({ success: true, data, error: null }, 200, cors);
    }

    if (path === "/v1/invoices") {
      const { data, error } = await supabase
        .from("invoices")
        .select("id, number, series, type, status, total, issue_date, cbs_valor, ibs_valor, created_at")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return json({ success: true, data, error: null }, 200, cors);
    }

    if (path === "/v1/bills") {
      let q = supabase
        .from("bills_payable")
        .select("id, fornecedor, descricao, valor, vencimento, status, approval_status, created_at")
        .eq("company_id", companyId)
        .order("vencimento", { ascending: true })
        .limit(limit);
      const status = url.searchParams.get("status");
      if (status) q = q.eq("status", status);
      const { data, error } = await q;
      if (error) throw error;
      return json({ success: true, data, error: null }, 200, cors);
    }

    return json({ success: false, data: null, error: `Rota desconhecida: ${path}` }, 404, cors);
  } catch (err) {
    console.error("[public-api] error", err);
    return json({ success: false, data: null, error: "Erro interno" }, 500, cors);
  }
});
