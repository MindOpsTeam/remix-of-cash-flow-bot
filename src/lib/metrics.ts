/**
 * Camada de métricas do cockpit. Tudo puro e testável: os hooks buscam as
 * linhas, este arquivo transforma em número de decisão. Nenhuma métrica aqui
 * inventa precisão que os dados não têm — ponto de equilíbrio, por exemplo,
 * ficou de fora de propósito: sem separar custo fixo de variável, seria chute.
 */

import { effectiveStatus, type ReceivableLike } from "@/lib/receivables";

export interface ReceivableMetricRow extends ReceivableLike {
  amount: number;
}

export interface BillMetricRow {
  valor: number;
  vencimento: string;
  status: string;
}

export interface ContractMetricRow {
  amount: number;
  cycle: string;
  status: string;
}

export interface ClienteMetricRow {
  name: string | null;
  faturado: number | null;
}

export interface AgingBuckets {
  aVencer: number;
  ate15: number;
  de16a30: number;
  acima30: number;
  total: number;
}

const DIA_MS = 86_400_000;

function diasEntre(deIso: string, ateIso: string): number {
  const de = new Date(`${deIso.slice(0, 10)}T00:00:00Z`).getTime();
  const ate = new Date(`${ateIso.slice(0, 10)}T00:00:00Z`).getTime();
  if (Number.isNaN(de) || Number.isNaN(ate)) return 0;
  return Math.round((ate - de) / DIA_MS);
}

/** Fatores de conversão de ciclo Asaas para valor mensal. */
const CICLO_MENSALIZADO: Record<string, number> = {
  WEEKLY: 52 / 12,
  BIWEEKLY: 26 / 12,
  MONTHLY: 1,
  BIMONTHLY: 1 / 2,
  QUARTERLY: 1 / 3,
  SEMIANNUALLY: 1 / 6,
  YEARLY: 1 / 12,
};

/** Receita recorrente mensalizada dos contratos ativos. */
export function mrr(contratos: ContractMetricRow[]): number {
  return contratos
    .filter((c) => c.status === "active")
    .reduce((soma, c) => soma + c.amount * (CICLO_MENSALIZADO[c.cycle] ?? 1), 0);
}

/**
 * Aging por buckets de atraso. Serve para AR (vencimento = due_date) e AP
 * (vencimento = vencimento): dias negativos = a vencer.
 */
export function aging(itens: Array<{ valor: number; vencimento: string }>, hojeIso: string): AgingBuckets {
  const buckets: AgingBuckets = { aVencer: 0, ate15: 0, de16a30: 0, acima30: 0, total: 0 };
  for (const item of itens) {
    const atraso = diasEntre(item.vencimento, hojeIso);
    buckets.total += item.valor;
    if (atraso <= 0) buckets.aVencer += item.valor;
    else if (atraso <= 15) buckets.ate15 += item.valor;
    else if (atraso <= 30) buckets.de16a30 += item.valor;
    else buckets.acima30 += item.valor;
  }
  return buckets;
}

/** Recebíveis em aberto (a_receber + vencido), com status efetivo pela data. */
export function receivablesAbertos(rows: ReceivableMetricRow[], hoje = new Date()): ReceivableMetricRow[] {
  return rows.filter((r) => {
    const s = effectiveStatus(r, hoje);
    return s === "a_receber" || s === "vencido";
  });
}

/** Percentual vencido sobre o total em aberto. Sem aberto, não há inadimplência. */
export function inadimplencia(rows: ReceivableMetricRow[], hoje = new Date()): number {
  const abertos = receivablesAbertos(rows, hoje);
  const total = abertos.reduce((s, r) => s + r.amount, 0);
  if (total <= 0) return 0;
  const vencidos = abertos
    .filter((r) => effectiveStatus(r, hoje) === "vencido")
    .reduce((s, r) => s + r.amount, 0);
  return (vencidos / total) * 100;
}

/**
 * DSO aproximado: saldo em aberto sobre a receita média diária do período.
 * `receitaPeriodo` deve cobrir `diasPeriodo` dias. Sem receita, retorna null
 * (mostrar "—" é mais honesto que mostrar zero).
 */
export function dso(saldoAberto: number, receitaPeriodo: number, diasPeriodo: number): number | null {
  if (receitaPeriodo <= 0 || diasPeriodo <= 0) return null;
  return (saldoAberto / receitaPeriodo) * diasPeriodo;
}

/** DPO com a mesma régua do DSO, sobre custos+despesas do período. */
export function dpo(saldoAPagar: number, saidasPeriodo: number, diasPeriodo: number): number | null {
  if (saidasPeriodo <= 0 || diasPeriodo <= 0) return null;
  return (saldoAPagar / saidasPeriodo) * diasPeriodo;
}

/**
 * Queima média mensal: saídas menos entradas dos últimos meses. Positivo =
 * queimando caixa; negativo = gerando.
 */
export function burnMensal(meses: Array<{ receita: number; custos: number; despesas: number }>): number {
  if (meses.length === 0) return 0;
  const total = meses.reduce((s, m) => s + (m.custos + m.despesas - m.receita), 0);
  return total / meses.length;
}

/**
 * Meses de caixa no ritmo atual. null = sem queima (gerando caixa) ou sem
 * caixa apurado; o widget traduz para "∞" ou "—".
 */
export function runwayMeses(caixa: number | null, burn: number): number | null {
  if (caixa === null || burn <= 0) return null;
  return caixa / burn;
}

/** Concentração: participação do top N clientes no faturado total. */
export function concentracaoClientes(clientes: ClienteMetricRow[], topN = 5): { top: ClienteMetricRow[]; participacaoPct: number } {
  const comFaturado = clientes
    .filter((c) => (c.faturado ?? 0) > 0)
    .sort((a, b) => (b.faturado ?? 0) - (a.faturado ?? 0));
  const total = comFaturado.reduce((s, c) => s + (c.faturado ?? 0), 0);
  const top = comFaturado.slice(0, topN);
  const topTotal = top.reduce((s, c) => s + (c.faturado ?? 0), 0);
  return { top, participacaoPct: total > 0 ? (topTotal / total) * 100 : 0 };
}

/** Progresso de uma meta. `abaixo` = quanto menor, melhor (ex.: inadimplência). */
export function progressoMeta(valor: number, alvo: number, direcao: "acima" | "abaixo"): { pct: number; atingida: boolean } {
  if (direcao === "acima") {
    if (alvo <= 0) return { pct: valor >= alvo ? 100 : 0, atingida: valor >= alvo };
    const pct = Math.max(0, Math.min(100, (valor / alvo) * 100));
    return { pct, atingida: valor >= alvo };
  }
  // "abaixo": meta batida quando o valor está no alvo ou menor. A barra mostra
  // a folga consumida: no alvo = 100%, o dobro do alvo = 0%.
  if (alvo <= 0) return { pct: valor <= alvo ? 100 : 0, atingida: valor <= alvo };
  const excedente = Math.max(0, valor - alvo);
  const pct = Math.max(0, Math.min(100, 100 - (excedente / alvo) * 100));
  return { pct, atingida: valor <= alvo };
}

/** Rótulos e formato das métricas que aceitam meta. Catálogo é código. */
export const METAS_CATALOGO: Record<string, { label: string; formato: "currency" | "percent" }> = {
  receita_mes: { label: "Receita do mês", formato: "currency" },
  resultado_mes: { label: "Resultado do mês", formato: "currency" },
  margem_operacional: { label: "Margem operacional", formato: "percent" },
  mrr: { label: "Receita recorrente (MRR)", formato: "currency" },
  inadimplencia: { label: "Inadimplência", formato: "percent" },
};
