/**
 * Edge function: PlugNotas — Cadastro/consulta de empresa
 *
 * POST /plugnotas-empresa
 * Body: { company_id, operation: 'consultar'|'criar'|'atualizar'|'enviar_certificado', params? }
 *
 * Endpoints PlugNotas:
 * - GET    /empresa/{cnpj}
 * - POST   /empresa
 * - PATCH  /empresa/{cnpj}
 * - POST   /empresa/certificado
 */

import { bootstrap, plugnotasFetch, jsonResponse } from "../_shared/plugnotas.ts";

Deno.serve(async (req) => {
  const ctx = await bootstrap(req);
  if (ctx instanceof Response) return ctx;
  const { supabase, companyId, config, corsHeaders, body } = ctx;
  const operation = body.operation as string | undefined;
  const params = (body.params as Record<string, unknown>) ?? {};

  try {
    switch (operation) {
      case "consultar": {
        const cnpj = (params.cnpj as string) ?? config.plugnotas_empresa_cnpj;
        if (!cnpj) return jsonResponse({ error: "cnpj é obrigatório" }, 400, corsHeaders);
        const res = await plugnotasFetch(config, `/empresa/${encodeURIComponent(cnpj)}`);
        return jsonResponse(res, res.ok ? 200 : res.status, corsHeaders);
      }

      case "criar": {
        const res = await plugnotasFetch(config, "/empresa", {
          method: "POST",
          body: JSON.stringify(params),
        });
        if (res.ok && (params as { cnpj?: string }).cnpj) {
          await supabase
            .from("plugnotas_config")
            .update({
              plugnotas_empresa_cnpj: (params as { cnpj?: string }).cnpj,
              updated_at: new Date().toISOString(),
            })
            .eq("company_id", companyId);
        }
        return jsonResponse(res, res.ok ? 200 : res.status, corsHeaders);
      }

      case "atualizar": {
        const cnpj = (params.cnpj as string) ?? config.plugnotas_empresa_cnpj;
        if (!cnpj) return jsonResponse({ error: "cnpj é obrigatório" }, 400, corsHeaders);
        const res = await plugnotasFetch(config, `/empresa/${encodeURIComponent(cnpj)}`, {
          method: "PATCH",
          body: JSON.stringify(params),
        });
        return jsonResponse(res, res.ok ? 200 : res.status, corsHeaders);
      }

      case "enviar_certificado": {
        // params: { pfx_base64, password }
        const pfx = params.pfx_base64 as string;
        const password = params.password as string;
        if (!pfx || !password) {
          return jsonResponse(
            { error: "pfx_base64 e password são obrigatórios" },
            400,
            corsHeaders,
          );
        }
        // PlugNotas espera multipart/form-data em /empresa/certificado
        const form = new FormData();
        const pfxBytes = Uint8Array.from(atob(pfx), (c) => c.charCodeAt(0));
        form.append(
          "arquivo",
          new Blob([pfxBytes], { type: "application/x-pkcs12" }),
          "certificado.pfx",
        );
        form.append("senha", password);

        const host =
          config.environment === "producao"
            ? "https://api.plugnotas.com.br"
            : "https://api.sandbox.plugnotas.com.br";
        const res = await fetch(`${host}/empresa/certificado`, {
          method: "POST",
          headers: { "X-API-KEY": config.api_key },
          body: form,
        });
        const data = await res.json().catch(() => null);
        return jsonResponse(
          { ok: res.ok, status: res.status, data },
          res.ok ? 200 : res.status,
          corsHeaders,
        );
      }

      default:
        return jsonResponse(
          { error: `Operação inválida: ${operation}` },
          400,
          corsHeaders,
        );
    }
  } catch (err) {
    console.error("plugnotas-empresa error", err);
    return jsonResponse(
      { error: "Erro interno", detail: String(err) },
      500,
      corsHeaders,
    );
  }
});
