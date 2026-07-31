// Janela de período do dashboard: dado o trend mensal já carregado, agrega
// a janela escolhida (um mês, um intervalo ou o ano) e a base de comparação
// equivalente. Puro e testável — não faz fetch nem depende de React.

import { MONTH_LABELS, toTotals, type MarginTotals } from "@/lib/margin";

export type PeriodoMode = "mes" | "intervalo" | "ano";

export interface PeriodoSel {
  mode: PeriodoMode;
  mesKey?: string; // modo "mes"
  inicioKey?: string; // modo "intervalo"
  fimKey?: string; // modo "intervalo"
  ano?: string; // modo "ano" (YYYY)
}

export interface PontoPeriodo {
  key: string; // 'YYYY-MM-DD'
  receita: number;
  custos: number;
  despesas: number;
}

export interface JanelaResultado {
  current: MarginTotals;
  previous: MarginTotals;
  temComparacao: boolean;
  periodoLabel: string; // rótulo longo para o cabeçalho
  comparacaoLabel: string;
}

const MONTH_FULL = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

export function labelMesCurto(key: string): string {
  const [y, m] = key.split("-");
  return `${MONTH_LABELS[Number(m) - 1]}/${y.slice(2)}`;
}

export function labelMesLongo(key: string): string {
  const [y, m] = key.split("-");
  return `${MONTH_FULL[Number(m) - 1]} de ${y}`;
}

function totalsDe(pts: PontoPeriodo[]): MarginTotals {
  return toTotals(pts.map((p) => ({ receita: p.receita, custos: p.custos, despesas: p.despesas })));
}

/** Agrega a janela selecionada + a base de comparação equivalente. */
export function calcularJanela(trend: PontoPeriodo[], sel: PeriodoSel): JanelaResultado {
  const pts = trend;
  const zero = totalsDe([]);
  if (pts.length === 0) {
    return { current: zero, previous: zero, temComparacao: false, periodoLabel: "—", comparacaoLabel: "" };
  }
  const ultimo = pts[pts.length - 1];

  if (sel.mode === "ano") {
    const ano = sel.ano ?? ultimo.key.slice(0, 4);
    const doAno = pts.filter((p) => p.key.slice(0, 4) === ano);
    const anoAnterior = String(Number(ano) - 1);
    const meses = new Set(doAno.map((p) => p.key.slice(5, 7)));
    const doAnterior = pts.filter((p) => p.key.slice(0, 4) === anoAnterior && meses.has(p.key.slice(5, 7)));
    const temComp = doAnterior.length > 0;
    const parcial = doAno.length < 12;
    return {
      current: totalsDe(doAno),
      previous: totalsDe(doAnterior),
      temComparacao: temComp,
      periodoLabel: `Ano ${ano}${parcial ? " (acumulado)" : ""}`,
      comparacaoLabel: temComp ? `vs ${anoAnterior}` : "acumulado do ano",
    };
  }

  if (sel.mode === "intervalo") {
    const iRaw = pts.findIndex((p) => p.key === sel.inicioKey);
    const fRaw = pts.findIndex((p) => p.key === sel.fimKey);
    const iIdx = iRaw === -1 ? 0 : iRaw;
    const fIdx = fRaw === -1 ? pts.length - 1 : fRaw;
    const [lo, hi] = iIdx <= fIdx ? [iIdx, fIdx] : [fIdx, iIdx];
    const slice = pts.slice(lo, hi + 1);
    const len = slice.length;
    const prev = pts.slice(Math.max(0, lo - len), lo);
    const temComp = prev.length === len && len > 0;
    return {
      current: totalsDe(slice),
      previous: totalsDe(prev),
      temComparacao: temComp,
      periodoLabel: `${labelMesCurto(slice[0].key)} – ${labelMesCurto(slice[len - 1].key)}`,
      comparacaoLabel: temComp ? "vs período anterior" : `${len} ${len === 1 ? "mês" : "meses"}`,
    };
  }

  // modo "mes"
  const idxRaw = sel.mesKey ? pts.findIndex((p) => p.key === sel.mesKey) : pts.length - 1;
  const idx = idxRaw === -1 ? pts.length - 1 : idxRaw;
  return {
    current: totalsDe([pts[idx]]),
    previous: idx > 0 ? totalsDe([pts[idx - 1]]) : zero,
    temComparacao: idx > 0,
    periodoLabel: labelMesLongo(pts[idx].key),
    comparacaoLabel: idx > 0 ? "vs mês anterior" : "sem mês anterior",
  };
}
