/**
 * Cliente Pluggy para edge functions (Deno). Cobre o fluxo Open Finance:
 * auth → connect_token → items/accounts/transactions.
 * Schemas em docs/reference/openfinance-apis.md (OpenAPI oficial).
 */

const PLUGGY_BASE = "https://api.pluggy.ai";

export interface PluggyAccount {
  id: string;
  type: string;
  subtype: string;
  number: string;
  name: string;
  marketingName?: string;
  balance: number;
  itemId: string;
  currencyCode: string;
}

export interface PluggyItem {
  id: string;
  status: string;
  connector?: { name?: string; imageUrl?: string };
  consentExpiresAt?: string | null;
}

export interface PluggyCreds {
  clientId?: string | null;
  clientSecret?: string | null;
}

/**
 * Credenciais da Pluggy DA EMPRESA: o par fica no Vault, escrito pela tela de
 * configurações (RPC set_pluggy_credentials) e lido aqui pelo service_role.
 * O env secret continua valendo como fallback, para não derrubar quem já estava
 * conectado antes de existir a tela.
 */
/**
 * Cliente visto de forma mínima: só se usa `.rpc()`.
 *
 * Declarado com assinatura de MÉTODO e devolvendo PromiseLike, e as duas
 * escolhas são necessárias. Como propriedade (`rpc: (fn) => ...`) o TypeScript
 * checa o parâmetro de forma estritamente contravariante e recusa o
 * SupabaseClient real; e o `.rpc()` do supabase-js devolve um builder que é
 * thenable, não uma Promise, então exigir Promise também recusa.
 */
interface ClienteComRpc {
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: unknown }>;
}

export async function pluggyCredsForCompany(
  service: ClienteComRpc,
  companyId: string,
): Promise<PluggyCreds & { origem: "vault" | "env" | "ausente" }> {
  let doCofre: { client_id?: string; client_secret?: string } | null = null;
  try {
    const { data } = await service.rpc("get_pluggy_credentials", { p_company_id: companyId });
    doCofre = (data ?? null) as { client_id?: string; client_secret?: string } | null;
  } catch (_) {
    doCofre = null; // cofre indisponível não pode derrubar a integração
  }
  if (doCofre?.client_id && doCofre?.client_secret) {
    return { clientId: doCofre.client_id, clientSecret: doCofre.client_secret, origem: "vault" };
  }
  const envId = Deno.env.get("PLUGGY_CLIENT_ID");
  const envSecret = Deno.env.get("PLUGGY_CLIENT_SECRET");
  if (envId && envSecret) return { clientId: envId, clientSecret: envSecret, origem: "env" };
  return { clientId: null, clientSecret: null, origem: "ausente" };
}

/** Gera a API Key de curta duração a partir do par client id/secret. */
export async function pluggyAuth(creds?: PluggyCreds): Promise<string> {
  const clientId = creds?.clientId || Deno.env.get("PLUGGY_CLIENT_ID");
  const clientSecret = creds?.clientSecret || Deno.env.get("PLUGGY_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    throw new Error("PLUGGY_NOT_CONFIGURED");
  }
  const res = await fetch(`${PLUGGY_BASE}/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId, clientSecret }),
  });
  if (!res.ok) throw new Error(`pluggy auth failed: ${res.status}`);
  const data = await res.json();
  return data.apiKey as string;
}

async function pluggyGet<T>(apiKey: string, path: string): Promise<T> {
  const res = await fetch(`${PLUGGY_BASE}${path}`, {
    headers: { "X-API-KEY": apiKey, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`pluggy GET ${path} failed: ${res.status}`);
  return (await res.json()) as T;
}

/** Cria um connect token para inicializar o widget Pluggy Connect. */
export async function createConnectToken(
  apiKey: string,
  options: { clientUserId?: string; webhookUrl?: string; itemId?: string },
): Promise<string> {
  const body: Record<string, unknown> = { options: {} };
  if (options.itemId) body.itemId = options.itemId;
  const opts = body.options as Record<string, unknown>;
  if (options.clientUserId) opts.clientUserId = options.clientUserId;
  if (options.webhookUrl) opts.webhookUrl = options.webhookUrl;
  opts.avoidDuplicates = true;

  const res = await fetch(`${PLUGGY_BASE}/connect_token`, {
    method: "POST",
    headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`pluggy connect_token failed: ${res.status}`);
  const data = await res.json();
  return data.accessToken as string;
}

export async function getItem(apiKey: string, itemId: string): Promise<PluggyItem> {
  return pluggyGet<PluggyItem>(apiKey, `/items/${itemId}`);
}

export async function listAccounts(apiKey: string, itemId: string): Promise<PluggyAccount[]> {
  const data = await pluggyGet<{ results: PluggyAccount[] }>(apiKey, `/accounts?itemId=${itemId}`);
  return data.results ?? [];
}

/** Lista transações de uma conta (cursor). `pages` limita as páginas puxadas. */
export async function listTransactions(
  apiKey: string,
  accountId: string,
  opts: { dateFrom?: string; maxPages?: number } = {},
): Promise<unknown[]> {
  const results: unknown[] = [];
  const maxPages = opts.maxPages ?? 5;
  let path = `/v2/transactions?accountId=${accountId}${opts.dateFrom ? `&dateFrom=${opts.dateFrom}` : ""}`;
  for (let page = 0; page < maxPages; page++) {
    const data = await pluggyGet<{ results: unknown[]; next: string | null }>(apiKey, path);
    results.push(...(data.results ?? []));
    if (!data.next) break;
    // `next` é a query string completa (?accountId=...&after=...)
    path = `/v2/transactions${data.next.startsWith("?") ? data.next : `?${data.next}`}`;
  }
  return results;
}

export async function deleteItem(apiKey: string, itemId: string): Promise<void> {
  await fetch(`${PLUGGY_BASE}/items/${itemId}`, {
    method: "DELETE",
    headers: { "X-API-KEY": apiKey },
  });
}
