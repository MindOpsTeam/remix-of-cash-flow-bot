/**
 * Shared helper for PlugNotas integration.
 *
 * - Carrega config (api_key + environment) por company_id
 * - Faz fetch wrapper com X-API-KEY no header
 * - Valida JWT e ownership da company
 * - Centraliza logging em plugnotas_documents
 */

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";
import { getCorsHeaders, corsPreflightResponse } from "./cors.ts";

const PLUGNOTAS_HOSTS = {
  sandbox: "https://api.sandbox.plugnotas.com.br",
  producao: "https://api.plugnotas.com.br",
} as const;

export interface PlugnotasConfig {
  id: string;
  company_id: string;
  api_key: string;
  environment: "sandbox" | "producao";
  plugnotas_empresa_cnpj: string | null;
  plugnotas_empresa_id: string | null;
  enabled_nfe: boolean;
  enabled_nfse: boolean;
  enabled_nfce: boolean;
  enabled_cte: boolean;
  enabled_mdfe: boolean;
  serie_padrao: string | null;
  active: boolean;
}

export interface PlugnotasContext {
  supabase: SupabaseClient;
  userId: string;
  companyId: string;
  config: PlugnotasConfig;
  corsHeaders: Record<string, string>;
  body: Record<string, unknown>;
}

export function jsonResponse(
  body: unknown,
  status: number,
  corsHeaders: Record<string, string>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Boilerplate: CORS preflight, JWT validation, config lookup.
 * Returns either a ready-to-return Response (on error) or a PlugnotasContext.
 */
export async function bootstrap(
  req: Request,
): Promise<Response | PlugnotasContext> {
  const corsHeaders = getCorsHeaders(req);
  const preflight = corsPreflightResponse(req);
  if (preflight) return preflight;

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, corsHeaders);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return jsonResponse({ error: "Unauthorized" }, 401, corsHeaders);

  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authError } = await authClient.auth.getUser();
  if (authError || !user) return jsonResponse({ error: "Unauthorized" }, 401, corsHeaders);

  const supabase = createClient(supabaseUrl, serviceKey);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400, corsHeaders);
  }

  const companyId = body.company_id as string | undefined;
  if (!companyId) {
    return jsonResponse({ error: "company_id é obrigatório" }, 400, corsHeaders);
  }

  // Ownership: the authenticated user must be a member of this company
  const { data: membership, error: membershipErr } = await supabase
    .from("company_members")
    .select("company_id")
    .eq("company_id", companyId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (membershipErr || !membership) {
    return jsonResponse({ error: "Forbidden" }, 403, corsHeaders);
  }

  const { data: config, error: configErr } = await supabase
    .from("plugnotas_config")
    .select("*")
    .eq("company_id", companyId)
    .single();
  if (configErr || !config) {
    return jsonResponse(
      { error: "PlugNotas não configurado para esta empresa" },
      404,
      corsHeaders,
    );
  }
  if (!config.active) {
    return jsonResponse({ error: "Integração PlugNotas inativa" }, 409, corsHeaders);
  }
  if (!config.api_key) {
    return jsonResponse({ error: "PlugNotas api_key ausente" }, 400, corsHeaders);
  }

  return {
    supabase,
    userId: user.id,
    companyId,
    config: config as PlugnotasConfig,
    corsHeaders,
    body,
  };
}

/**
 * PlugNotas emit endpoints (NFe, NFSe, NFCe, MDFe) require an array of
 * documents in the body. Wrap single objects into a single-element array.
 */
export function toDocumentArray(params: unknown): unknown[] {
  return Array.isArray(params) ? params : [params];
}

/**
 * Generic fetch helper for the PlugNotas REST API.
 * Returns { ok, status, data } where data is the parsed JSON (or text fallback).
 */
export async function plugnotasFetch(
  config: PlugnotasConfig,
  path: string,
  init: RequestInit = {},
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const host = PLUGNOTAS_HOSTS[config.environment] ?? PLUGNOTAS_HOSTS.sandbox;
  const url = `${host}${path.startsWith("/") ? path : "/" + path}`;

  const headers = new Headers(init.headers ?? {});
  headers.set("X-API-KEY", config.api_key);
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }
  headers.set("Accept", "application/json");

  const res = await fetch(url, { ...init, headers });

  const ct = res.headers.get("content-type") ?? "";
  let data: unknown;
  if (ct.includes("application/json")) {
    data = await res.json().catch(() => null);
  } else {
    data = await res.text().catch(() => null);
  }
  return { ok: res.ok, status: res.status, data };
}

/**
 * Insert an audit row into plugnotas_documents and return its id.
 */
export async function logDocument(
  supabase: SupabaseClient,
  companyId: string,
  docType: "nfe" | "nfse" | "nfce" | "cte" | "mdfe",
  payload: {
    plugnotas_id?: string | null;
    chave_acesso?: string | null;
    numero?: string | null;
    serie?: string | null;
    status: string;
    status_message?: string | null;
    payload_request?: unknown;
    payload_response?: unknown;
    invoice_id?: string | null;
    /** Destaque CBS/IBS (Reforma Tributária) calculado na emissão. */
    reforma?: {
      cbs_valor?: number;
      ibs_valor?: number;
      cbs_aliquota?: number;
      ibs_aliquota?: number;
      cclasstrib?: string;
    } | null;
  },
): Promise<string | null> {
  const { data, error } = await supabase
    .from("plugnotas_documents")
    .insert({
      company_id: companyId,
      doc_type: docType,
      plugnotas_id: payload.plugnotas_id ?? null,
      chave_acesso: payload.chave_acesso ?? null,
      numero: payload.numero ?? null,
      serie: payload.serie ?? null,
      status: payload.status,
      status_message: payload.status_message ?? null,
      payload_request: payload.payload_request ?? null,
      payload_response: payload.payload_response ?? null,
      invoice_id: payload.invoice_id ?? null,
      cbs_valor: payload.reforma?.cbs_valor ?? null,
      ibs_valor: payload.reforma?.ibs_valor ?? null,
      cbs_aliquota: payload.reforma?.cbs_aliquota ?? null,
      ibs_aliquota: payload.reforma?.ibs_aliquota ?? null,
      cclasstrib: payload.reforma?.cclasstrib ?? null,
      emitted_at: payload.status === "autorizado" ? new Date().toISOString() : null,
    })
    .select("id")
    .single();
  if (error) {
    console.error("plugnotas_documents insert failed", error);
    return null;
  }
  return data?.id ?? null;
}
