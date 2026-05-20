/**
 * Edge function: PlugNotas — MDFe (Manifesto Eletrônico de Documentos Fiscais)
 *
 * POST /plugnotas-mdfe
 * Body: { company_id, operation, params }
 *
 * Operations: emitir | consultar | encerrar | cancelar | listar
 */

import { bootstrap, plugnotasFetch, logDocument, jsonResponse, toDocumentArray } from "../_shared/plugnotas.ts";

Deno.serve(async (req) => {
  const ctx = await bootstrap(req);
  if (ctx instanceof Response) return ctx;
  const { supabase, companyId, config, corsHeaders, body } = ctx;

  if (!config.enabled_mdfe) {
    return jsonResponse({ error: "MDFe não habilitado para esta empresa" }, 409, corsHeaders);
  }

  const operation = body.operation as string | undefined;
  const params = (body.params as Record<string, unknown>) ?? {};
  const invoiceId = body.invoice_id as string | undefined;

  try {
    switch (operation) {
      case "emitir": {
        const res = await plugnotasFetch(config, "/mdfe", {
          method: "POST",
          body: JSON.stringify(toDocumentArray(params)),
        });
        const data = res.data as Record<string, unknown> | null;
        await logDocument(supabase, companyId, "mdfe", {
          plugnotas_id: (data?.idIntegracao as string) ?? (data?._id as string) ?? null,
          status: res.ok ? "processando" : "erro",
          status_message: res.ok
            ? null
            : JSON.stringify((data as { error?: unknown })?.error ?? data),
          payload_request: params,
          payload_response: data,
          invoice_id: invoiceId ?? null,
        });
        return jsonResponse(res, res.ok ? 200 : res.status, corsHeaders);
      }

      case "consultar": {
        const id = params.id as string;
        if (!id) return jsonResponse({ error: "id é obrigatório" }, 400, corsHeaders);
        const res = await plugnotasFetch(config, `/mdfe/${encodeURIComponent(id)}`);
        return jsonResponse(res, res.ok ? 200 : res.status, corsHeaders);
      }

      case "encerrar": {
        const id = params.id as string;
        if (!id) return jsonResponse({ error: "id é obrigatório" }, 400, corsHeaders);
        const res = await plugnotasFetch(config, `/mdfe/${encodeURIComponent(id)}/encerramento`, {
          method: "POST",
          body: JSON.stringify(params),
        });
        return jsonResponse(res, res.ok ? 200 : res.status, corsHeaders);
      }

      case "cancelar": {
        const id = params.id as string;
        const justificativa = (params.justificativa as string) ?? "Cancelamento solicitado";
        if (!id) return jsonResponse({ error: "id é obrigatório" }, 400, corsHeaders);
        const res = await plugnotasFetch(config, `/mdfe/${encodeURIComponent(id)}/cancelamento`, {
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

      case "listar": {
        const qs = new URLSearchParams(params as Record<string, string>).toString();
        const res = await plugnotasFetch(config, `/mdfe${qs ? `?${qs}` : ""}`);
        return jsonResponse(res, res.ok ? 200 : res.status, corsHeaders);
      }

      default:
        return jsonResponse({ error: `Operação inválida: ${operation}` }, 400, corsHeaders);
    }
  } catch (err) {
    console.error("plugnotas-mdfe error", err);
    return jsonResponse({ error: "Erro interno", detail: String(err) }, 500, corsHeaders);
  }
});
