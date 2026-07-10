/**
 * Edge function: PlugNotas — NFe (Nota Fiscal Eletrônica modelo 55)
 *
 * POST /plugnotas-nfe
 * Body: { company_id, operation, params }
 *
 * Operations:
 *  - emitir         POST /nfe
 *  - consultar      GET  /nfe/{idIntegracao}
 *  - cancelar       POST /nfe/{idIntegracao}/cancelamento
 *  - cartaCorrecao  POST /nfe/{idIntegracao}/cce
 *  - listar         GET  /nfe?...
 */

import { bootstrap, plugnotasFetch, logDocument, jsonResponse, toDocumentArray } from "../_shared/plugnotas.ts";

Deno.serve(async (req) => {
  const ctx = await bootstrap(req);
  if (ctx instanceof Response) return ctx;
  const { supabase, companyId, config, corsHeaders, body } = ctx;

  if (!config.enabled_nfe) {
    return jsonResponse({ error: "NFe não habilitada para esta empresa" }, 409, corsHeaders);
  }

  const operation = body.operation as string | undefined;
  const params = (body.params as Record<string, unknown>) ?? {};
  const invoiceId = body.invoice_id as string | undefined;

  try {
    switch (operation) {
      case "emitir": {
        const res = await plugnotasFetch(config, "/nfe", {
          method: "POST",
          body: JSON.stringify(toDocumentArray(params)),
        });
        const data = res.data as Record<string, unknown> | null;
        await logDocument(supabase, companyId, "nfe", {
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
        const res = await plugnotasFetch(config, `/nfe/${encodeURIComponent(id)}`);
        return jsonResponse(res, res.ok ? 200 : res.status, corsHeaders);
      }

      case "cancelar": {
        const id = params.id as string;
        const justificativa = (params.justificativa as string) ?? "Cancelamento solicitado";
        if (!id) return jsonResponse({ error: "id é obrigatório" }, 400, corsHeaders);
        const res = await plugnotasFetch(config, `/nfe/${encodeURIComponent(id)}/cancelamento`, {
          method: "POST",
          body: JSON.stringify({ justificativa, ...params }),
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

      case "cartaCorrecao": {
        const id = params.id as string;
        if (!id) return jsonResponse({ error: "id é obrigatório" }, 400, corsHeaders);
        const res = await plugnotasFetch(config, `/nfe/${encodeURIComponent(id)}/cce`, {
          method: "POST",
          body: JSON.stringify(params),
        });
        return jsonResponse(res, res.ok ? 200 : res.status, corsHeaders);
      }

      case "listar": {
        const qs = new URLSearchParams(params as Record<string, string>).toString();
        const res = await plugnotasFetch(config, `/nfe${qs ? `?${qs}` : ""}`);
        return jsonResponse(res, res.ok ? 200 : res.status, corsHeaders);
      }

      default:
        return jsonResponse({ error: `Operação inválida: ${operation}` }, 400, corsHeaders);
    }
  } catch (err) {
    console.error("plugnotas-nfe error", err);
    return jsonResponse({ error: "Erro interno", detail: String(err) }, 500, corsHeaders);
  }
});
