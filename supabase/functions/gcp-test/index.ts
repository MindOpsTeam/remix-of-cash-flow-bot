/**
 * Teste da credencial do Google Cloud (motor de previsão TimesFM).
 *
 * POR QUE EXISTE
 * A integração `gcp` estava marcada como testável no catálogo e o guia mandava
 * "clique em Testar conexão antes de salvar", mas não havia chamada nenhuma: o
 * botão devolvia "esta integração não tem teste automático". O admin colava um
 * JSON de conta de serviço e só descobria que estava errado dias depois, quando
 * a projeção continuava usando a média em vez do TimesFM, sem avisar.
 *
 * O QUE ESTE TESTE ALCANÇA
 * Faz o OAuth com a chave e roda um SELECT trivial no BigQuery. Isso separa as
 * três falhas que o Google reporta de forma confusa:
 *   - JSON inválido ou chave revogada  → falha no OAuth;
 *   - BigQuery API não ativada         → falha na consulta com 403;
 *   - faturamento inativo              → falha na consulta, e é a causa mais
 *     comum, com mensagem que não diz isso em lugar nenhum.
 */

import { corsPreflightResponse } from "../_shared/cors.ts";
import { authenticate, assertMembership, jsonResp } from "../_shared/auth.ts";
import { parseJsonBody, validate, validateRequired, validateUUID } from "../_shared/validate.ts";
import { getGcpAccessToken, bigQueryConsulta, GcpNaoConfigurado } from "../_shared/gcp.ts";

/** Traduz o erro do Google para a causa provável, que ele nunca nomeia. */
function explicar(mensagem: string): string {
  const m = mensagem.toLowerCase();
  if (m.includes("billing") || m.includes("faturamento")) {
    return "O projeto do Google está sem faturamento ativo. Ative em Faturamento no console: a chave é criada mesmo assim, mas nenhuma consulta roda.";
  }
  if (m.includes("has not been used") || m.includes("api is not enabled") || m.includes("accessnotconfigured")) {
    return "A BigQuery API não está ativada neste projeto. Ative em APIs e serviços e tente de novo em um minuto.";
  }
  if (m.includes("permission") || m.includes("denied") || m.includes("403")) {
    return "A conta de serviço não tem permissão para executar consulta. Confira se o papel é BigQuery Job User.";
  }
  if (m.includes("invalid_grant") || m.includes("invalid jwt") || m.includes("unauthorized_client")) {
    return "A chave não foi aceita pelo Google. Ela pode ter sido revogada, ou o conteúdo colado não é o JSON inteiro da conta de serviço.";
  }
  return mensagem;
}

Deno.serve(async (req) => {
  const preflight = corsPreflightResponse(req);
  if (preflight) return preflight;

  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const { user, supabase, corsHeaders } = auth;

  try {
    const parsed = await parseJsonBody(req);
    if ("error" in parsed) return jsonResp({ error: parsed.error }, 400, corsHeaders);
    const { company_id } = parsed.data;

    const invalido = validate(
      validateRequired(parsed.data, ["company_id"]),
      validateUUID(company_id, "company_id"),
    );
    if (invalido) return jsonResp({ error: invalido }, 400, corsHeaders);

    const forbidden = await assertMembership(supabase, user.id, company_id as string, corsHeaders);
    if (forbidden) return forbidden;

    let token: string;
    let projectId: string;
    try {
      ({ token, projectId } = await getGcpAccessToken(supabase, company_id as string));
    } catch (e) {
      if (e instanceof GcpNaoConfigurado) {
        return jsonResp(
          { error: "Nenhuma chave do Google salva para esta empresa. Cole o JSON da conta de serviço e salve antes de testar." },
          400,
          corsHeaders,
        );
      }
      return jsonResp({ error: explicar(e instanceof Error ? e.message : String(e)) }, 400, corsHeaders);
    }

    // Consulta trivial: não lê dado nenhum e mesmo assim exercita o caminho
    // inteiro (autenticação, API ativa, faturamento). Testar só o OAuth daria
    // verde para um projeto que não executa consulta nenhuma.
    try {
      await bigQueryConsulta(token, projectId, "SELECT 1 AS ok");
    } catch (e) {
      return jsonResp({ error: explicar(e instanceof Error ? e.message : String(e)) }, 400, corsHeaders);
    }

    return jsonResp(
      { ok: true, projeto: projectId, mensagem: `Google conectado no projeto ${projectId}. O BigQuery aceitou a consulta.` },
      200,
      corsHeaders,
    );
  } catch (error) {
    console.error("[gcp-test]", error);
    return jsonResp({ error: "Não consegui testar a credencial do Google." }, 500, corsHeaders);
  }
});
