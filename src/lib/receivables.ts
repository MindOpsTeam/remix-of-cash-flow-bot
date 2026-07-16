/**
 * Contas a Receber — helpers puros (status por vencimento, totais, rótulos de ciclo).
 * Espelha a disciplina do lib de contas a pagar. Testável.
 */

export type ReceivableStatus = "a_receber" | "recebido" | "vencido" | "cancelado";

export interface ReceivableLike {
  status: string;
  due_date: string; // YYYY-MM-DD
}

/** Deriva o status efetivo: recebido/cancelado são fixos; a_receber vira vencido se passou. */
export function effectiveStatus(r: ReceivableLike, today = new Date()): ReceivableStatus {
  if (r.status === "recebido") return "recebido";
  if (r.status === "cancelado") return "cancelado";
  const todayStr = today.toISOString().slice(0, 10);
  return r.due_date < todayStr ? "vencido" : "a_receber";
}

export const CYCLE_LABEL: Record<string, string> = {
  WEEKLY: "Semanal",
  BIWEEKLY: "Quinzenal",
  MONTHLY: "Mensal",
  QUARTERLY: "Trimestral",
  SEMIANNUALLY: "Semestral",
  YEARLY: "Anual",
};

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  BOLETO: "Boleto",
  PIX: "Pix",
  CREDIT_CARD: "Cartão de crédito",
  UNDEFINED: "A definir",
};

export const RECEIVABLE_STATUS_LABEL: Record<ReceivableStatus, string> = {
  a_receber: "A receber",
  recebido: "Recebido",
  vencido: "Vencido",
  cancelado: "Cancelado",
};

/** Soma por bucket de status efetivo (a_receber, vencido, recebido). */
export function totalsByStatus(rows: Array<ReceivableLike & { amount: number }>, today = new Date()) {
  const acc = { aReceber: 0, vencido: 0, recebido: 0 };
  for (const r of rows) {
    const s = effectiveStatus(r, today);
    if (s === "a_receber") acc.aReceber += Number(r.amount);
    else if (s === "vencido") acc.vencido += Number(r.amount);
    else if (s === "recebido") acc.recebido += Number(r.amount);
  }
  return acc;
}

/** Próximo vencimento de um contrato a partir de um dia de cobrança (1-28). */
export function nextDueDate(billingDay: number, ref = new Date()): string {
  const day = Math.min(Math.max(billingDay, 1), 28);
  const y = ref.getFullYear();
  const m = ref.getMonth();
  const candidate = new Date(y, m, day);
  // Se o dia deste mês já passou, vai para o mês seguinte
  const next = candidate < new Date(y, m, ref.getDate()) ? new Date(y, m + 1, day) : candidate;
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
}
