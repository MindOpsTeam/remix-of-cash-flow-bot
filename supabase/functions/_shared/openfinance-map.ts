/**
 * Mapeamento provider→domínio (cópia Deno de src/lib/openfinance.ts).
 * Mantidos em sincronia manualmente — o teste unitário roda sobre src/.
 */

export interface NormalizedTransaction {
  external_id: string;
  account_external_id: string | null;
  date: string;
  description: string;
  amount: number;
  direction: "revenue" | "expense";
  category: string | null;
  payment_method: string | null;
}

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

export function mapPluggyTransaction(t: PluggyTransaction): NormalizedTransaction {
  const direction: "revenue" | "expense" =
    t.type === "CREDIT" ? "revenue" : t.type === "DEBIT" ? "expense" : t.amount >= 0 ? "revenue" : "expense";
  return {
    external_id: t.id,
    account_external_id: t.accountId ?? null,
    date: t.date.slice(0, 10),
    description: t.description || t.descriptionRaw || "Transação bancária",
    amount: Math.abs(Number(t.amount)),
    direction,
    category: t.category ?? null,
    payment_method: t.paymentData?.paymentMethod ?? null,
  };
}

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
