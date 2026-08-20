import type { MesHistorico } from "../forecast.ts";

/**
 * Fatores sazonais por mês do ano.
 *
 * POR QUE
 * A média ponderada trata dezembro como um mês qualquer. Só que dezembro tem
 * décimo terceiro do lado da despesa e costuma ter pico do lado da receita no
 * varejo. Janeiro tem o efeito contrário. Achatar isso é o erro que faz a
 * projeção parecer boa no total do trimestre e errar feio mês a mês, que é
 * justamente quando o caixa aperta.
 *
 * COMO
 * Fator = mediana do mês / mediana geral. MEDIANA, não média: um dezembro
 * atípico não pode virar regra permanente.
 *
 * EXIGE DOIS CICLOS (24 meses). Com um ano só é impossível separar sazonalidade
 * de tendência: um crescimento constante viraria "dezembro é forte" quando na
 * verdade a empresa só cresceu. Preferimos não aplicar a aplicar errado.
 */

export interface FatorMes {
  /** 1 a 12 */
  mes: number;
  fator: number;
  /** quantos anos sustentam esse fator */
  observacoes: number;
}

export const MINIMO_MESES_SAZONALIDADE = 24;

/** Sazonalidade de PME não passa disso; o que passa costuma ser erro de lançamento. */
const FATOR_MIN = 0.5;
const FATOR_MAX = 2.0;

function mediana(v: number[]): number {
  if (!v.length) return 0;
  const ord = [...v].sort((a, b) => a - b);
  const meio = Math.floor(ord.length / 2);
  return ord.length % 2 ? ord[meio] : (ord[meio - 1] + ord[meio]) / 2;
}

function limitar(n: number): number {
  return Math.min(FATOR_MAX, Math.max(FATOR_MIN, n));
}

/** Mês do ano (1-12) a partir de "YYYY-MM". */
function mesDoAno(ym: string): number {
  return Number(ym.slice(5, 7));
}

/**
 * Fatores para uma série. Devolve null quando não há dois ciclos completos.
 */
export function fatoresSazonais(valores: Array<{ mes: string; valor: number }>): FatorMes[] | null {
  if (valores.length < MINIMO_MESES_SAZONALIDADE) return null;

  const geral = mediana(valores.map((v) => v.valor));
  if (!(geral > 0)) return null;

  const porMes = new Map<number, number[]>();
  for (const v of valores) {
    const m = mesDoAno(v.mes);
    if (!m) continue;
    porMes.set(m, [...(porMes.get(m) ?? []), v.valor]);
  }

  const fatores: FatorMes[] = [];
  for (const [mes, lista] of porMes) {
    // um único ano não sustenta fator: cai para neutro
    if (lista.length < 2) {
      fatores.push({ mes, fator: 1, observacoes: lista.length });
      continue;
    }
    fatores.push({ mes, fator: limitar(mediana(lista) / geral), observacoes: lista.length });
  }
  return fatores.sort((a, b) => a.mes - b.mes);
}

/** Aplica o fator do mês alvo sobre a base. Mês sem fator conhecido fica neutro. */
export function aplicarSazonalidade(base: number, mesAlvo: number, fatores: FatorMes[]): number {
  const f = fatores.find((x) => x.mes === mesAlvo);
  return f ? base * f.fator : base;
}

/**
 * Bases mês a mês já ajustadas pela sazonalidade, no formato que projetarCaixa
 * consome. `mesesAlvo` são os meses do ano (1-12) na ordem do horizonte.
 * Devolve null quando não há histórico suficiente: o chamador segue com a base
 * plana, que é o comportamento de sempre.
 */
export function basesSazonais(
  historico: MesHistorico[],
  baseReceita: number,
  baseDespesa: number,
  mesesAlvo: number[],
): Array<{ receita: number; despesa: number }> | null {
  const fatoresReceita = fatoresSazonais(historico.map((h) => ({ mes: h.mes, valor: h.receita })));
  const fatoresDespesa = fatoresSazonais(historico.map((h) => ({ mes: h.mes, valor: h.despesa })));
  if (!fatoresReceita || !fatoresDespesa) return null;

  return mesesAlvo.map((m) => ({
    receita: Math.round(aplicarSazonalidade(baseReceita, m, fatoresReceita) * 100) / 100,
    despesa: Math.round(aplicarSazonalidade(baseDespesa, m, fatoresDespesa) * 100) / 100,
  }));
}
