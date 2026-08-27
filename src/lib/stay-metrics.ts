/**
 * Indicadores de locação por temporada (STAY).
 *
 * Módulo puro: nenhuma dependência de React, Supabase ou rede. A regra de
 * negócio da hotelaria mora aqui para poder ser testada isoladamente — o que
 * aparece na tela é só a leitura destes números.
 */

export interface ReservaMetrica {
  unit_id: string;
  check_in: string; // ISO yyyy-mm-dd
  check_out: string; // ISO yyyy-mm-dd
  nights: number;
  lodging_total: number;
  cleaning_fee: number;
  extras_total: number;
  gross_total: number;
  channel_commission: number;
  payment_fee: number;
  taxes: number;
  cleaning_cost: number;
  owner_payout: number;
  net_total: number;
  status: string;
  channel_id: string | null;
}

export interface Periodo {
  /** Primeiro dia considerado (ISO yyyy-mm-dd). */
  inicio: string;
  /** Último dia considerado, inclusivo (ISO yyyy-mm-dd). */
  fim: string;
}

/** Status que não geram receita nem ocupam a unidade. */
const STATUS_IGNORADOS = new Set(["cancelada", "no_show", "bloqueio"]);

export function reservaVale(r: ReservaMetrica): boolean {
  return !STATUS_IGNORADOS.has(r.status);
}

function dias(inicio: string, fim: string): number {
  const a = Date.parse(`${inicio}T00:00:00Z`);
  const b = Date.parse(`${fim}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

/** Noites de uma reserva que caem dentro do período (interseção). */
export function noitesNoPeriodo(r: ReservaMetrica, p: Periodo): number {
  const inicio = r.check_in > p.inicio ? r.check_in : p.inicio;
  // check_out é dia de saída: a última noite é a véspera. O período é inclusivo,
  // então a fronteira superior das noites é o dia seguinte ao fim.
  const fimPeriodoExclusivo = somarDias(p.fim, 1);
  const fim = r.check_out < fimPeriodoExclusivo ? r.check_out : fimPeriodoExclusivo;
  return dias(inicio, fim);
}

export function somarDias(data: string, n: number): string {
  const t = Date.parse(`${data}T00:00:00Z`) + n * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

/** Quantidade de noites disponíveis: dias do período × unidades em operação. */
export function noitesDisponiveis(p: Periodo, unidadesAtivas: number): number {
  return dias(p.inicio, somarDias(p.fim, 1)) * Math.max(0, unidadesAtivas);
}

export interface IndicadoresStay {
  /** Soma das diárias (sem taxas). */
  receitaHospedagem: number;
  /** Soma das taxas de limpeza cobradas do hóspede. */
  receitaLimpeza: number;
  /** Demais taxas e serviços. */
  receitaExtras: number;
  receitaBruta: number;
  comissoesCanal: number;
  taxasPagamento: number;
  impostos: number;
  custoLimpeza: number;
  repasseProprietarios: number;
  resultadoLiquido: number;
  noitesVendidas: number;
  noitesDisponiveis: number;
  /** 0 a 1. */
  ocupacao: number;
  /** Diária média realizada = receita de hospedagem ÷ noites vendidas. */
  adr: number;
  /** Receita de hospedagem ÷ noites disponíveis. */
  revpar: number;
  reservas: number;
}

const ZERO: IndicadoresStay = {
  receitaHospedagem: 0,
  receitaLimpeza: 0,
  receitaExtras: 0,
  receitaBruta: 0,
  comissoesCanal: 0,
  taxasPagamento: 0,
  impostos: 0,
  custoLimpeza: 0,
  repasseProprietarios: 0,
  resultadoLiquido: 0,
  noitesVendidas: 0,
  noitesDisponiveis: 0,
  ocupacao: 0,
  adr: 0,
  revpar: 0,
  reservas: 0,
};

/**
 * Consolida as reservas do período. Reservas que atravessam a fronteira do mês
 * entram proporcionalmente às noites que caem dentro dele — senão o mês de
 * check-in inflaria e o seguinte apareceria vazio.
 */
export function calcularIndicadores(
  reservas: ReservaMetrica[],
  periodo: Periodo,
  unidadesAtivas: number,
): IndicadoresStay {
  const disponiveis = noitesDisponiveis(periodo, unidadesAtivas);
  const acc: IndicadoresStay = { ...ZERO, noitesDisponiveis: disponiveis };

  for (const r of reservas) {
    if (!reservaVale(r)) continue;
    const noites = noitesNoPeriodo(r, periodo);
    if (noites <= 0) continue;

    const proporcao = r.nights > 0 ? noites / r.nights : 1;
    const p = (v: number) => (Number(v) || 0) * proporcao;

    acc.reservas += 1;
    acc.noitesVendidas += noites;
    acc.receitaHospedagem += p(r.lodging_total);
    acc.receitaLimpeza += p(r.cleaning_fee);
    acc.receitaExtras += p(r.extras_total);
    acc.receitaBruta += p(r.gross_total);
    acc.comissoesCanal += p(r.channel_commission);
    acc.taxasPagamento += p(r.payment_fee);
    acc.impostos += p(r.taxes);
    acc.custoLimpeza += p(r.cleaning_cost);
    acc.repasseProprietarios += p(r.owner_payout);
    acc.resultadoLiquido += p(r.net_total);
  }

  acc.ocupacao = disponiveis > 0 ? acc.noitesVendidas / disponiveis : 0;
  acc.adr = acc.noitesVendidas > 0 ? acc.receitaHospedagem / acc.noitesVendidas : 0;
  acc.revpar = disponiveis > 0 ? acc.receitaHospedagem / disponiveis : 0;

  return acc;
}

export interface AgrupamentoStay {
  chave: string;
  receitaBruta: number;
  resultadoLiquido: number;
  noitesVendidas: number;
  reservas: number;
}

/** Agrupa as reservas do período por uma chave qualquer (unidade, canal…). */
export function agruparPor(
  reservas: ReservaMetrica[],
  periodo: Periodo,
  chaveDe: (r: ReservaMetrica) => string,
): AgrupamentoStay[] {
  const mapa = new Map<string, AgrupamentoStay>();

  for (const r of reservas) {
    if (!reservaVale(r)) continue;
    const noites = noitesNoPeriodo(r, periodo);
    if (noites <= 0) continue;

    const chave = chaveDe(r);
    const proporcao = r.nights > 0 ? noites / r.nights : 1;
    const atual = mapa.get(chave) ?? {
      chave,
      receitaBruta: 0,
      resultadoLiquido: 0,
      noitesVendidas: 0,
      reservas: 0,
    };
    atual.receitaBruta += (Number(r.gross_total) || 0) * proporcao;
    atual.resultadoLiquido += (Number(r.net_total) || 0) * proporcao;
    atual.noitesVendidas += noites;
    atual.reservas += 1;
    mapa.set(chave, atual);
  }

  return [...mapa.values()].sort((a, b) => b.receitaBruta - a.receitaBruta);
}

/** Primeiro e último dia do mês de referência (ISO yyyy-mm-dd). */
export function mesPeriodo(referencia: string): Periodo {
  const inicio = `${referencia.slice(0, 7)}-01`;
  const d = new Date(`${inicio}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 1);
  const fim = new Date(d.getTime() - 86_400_000).toISOString().slice(0, 10);
  return { inicio, fim };
}
