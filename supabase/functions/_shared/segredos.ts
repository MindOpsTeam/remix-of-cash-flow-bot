import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";

/**
 * Leitura das credenciais de integração, que vivem no Vault.
 *
 * Nome canônico do segredo: integracao:<provider>:<company_id>:<campo>
 * Gravação: RPC `set_integration_secret` (chamada pela UI, exige membership).
 * Leitura : RPC `get_integration_secret`, com EXECUTE só para service_role.
 *
 * As colunas de credencial das tabelas de config foram esvaziadas e o SELECT
 * delas foi revogado do cliente (migration 20260819180000). Ler a coluna aqui
 * devolveria string vazia, então todo acesso passa por este módulo.
 */
export async function segredoDaIntegracao(
  svc: SupabaseClient,
  companyId: string,
  provider: string,
  campo: string,
): Promise<string | null> {
  const { data, error } = await svc.rpc("get_integration_secret", {
    p_company_id: companyId,
    p_provider: provider,
    p_campo: campo,
  });
  if (error) {
    console.error(`[segredos] ${provider}:${campo} falhou:`, error.message);
    return null;
  }
  const valor = (data as string | null) ?? null;
  return valor && valor.length > 0 ? valor : null;
}

/** Lê vários campos do mesmo provider de uma vez. */
export async function segredosDaIntegracao(
  svc: SupabaseClient,
  companyId: string,
  provider: string,
  campos: string[],
): Promise<Record<string, string | null>> {
  const pares = await Promise.all(
    campos.map(async (c) => [c, await segredoDaIntegracao(svc, companyId, provider, c)] as const),
  );
  return Object.fromEntries(pares);
}

/**
 * Resposta padrão quando a credencial não está configurada.
 * 503 com instrução em português apontando onde resolver, nunca 500 mudo.
 */
export function respostaSemCredencial(
  provider: string,
  onde: string,
  corsHeaders: Record<string, string>,
): Response {
  return new Response(
    JSON.stringify({
      error: `Integração ${provider} não configurada. Informe as credenciais em ${onde}.`,
    }),
    { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}
