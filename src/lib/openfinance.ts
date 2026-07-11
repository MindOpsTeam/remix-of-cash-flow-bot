/**
 * Open Finance — mapeamento provider-agnóstico de transações bancárias para o
 * domínio da plataforma. Puro e testável. As edge functions consomem daqui.
 * Ver docs/reference/openfinance-apis.md.
 */

export type OpenFinanceProvider = "pluggy" | "belvo";

/** Transação normalizada, pronta para a tabela bank_transactions_raw. */
export interface NormalizedTransaction {
  external_id: string;
  account_external_id: string | null;
  date: string; // YYYY-MM-DD
  description: string;
  amount: number; // valor absoluto
  direction: "revenue" | "expense";
  category: string | null;
  payment_method: string | null;
}

// ---------- Pluggy ----------

export interface PluggyTransaction {
  id: string;
  description?: string;
  descriptionRaw?: string | null;
  amount: number;
  date: string;
  type?: "DEBIT" | "CREDIT";
  status?: "POSTED" | "PENDING";
  category?: string;
  accountId?: string;
  paymentData?: { paymentMethod?: string } | null;
}

function isoToDate(iso: string): string {
  return iso.slice(0, 10);
}

export function mapPluggyTransaction(t: PluggyTransaction): NormalizedTransaction {
  // O SINAL do amount é a verdade do fluxo (entrou/saiu da conta): negativo =
  // despesa, positivo = receita. O campo `type` (CREDIT/DEBIT) é ambíguo em
  // contas de cartão (o sandbox retorna type=CREDIT para compras com amount
  // negativo), então só é usado como desempate quando amount = 0.
  const amt = Number(t.amount);
  const direction: "revenue" | "expense" =
    amt < 0 ? "expense" : amt > 0 ? "revenue" : t.type === "DEBIT" ? "expense" : "revenue";
  return {
    external_id: t.id,
    account_external_id: t.accountId ?? null,
    date: isoToDate(t.date),
    description: t.description || t.descriptionRaw || "Transação bancária",
    amount: Math.abs(Number(t.amount)),
    direction,
    category: t.category ?? null,
    payment_method: t.paymentData?.paymentMethod ?? null,
  };
}

// ---------- Belvo ----------

export interface BelvoTransaction {
  id: string;
  account?: { id?: string } | null;
  amount: number;
  description?: string;
  value_date?: string;
  accounting_date?: string;
  type?: "INFLOW" | "OUTFLOW";
  status?: string;
  category?: string | null;
}

export function mapBelvoTransaction(t: BelvoTransaction): NormalizedTransaction {
  const direction: "revenue" | "expense" =
    t.type === "INFLOW" ? "revenue" : t.type === "OUTFLOW" ? "expense" : t.amount >= 0 ? "revenue" : "expense";
  return {
    external_id: t.id,
    account_external_id: t.account?.id ?? null,
    date: (t.value_date || t.accounting_date || "").slice(0, 10),
    description: t.description || "Transação bancária",
    amount: Math.abs(Number(t.amount)),
    direction,
    category: t.category ?? null,
    payment_method: null,
  };
}

export function mapTransaction(provider: OpenFinanceProvider, raw: unknown): NormalizedTransaction {
  return provider === "belvo"
    ? mapBelvoTransaction(raw as BelvoTransaction)
    : mapPluggyTransaction(raw as PluggyTransaction);
}

// ---------- Status da conexão ----------

/** Normaliza o status do item Pluggy para o enum da nossa tabela. */
export function normalizePluggyStatus(itemStatus: string): string {
  switch (itemStatus) {
    case "UPDATED": return "updated";
    case "UPDATING": return "updating";
    case "LOGIN_ERROR": return "login_error";
    case "OUTDATED": return "outdated";
    case "WAITING_USER_INPUT": return "waiting_user_input";
    default: return "error";
  }
}

export const CONNECTION_STATUS_LABEL: Record<string, string> = {
  updated: "Conectado",
  updating: "Sincronizando…",
  login_error: "Erro de login — reconectar",
  outdated: "Consentimento expirado — renovar",
  waiting_user_input: "Aguardando ação no banco",
  error: "Erro na conexão",
};

// ---------- Guard de custo (limites da rede OFB) ----------

/** Histórico de 365d: no máximo 8 chamadas/CNPJ/mês. Retorna se pode puxar histórico. */
export const OFB_HISTORY_CALLS_LIMIT = 8;

export function canPullHistory(callsThisMonth: number): boolean {
  return callsThisMonth < OFB_HISTORY_CALLS_LIMIT;
}
