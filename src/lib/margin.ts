// Domínio de margem (BI) — cálculos puros compartilhados pelo dashboard.
// Fonte de dados: view public.v_company_margin (receita, custos, despesas por empresa/mês).

export interface MarginRow {
  company_id: string;
  month: string; // 'YYYY-MM-DD' (primeiro dia do mês)
  receita: number;
  custos: number;
  despesas: number;
}

export interface MarginTotals {
  receita: number;
  custos: number;
  despesas: number;
  margemBrutaValor: number; // receita - custos
  resultado: number; // receita - custos - despesas
  margemBruta: number; // %
  margemOperacional: number; // %
}

export interface CompanyMargin extends MarginTotals {
  companyId: string;
  orgId: string;
  name: string;
  cnpj: string | null;
}

export const MONTH_LABELS = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

/** Cores estáveis por índice para diferenciar CNPJs nos gráficos combinados. */
export const COMPANY_COLORS = [
  "var(--via-data-1)",
  "var(--via-data-2)",
  "var(--via-navy)",
  "var(--via-success)",
  "var(--via-coral)",
  "var(--via-text-muted)",
];

export function companyColor(index: number): string {
  return COMPANY_COLORS[index % COMPANY_COLORS.length];
}

function pct(part: number, whole: number): number {
  return whole > 0 ? (part / whole) * 100 : 0;
}

/** Consolida uma lista de linhas (receita/custos/despesas) em totais + margens. */
export function toTotals(rows: Array<Pick<MarginRow, "receita" | "custos" | "despesas">>): MarginTotals {
  const receita = sum(rows, (r) => r.receita);
  const custos = sum(rows, (r) => r.custos);
  const despesas = sum(rows, (r) => r.despesas);
  const margemBrutaValor = receita - custos;
  const resultado = margemBrutaValor - despesas;
  return {
    receita,
    custos,
    despesas,
    margemBrutaValor,
    resultado,
    margemBruta: pct(margemBrutaValor, receita),
    margemOperacional: pct(resultado, receita),
  };
}

function sum<T>(items: T[], get: (item: T) => number): number {
  return items.reduce((acc, item) => acc + Number(get(item) || 0), 0);
}

export function formatMonth(iso: string): string {
  // iso = 'YYYY-MM-DD'
  const [year, month] = iso.split("-");
  return `${MONTH_LABELS[Number(month) - 1]}/${year.slice(2)}`;
}

export function formatPercent(value: number, digits = 1): string {
  return `${value.toFixed(digits)}%`;
}

/** Faixa semântica da margem operacional para colorir KPIs/tabelas. */
export function marginTone(marginPct: number): "good" | "warn" | "bad" {
  if (marginPct >= 15) return "good";
  if (marginPct >= 0) return "warn";
  return "bad";
}

export const MARGIN_TONE_CLASS: Record<"good" | "warn" | "bad", string> = {
  good: "text-[hsl(var(--success))]",
  warn: "text-[hsl(var(--warning))]",
  bad: "text-[hsl(var(--destructive))]",
};

/** Gera as N chaves de mês (YYYY-MM-01) terminando no mês atual, mais antigas primeiro. */
export function lastMonthsKeys(count: number, ref = new Date()): string[] {
  const keys: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(ref.getFullYear(), ref.getMonth() - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`);
  }
  return keys;
}
