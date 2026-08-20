// Domínio de Recorrência (MRR) & Recompra — cálculos puros sobre as views
// v_mrr_movimentos e v_recompra_clientes. Sem fetch, sem React.

export type RecompraStatus = "novo" | "em_dia" | "previsto" | "atrasado" | "perdido";

export interface RecompraCliente {
  contact_id: string;
  name: string;
  whatsapp: string | null;
  n_compras: number;
  primeira_compra: string;
  ultima_compra: string;
  total_gasto: number;
  ticket_medio: number | null;
  intervalo_medio_dias: number | null;
  dias_desde_ultima: number;
  proxima_esperada: string | null;
  tem_contrato: boolean;
  status: RecompraStatus;
}

export interface MrrMes {
  mes: string;
  mrr_ativo: number;
  mrr_novo: number;
  mrr_perdido: number;
  contratos_novos: number;
  contratos_perdidos: number;
}

export const RECOMPRA_STATUS: Record<
  RecompraStatus,
  { label: string; tom: "good" | "warn" | "bad" | "muted"; ordem: number; acao: string }
> = {
  previsto: { label: "Comprar agora", tom: "good", ordem: 0, acao: "Está na janela típica de recompra. Ofereça agora." },
  atrasado: { label: "Atrasado", tom: "warn", ordem: 1, acao: "Passou do intervalo habitual. Reative antes de perder." },
  perdido: { label: "Perdido", tom: "bad", ordem: 2, acao: "Sumiu há mais de 2 ciclos. Campanha de win-back." },
  em_dia: { label: "Em dia", tom: "muted", ordem: 3, acao: "Comprou há pouco. Sem ação por enquanto." },
  novo: { label: "1ª compra", tom: "muted", ordem: 4, acao: "Só uma compra. Ainda sem cadência." },
};

export interface RecompraResumo {
  previstos: number;
  atrasados: number;
  perdidos: number;
  emDia: number;
  novos: number;
  /** Ticket médio somado de previstos + atrasados: a receita quente a buscar. */
  receitaEmJogo: number;
  /** Ticket médio somado dos perdidos: o que já vazou. */
  receitaPerdida: number;
}

export function resumirRecompra(clientes: RecompraCliente[]): RecompraResumo {
  const r: RecompraResumo = {
    previstos: 0, atrasados: 0, perdidos: 0, emDia: 0, novos: 0, receitaEmJogo: 0, receitaPerdida: 0,
  };
  for (const c of clientes) {
    const ticket = Number(c.ticket_medio ?? 0);
    switch (c.status) {
      case "previsto": r.previstos += 1; r.receitaEmJogo += ticket; break;
      case "atrasado": r.atrasados += 1; r.receitaEmJogo += ticket; break;
      case "perdido": r.perdidos += 1; r.receitaPerdida += ticket; break;
      case "em_dia": r.emDia += 1; break;
      case "novo": r.novos += 1; break;
    }
  }
  return r;
}

/** Ordena o radar: oportunidade quente primeiro, maior ticket antes. */
export function ordenarRadar(clientes: RecompraCliente[]): RecompraCliente[] {
  return [...clientes].sort((a, b) => {
    const oa = RECOMPRA_STATUS[a.status].ordem;
    const ob = RECOMPRA_STATUS[b.status].ordem;
    if (oa !== ob) return oa - ob;
    return Number(b.ticket_medio ?? 0) - Number(a.ticket_medio ?? 0);
  });
}

export interface MrrResumo {
  mrrAtual: number;
  mrrNovoMes: number;
  mrrPerdidoMes: number;
  netNewMes: number;
  /** Churn de receita do mês corrente sobre o MRR do mês anterior. */
  churnPct: number;
}

export function resumirMrr(meses: MrrMes[]): MrrResumo {
  if (meses.length === 0) {
    return { mrrAtual: 0, mrrNovoMes: 0, mrrPerdidoMes: 0, netNewMes: 0, churnPct: 0 };
  }
  const ordenados = [...meses].sort((a, b) => a.mes.localeCompare(b.mes));
  const atual = ordenados[ordenados.length - 1];
  const anterior = ordenados[ordenados.length - 2];
  const baseChurn = Number(anterior?.mrr_ativo ?? 0);
  return {
    mrrAtual: Number(atual.mrr_ativo),
    mrrNovoMes: Number(atual.mrr_novo),
    mrrPerdidoMes: Number(atual.mrr_perdido),
    netNewMes: Number(atual.mrr_novo) - Number(atual.mrr_perdido),
    churnPct: baseChurn > 0 ? (Number(atual.mrr_perdido) / baseChurn) * 100 : 0,
  };
}

/**
 * LTV simplificado por receita recorrente: ticket médio recorrente dividido
 * pela taxa de churn mensal. Sem churn não há LTV finito (devolve null).
 */
export function ltvPorChurn(arpaMensal: number, churnPctMensal: number): number | null {
  if (churnPctMensal <= 0) return null;
  return arpaMensal / (churnPctMensal / 100);
}

export function formatarIntervalo(dias: number | null): string {
  if (dias == null || dias <= 0) return "—";
  if (dias < 45) return `${Math.round(dias)} dias`;
  const meses = dias / 30;
  return `~${meses.toFixed(meses < 3 ? 1 : 0)} meses`;
}

// ── INTERVALO ROBUSTO (view v_recompra_robusta)
//
// v_recompra_clientes calcula o intervalo por média: (última − primeira) / (n − 1).
// Uma única compra atípica desloca a média inteira e move o cliente de faixa sem
// que o comportamento dele tenha mudado. A mediana dos intervalos reais não se
// deixa levar por um outlier, e o desvio diz se dá para confiar na data prevista.

export interface RecompraRobusta {
  contact_id: string;
  intervalo_mediano_dias: number | null;
  desvio_dias: number | null;
  n_intervalos: number | null;
}

export type Regularidade = "relogio" | "regular" | "irregular";

export const REGULARIDADE_LABEL: Record<Regularidade, { label: string; ajuda: string }> = {
  relogio: {
    label: "compra no relógio",
    ajuda: "As compras se repetem quase sempre no mesmo intervalo. A data prevista é confiável.",
  },
  regular: {
    label: "cadência regular",
    ajuda: "As compras variam um pouco em torno do intervalo típico.",
  },
  irregular: {
    label: "cadência irregular",
    ajuda: "O intervalo varia muito. Trate a data prevista como referência, não como promessa.",
  },
};

/**
 * Regularidade pelo coeficiente de variação (desvio / intervalo). Devolve null
 * quando há menos de dois intervalos: com um intervalo só não existe dispersão,
 * existe uma coincidência.
 */
export function regularidade(r: RecompraRobusta | undefined | null): Regularidade | null {
  if (!r) return null;
  const intervalo = r.intervalo_mediano_dias ?? 0;
  if (!(intervalo > 0)) return null;
  if ((r.n_intervalos ?? 0) < 2) return null;
  const cv = (r.desvio_dias ?? 0) / intervalo;
  if (cv < 0.15) return "relogio";
  if (cv < 0.4) return "regular";
  return "irregular";
}

/**
 * Quanto a média discorda da mediana, em pontos percentuais do intervalo
 * robusto. Acima de 25% a média está sendo puxada por um outlier e a data
 * prevista pela view antiga não merece confiança.
 */
export function divergenciaIntervalo(
  mediaDias: number | null,
  medianaDias: number | null,
): number | null {
  if (mediaDias == null || medianaDias == null || medianaDias <= 0) return null;
  return Math.abs(mediaDias - medianaDias) / medianaDias;
}

export const DIVERGENCIA_RELEVANTE = 0.25;
