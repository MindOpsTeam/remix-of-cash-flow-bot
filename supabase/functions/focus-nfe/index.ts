/**
 * focus-nfe — proxy da API Focus NFe (v2) por empresa.
 *
 * A Focus é mais uma opção de emissão automática, ao lado do PlugNotas e da
 * NFS-e Nacional. Uma API só emite NFe, NFCe, NFSe, NFSe Nacional, CTe,
 * CT-e OS, CT-e Simplificado, MDFe, NFCom, NFGás e DCe.
 *
 * Segurança:
 *  - JWT obrigatório + membership na empresa (helper da casa `authenticate`).
 *  - O token da Focus NUNCA trafega pelo front nem vive em coluna: fica no
 *    Vault e é lido aqui pelo RPC `get_focus_token`, que só o service_role
 *    executa.
 *  - Homologação e produção têm tokens distintos; o ambiente sai da
 *    `focus_config` da empresa, não do corpo da requisição, para ninguém
 *    emitir em produção "sem querer".
 *
 * POST /focus-nfe  { action, companyId, ... }
 *   action=test        valida o token (GET /empresas)
 *   action=emitir      { tipo, referencia, dados }
 *   action=consultar   { tipo, referencia, completa? }
 *   action=cancelar    { tipo, referencia, justificativa }
 *   action=cnpj        { cnpj }              consulta cadastral (preenche tomador)
 *   action=municipio   { codigo, detalhe? }  itens da lista de serviço / código tributário
 *   action=api         { method, path, params?, body? }  escape hatch
 */

import { authenticate, jsonResp } from "../_shared/auth.ts";
import { corsPreflightResponse } from "../_shared/cors.ts";

const HOSTS = {
  homologacao: "https://homologacao.focusnfe.com.br/v2",
  producao: "https://api.focusnfe.com.br/v2",
} as const;

/** Emissão tem path próprio; consulta/cancelamento do CT-e OS e Simplificado caem no /cte. */
const EMIT_PATHS: Record<string, string> = {
  nfe: "/nfe", nfce: "/nfce", nfse: "/nfse", nfsen: "/nfsen",
  cte: "/cte", cte_os: "/cte_os", cte_simp: "/cte_simp",
  mdfe: "/mdfe", nfcom: "/nfcom", nfgas: "/nfgas", dce: "/dce",
};
function consultaPath(tipo: string): string {
  if (tipo === "cte_os" || tipo === "cte_simp") return "/cte";
  return EMIT_PATHS[tipo] ?? "";
}

interface FocusCall {
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  params?: Record<string, unknown>;
  body?: unknown;
}

async function callFocus(base: string, token: string, c: FocusCall) {
  const url = new URL(base + (c.path.startsWith("/") ? c.path : `/${c.path}`));
  for (const [k, v] of Object.entries(c.params ?? {})) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  }
  // Focus autentica em HTTP Basic com o token como usuário e senha VAZIA.
  const res = await fetch(url.toString(), {
    method: c.method,
    redirect: "manual",
    headers: {
      Authorization: "Basic " + btoa(`${token}:`),
      Accept: "application/json",
      ...(c.body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    ...(c.body !== undefined ? { body: JSON.stringify(c.body) } : {}),
  });

  if (res.status >= 300 && res.status < 400) {
    return { ok: true, status: res.status, data: { arquivo_url: res.headers.get("location") } };
  }
  const text = await res.text();
  let data: unknown = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text.slice(0, 4000); }
  return { ok: res.ok, status: res.status, data };
}

Deno.serve(async (req: Request) => {
  const pre = corsPreflightResponse(req);
  if (pre) return pre;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonResp({ error: "JSON inválido" }, 400, {});
  }

  const companyId = String(body.companyId ?? "");
  if (!companyId) return jsonResp({ error: "companyId é obrigatório" }, 400, {});

  const auth = await authenticate(req, { requireCompany: companyId });
  if (auth instanceof Response) return auth;
  const { supabase, corsHeaders } = auth;

  const action = String(body.action ?? "");

  // Config da empresa (ambiente + flags). Ausente = integração nunca configurada.
  const { data: cfg } = await supabase
    .from("focus_config")
    .select("*")
    .eq("company_id", companyId)
    .maybeSingle();

  const ambiente = (cfg?.environment ?? "homologacao") as keyof typeof HOSTS;
  const base = HOSTS[ambiente] ?? HOSTS.homologacao;

  const { data: token, error: tokErr } = await supabase.rpc("get_focus_token", {
    p_company_id: companyId,
    p_environment: ambiente,
  });
  if (tokErr) return jsonResp({ error: `Falha ao ler o token: ${tokErr.message}` }, 500, corsHeaders);
  if (!token) {
    return jsonResp(
      { error: `Token da Focus NFe não configurado para o ambiente de ${ambiente}. Cadastre em Configurações > Integrações > Focus NFe.` },
      400,
      corsHeaders,
    );
  }

  const tipo = String(body.tipo ?? "");
  const referencia = String(body.referencia ?? "");

  let call: FocusCall;
  switch (action) {
    case "test":
      call = { method: "GET", path: "/empresas" };
      break;

    case "emitir": {
      if (!EMIT_PATHS[tipo]) return jsonResp({ error: `Tipo inválido: ${tipo}` }, 400, corsHeaders);
      if (!referencia) return jsonResp({ error: "referencia é obrigatória (chave de idempotência)" }, 400, corsHeaders);
      if (cfg?.active === false) return jsonResp({ error: "Integração Focus NFe está desativada." }, 400, corsHeaders);
      call = { method: "POST", path: EMIT_PATHS[tipo], params: { ref: referencia }, body: body.dados ?? {} };
      break;
    }

    case "consultar":
      if (!consultaPath(tipo)) return jsonResp({ error: `Tipo inválido: ${tipo}` }, 400, corsHeaders);
      call = {
        method: "GET",
        path: `${consultaPath(tipo)}/${referencia}`,
        params: body.completa ? { completa: 1 } : {},
      };
      break;

    case "cancelar": {
      const justificativa = String(body.justificativa ?? "");
      if (justificativa.trim().length < 15) {
        return jsonResp({ error: "A justificativa de cancelamento precisa de ao menos 15 caracteres (exigência da SEFAZ)." }, 400, corsHeaders);
      }
      call = { method: "DELETE", path: `${consultaPath(tipo)}/${referencia}`, body: { justificativa } };
      break;
    }

    case "cnpj":
      call = { method: "GET", path: `/cnpjs/${String(body.cnpj ?? "").replace(/\D/g, "")}` };
      break;

    case "municipio": {
      const codigo = String(body.codigo ?? "");
      const detalhe = String(body.detalhe ?? "");
      const sub = detalhe === "itens_lista_servico"
        ? "/itens_lista_servico"
        : detalhe === "codigos_tributarios" ? "/codigos_tributarios_municipio" : "";
      call = { method: "GET", path: `/municipios/${codigo}${sub}` };
      break;
    }

    case "api":
      call = {
        method: (String(body.method ?? "GET").toUpperCase() as FocusCall["method"]),
        path: String(body.path ?? "/"),
        params: (body.params as Record<string, unknown>) ?? {},
        body: body.body,
      };
      break;

    default:
      return jsonResp({ error: `Ação desconhecida: ${action}` }, 400, corsHeaders);
  }

  const r = await callFocus(base, String(token), call);

  // Telemetria da integração, sem guardar nada sensível.
  if (action === "test") {
    await supabase
      .from("focus_config")
      .update({ last_test_at: new Date().toISOString(), last_test_status: r.ok ? "ok" : `erro_${r.status}` })
      .eq("company_id", companyId);
  } else if (action === "emitir" && r.ok) {
    await supabase.from("focus_config").update({ last_emission_at: new Date().toISOString() }).eq("company_id", companyId);
  }

  return jsonResp({ ok: r.ok, status: r.status, ambiente, data: r.data }, r.ok ? 200 : 400, corsHeaders);
});
