/**
 * Edge function: PlugNotas — NFSe (Nota Fiscal de Serviço Eletrônica)
 *
 * POST /plugnotas-nfse
 * Body: { company_id, operation, params }
 *
 * Operations:
 *  - emitir   POST /nfse                 (body: dados completos da NFSe)
 *  - consultar GET /nfse/consulta?... ou GET /nfse/{idIntegracao}
 *  - cancelar  POST /nfse/cancelamento
 *  - listar    GET  /nfse                (com filtros)
 */

import { bootstrap, plugnotasFetch, logDocument, jsonResponse, toDocumentArray } from "../_shared/plugnotas.ts";

Deno.serve(async (req) => {
  const ctx = await bootstrap(req);
  if (ctx instanceof Response) return ctx;
  const { supabase, companyId, config, corsHeaders, body } = ctx;

  if (!config.enabled_nfse) {
    return jsonResponse({ error: "NFSe não habilitada para esta empresa" }, 409, corsHeaders);
  }

  const operation = body.operation as string | undefined;
  const params = (body.params as Record<string, unknown>) ?? {};
  const invoiceId = body.invoice_id as string | undefined;

  try {
    switch (operation) {
      case "emitir": {
        const res = await plugnotasFetch(config, "/nfse", {
          method: "POST",
          body: JSON.stringify(toDocumentArray(params)),
        });
        const data = res.data as Record<string, unknown> | null;
        await logDocument(supabase, companyId, "nfse", {
          plugnotas_id: (data?.idIntegracao as string) ?? (data?._id as string) ?? null,
          status: res.ok ? "processando" : "erro",
          status_message: res.ok
            ? null
            : JSON.stringify((data as { error?: unknown })?.error ?? data),
          payload_request: params,
          payload_response: data,
          invoice_id: invoiceId ?? null,
          reforma: (body.reforma as { cbs_valor?: number; ibs_valor?: number; cbs_aliquota?: number; ibs_aliquota?: number; cclasstrib?: string } | undefined) ?? null,
        });
        return jsonResponse(res, res.ok ? 200 : res.status, corsHeaders);
      }

      case "consultar": {
        const id = params.id as string;
        if (!id) return jsonResponse({ error: "id é obrigatório" }, 400, corsHeaders);
        const res = await plugnotasFetch(config, `/nfse/${encodeURIComponent(id)}`);
        return jsonResponse(res, res.ok ? 200 : res.status, corsHeaders);
      }

      case "cancelar": {
        const id = params.id as string;
        const motivo = (params.motivo as string) ?? "Cancelamento solicitado";
        if (!id) return jsonResponse({ error: "id é obrigatório" }, 400, corsHeaders);
        const res = await plugnotasFetch(config, `/nfse/${encodeURIComponent(id)}/cancelamento`, {
          method: "POST",
          body: JSON.stringify({ motivo, ...params }),
        });
        if (res.ok) {
          await supabase
            .from("plugnotas_documents")
            .update({
              status: "cancelado",
              cancelled_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("company_id", companyId)
            .eq("plugnotas_id", id);
        }
        return jsonResponse(res, res.ok ? 200 : res.status, corsHeaders);
      }

      case "listar": {
        const qs = new URLSearchParams(params as Record<string, string>).toString();
        const res = await plugnotasFetch(config, `/nfse${qs ? `?${qs}` : ""}`);
        return jsonResponse(res, res.ok ? 200 : res.status, corsHeaders);
      }

      default:
        return jsonResponse({ error: `Operação inválida: ${operation}` }, 400, corsHeaders);
    }
  } catch (err) {
    console.error("plugnotas-nfse error", err);
    return jsonResponse({ error: "Erro interno", detail: String(err) }, 500, corsHeaders);
  }
});
