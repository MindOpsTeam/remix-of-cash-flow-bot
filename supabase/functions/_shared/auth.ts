/**
 * Shared auth helper for edge functions com `verify_jwt = false`.
 *
 * Quando o config.toml deixa `verify_jwt = false`, o gateway não bloqueia
 * chamadas sem JWT — a função PRECISA validar internamente. Este módulo
 * centraliza essa validação para evitar handlers esquecendo o check.
 *
 * Uso:
 *   const auth = await authenticate(req, { requireCompany: company_id });
 *   if (auth instanceof Response) return auth;
 *   const { user, supabase } = auth;
 */

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";
import { getCorsHeaders } from "./cors.ts";

export interface AuthContext {
  user: { id: string; email?: string };
  supabase: SupabaseClient;        // service-role client (use com cuidado — bypassa RLS)
  authHeader: string;              // Authorization original, para repassar a invocações internas
  corsHeaders: Record<string, string>;
}

interface AuthOpts {
  /** Se passado, valida que o user é membro dessa company via company_members. */
  requireCompany?: string;
  /** Headers extras pra liberar no CORS. */
  extraHeaders?: string;
}

/**
 * Valida JWT e (opcionalmente) membership em uma empresa.
 * Retorna AuthContext em sucesso, ou Response 401/403 pronta para retornar.
 */
export async function authenticate(
  req: Request,
  opts: AuthOpts = {},
): Promise<AuthContext | Response> {
  const corsHeaders = getCorsHeaders(req, opts.extraHeaders);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return jsonResp({ error: "Unauthorized" }, 401, corsHeaders);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Valida o JWT do usuário (sem service_role).
  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authErr } = await authClient.auth.getUser();
  if (authErr || !user) {
    return jsonResp({ error: "Unauthorized" }, 401, corsHeaders);
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  if (opts.requireCompany) {
    const { data: membership, error: memberErr } = await supabase
      .from("company_members")
      .select("company_id, role")
      .eq("company_id", opts.requireCompany)
      .eq("user_id", user.id)
      .maybeSingle();
    if (memberErr || !membership) {
      return jsonResp({ error: "Forbidden" }, 403, corsHeaders);
    }
  }

  return {
    user: { id: user.id, email: user.email ?? undefined },
    supabase,
    authHeader,
    corsHeaders,
  };
}

/**
 * Valida que o user atual é membro de uma company específica.
 * Use quando o company_id é descoberto depois do authenticate inicial.
 */
export async function assertMembership(
  supabase: SupabaseClient,
  userId: string,
  companyId: string,
  corsHeaders: Record<string, string>,
): Promise<Response | null> {
  const { data, error } = await supabase
    .from("company_members")
    .select("company_id")
    .eq("company_id", companyId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) {
    return jsonResp({ error: "Forbidden" }, 403, corsHeaders);
  }
  return null;
}

/**
 * Valida que o user atual PODE ESCREVER na company (papel admin ou member).
 * Complemento de assertMembership: edges que usam service_role bypassam RLS,
 * então o papel viewer (ex.: conta de demonstração compartilhada) precisa ser
 * barrado explicitamente aqui, senão "somente leitura" não vale para nenhum
 * caminho que passe por service_role.
 */
export async function assertCanWrite(
  supabase: SupabaseClient,
  userId: string,
  companyId: string,
  corsHeaders: Record<string, string>,
): Promise<Response | null> {
  const { data, error } = await supabase
    .from("company_members")
    .select("role")
    .eq("company_id", companyId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) {
    return jsonResp({ error: "Forbidden" }, 403, corsHeaders);
  }
  if (data.role !== "admin" && data.role !== "member") {
    return jsonResp(
      { error: "READ_ONLY_ROLE", detalhe: "Seu perfil é somente leitura nesta empresa." },
      403,
      corsHeaders,
    );
  }
  return null;
}

export function jsonResp(
  data: unknown,
  status: number,
  headers: Record<string, string>,
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}
