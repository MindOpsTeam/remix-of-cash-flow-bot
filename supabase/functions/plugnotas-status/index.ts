/**
 * Edge function: PlugNotas — Status / health check
 *
 * Centraliza:
 *  - ping na conta PlugNotas (valida a api_key)
 *  - consulta universal: dado um doc_type + id, retorna o status atual
 *  - atualiza plugnotas_documents.status quando confirmamos autorização
 *
 * POST /plugnotas-status
 * Body: { company_id, operation: 'ping'|'consultar', params? }
 */

import { bootstrap, plugnotasFetch, jsonResponse } from "../_shared/plugnotas.ts";

const ENDPOINTS_BY_TYPE: Record<string, string> = {
  nfe: "/nfe",
  nfse: "/nfse",
  nfce: "/nfce",
  cte: "/cte",
  mdfe: "/mdfe",
};

Deno.serve(async (req) => {
  const ctx = await bootstrap(req);
  if (ctx instanceof Response) return ctx;
  const { supabase, companyId, config, corsHeaders, body } = ctx;
  const operation = body.operation as string | undefined;
  const params = (body.params as Record<string, unknown>) ?? {};

  try {
    switch (operation) {
      case "ping": {
        const res = await plugnotasFetch(config, "/empresa");
        await supabase
          .from("plugnotas_config")
          .update({
            last_test_at: new Date().toISOString(),
            last_test_status: res.ok ? "ok" : `http_${res.status}`,
            updated_at: new Date().toISOString(),
          })
          .eq("company_id", companyId);
        return jsonResponse(
          { ok: res.ok, status: res.status, environment: config.environment, data: res.data },
          200,
          corsHeaders,
        );
      }

      case "consultar": {
        const docType = params.doc_type as string;
        const id = params.id as string;
        if (!docType || !id) {
          return jsonResponse(
            { error: "doc_type e id são obrigatórios" },
            400,
            corsHeaders,
          );
        }
        const base = ENDPOINTS_BY_TYPE[docType];
        if (!base) {
          return jsonResponse({ error: `doc_type inválido: ${docType}` }, 400, corsHeaders);
        }
        const res = await plugnotasFetch(config, `${base}/${encodeURIComponent(id)}`);
        const data = res.data as Record<string, unknown> | null;

        if (res.ok && data) {
          const situacao = (data.situacao as string) ?? (data.status as string) ?? null;
          if (situacao) {
            await supabase
              .from("plugnotas_documents")
              .update({
                status: mapSituacao(situacao),
                status_message: situacao,
                payload_response: data,
                last_check_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq("company_id", companyId)
              .eq("plugnotas_id", id);
          }
        }

        return jsonResponse(res, res.ok ? 200 : res.status, corsHeaders);
      }

      default:
        return jsonResponse({ error: `Operação inválida: ${operation}` }, 400, corsHeaders);
    }
  } catch (err) {
    console.error("plugnotas-status error", err);
    return jsonResponse({ error: "Erro interno", detail: String(err) }, 500, corsHeaders);
  }
});

function mapSituacao(s: string): string {
  const n = s.toLowerCase();
  if (n.includes("autorizad") || n === "concluido") return "autorizado";
  if (n.includes("cancelad")) return "cancelado";
  if (n.includes("rejeitad") || n.includes("denegad") || n.includes("erro")) return "rejeitado";
  if (n.includes("processand") || n.includes("aguardand")) return "processando";
  return "enviado";
}
