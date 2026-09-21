/**
 * Regras puras da API pública v1.
 *
 * Moram aqui, e não dentro de `public-api/index.ts`, porque aquele arquivo
 * chama `Deno.serve` no topo: importá-lo de um teste subiria um servidor. O que
 * decide se uma chave lê uma rota é justamente o que precisa de teste.
 */

/**
 * Escopo exigido por rota.
 *
 * `read` é o guarda-chuva — é o default de `api_keys.scopes` desde
 * 20260709050000_api_keys.sql, então nenhuma chave já emitida perde acesso
 * quando a verificação passa a valer.
 */
export const ESCOPO_DA_ROTA: Record<string, string> = {
  "/v1/ping": "read",
  "/v1/transactions": "transactions:read",
  "/v1/margin": "margin:read",
  "/v1/invoices": "invoices:read",
  "/v1/bills": "bills:read",
  /*
   * A ponte com o Prova.
   *
   * Escopo de transação, não um escopo novo: é exatamente isso que ela lê —
   * receita conciliada do período. Um `prova:read` próprio daria a impressão
   * de um acesso diferente do que existe, e quem revoga transação esperaria,
   * com razão, que a ponte parasse junto.
   */
  "/v1/prova/receita": "transactions:read",
  "/v1/prova/identidade": "read",
};

export const STATUS_DE_CONTA = ["a_vencer", "vencido", "pago"];

/**
 * A chave alcança a rota?
 *
 * Até 29/08/2026 `scopes` era lido da linha e nunca comparado com nada: uma
 * chave criada "só para o faturamento" lia contas a pagar igual. O campo existia
 * e mentia, que é pior que não existir — quem cria a chave acredita nele.
 */
export function temEscopo(scopes: unknown, exigido: string): boolean {
  if (!Array.isArray(scopes)) return false;
  return scopes.includes("read") || scopes.includes(exigido);
}

/**
 * Normaliza o caminho depois do nome da função.
 *
 * Aceitar `/v1/margin` e `/v1/margin/` como a mesma coisa evita que uma barra a
 * mais escape do mapa de escopos e caia num 404 confuso.
 */
export function caminhoDaRota(pathname: string): string {
  return pathname.replace(/^.*\/public-api/, "").replace(/\/$/, "") || "/";
}

/**
 * Só YYYY-MM-DD, e só se for um dia que existe.
 *
 * `from`/`to` iam crus para o filtro do PostgREST. Data inválida virava erro
 * 500 sem explicação; e valor livre indo para dentro de um filtro é superfície
 * que não precisa existir num endpoint que só aceita data.
 */
export function dataValida(valor: string | null): string | null {
  if (!valor) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return null;
  const d = new Date(`${valor}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10) === valor ? valor : null;
}

/** Teto de linhas por resposta; `limit` maior que isto é aparado, não recusado. */
export function limiteDaBusca(bruto: string | null, teto = 500): number {
  const n = parseInt(bruto ?? "100", 10);
  if (!Number.isFinite(n) || n <= 0) return 100;
  return Math.min(n, teto);
}
