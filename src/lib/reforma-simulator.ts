/**
 * Simulador de REGIME na Reforma Tributária (LC 214/2025) — compara, ano a ano
 * (2027-2033), a carga tributária de uma empresa de SERVIÇOS/comércio sob três
 * caminhos:
 *
 *   1. Simples Nacional (padrão)      — DAS unificado; CBS/IBS "por dentro", NÃO
 *                                        gera crédito cheio ao cliente B2B.
 *   2. Simples Híbrido (CBS/IBS fora) — mantém o Simples para IRPJ/CSLL/CPP mas
 *                                        recolhe CBS/IBS no regime regular →
 *                                        gera crédito ao cliente (LC 214, art. 41).
 *   3. Regime Normal (Lucro Presumido) — CBS/IBS cheio + IRPJ/CSLL/CPP.
 *
 * É um MODELO GERENCIAL de apoio à decisão, TODO em cima de estimativas: a
 * alíquota de referência do IVA dual (~26,5%) e o cronograma de transição ainda
 * dependem de resolução do Senado / regulamentação. As constantes abaixo são o
 * ÚNICO ponto a atualizar quando os números fecharem. Não substitui parecer de
 * contador — a decisão é da empresa + contador.
 *
 * Puro e testável. Sem I/O.
 */

// ───────────────────────── Constantes de referência (ajustáveis) ─────────────

/** Alíquota de referência do IVA dual (estimativa oficial ~26,5%). */
export const IVA_REF = {
  /** CBS (federal) — substitui PIS/COFINS. */
  cbs: 8.8,
  /** IBS (estadual+municipal) — substitui ICMS/ISS. */
  ibs: 17.7,
} as const;

/** Alíquota cheia de referência do IVA (CBS + IBS). */
export const IVA_REF_TOTAL = IVA_REF.cbs + IVA_REF.ibs;

export const ANOS_PROJECAO = [2027, 2028, 2029, 2030, 2031, 2032, 2033] as const;
export type AnoProjecao = (typeof ANOS_PROJECAO)[number];

/**
 * Fração da alíquota CBS aplicada por ano. CBS entra CHEIA em 2027 (PIS/COFINS
 * extintos no mesmo ano).
 */
export function cbsFracao(ano: number): number {
  return ano >= 2027 ? 1 : 0;
}

/**
 * Fração da alíquota IBS de referência por ano. 2027-2028 seguem em fase de
 * teste (~0,1%, tratado como ~0 gerencialmente); 2029-2032 sobem 10pp/ano
 * enquanto ICMS/ISS caem na mesma proporção; 2033 IBS integral.
 */
export function ibsFracao(ano: number): number {
  switch (ano) {
    case 2027:
    case 2028: return 0;
    case 2029: return 0.10;
    case 2030: return 0.20;
    case 2031: return 0.30;
    case 2032: return 0.40;
    default: return ano >= 2033 ? 1 : 0;
  }
}

/**
 * Fração do ISS legado (serviços) que ainda incide, complementar à subida do
 * IBS. Some totalmente em 2033. Base ISS estimada em ISS_BASE.
 */
export function issFracaoLegado(ano: number): number {
  if (ano <= 2028) return 1;
  if (ano >= 2033) return 0;
  // 2029..2032 → 0,90 / 0,80 / 0,70 / 0,60
  return 1 - ibsFracao(ano);
}

/** ISS médio de referência para serviços (estimativa, municípios variam 2%-5%). */
export const ISS_BASE = 5;

// ───────────────────────── Simples Nacional (anexos) ─────────────────────────

export type AnexoSimples = "I" | "III" | "V";

interface FaixaSimples {
  ate: number;      // teto de RBT12 da faixa
  nominal: number;  // alíquota nominal (%)
  deduz: number;    // parcela a deduzir (R$)
}

/** Tabelas 2024 (LC 123/2006 anexos). Comércio (I) e serviços (III/V). */
const TABELAS_SIMPLES: Record<AnexoSimples, FaixaSimples[]> = {
  I: [
    { ate: 180_000, nominal: 4.0, deduz: 0 },
    { ate: 360_000, nominal: 7.3, deduz: 5_940 },
    { ate: 720_000, nominal: 9.5, deduz: 13_860 },
    { ate: 1_800_000, nominal: 10.7, deduz: 22_500 },
    { ate: 3_600_000, nominal: 14.3, deduz: 87_300 },
    { ate: 4_800_000, nominal: 19.0, deduz: 378_000 },
  ],
  III: [
    { ate: 180_000, nominal: 6.0, deduz: 0 },
    { ate: 360_000, nominal: 11.2, deduz: 9_360 },
    { ate: 720_000, nominal: 13.5, deduz: 17_640 },
    { ate: 1_800_000, nominal: 16.0, deduz: 35_640 },
    { ate: 3_600_000, nominal: 21.0, deduz: 125_640 },
    { ate: 4_800_000, nominal: 33.0, deduz: 648_000 },
  ],
  V: [
    { ate: 180_000, nominal: 15.5, deduz: 0 },
    { ate: 360_000, nominal: 18.0, deduz: 4_500 },
    { ate: 720_000, nominal: 19.5, deduz: 9_900 },
    { ate: 1_800_000, nominal: 20.5, deduz: 17_100 },
    { ate: 3_600_000, nominal: 23.0, deduz: 62_100 },
    { ate: 4_800_000, nominal: 30.5, deduz: 540_000 },
  ],
};

/** Fração do DAS que corresponde a tributos "por dentro" creditáveis ao cliente
 * (ICMS/ISS + PIS/COFINS) — o que o Híbrido passa a recolher por fora.
 * Estimativa por anexo. */
const FRACAO_INDIRETA_DAS: Record<AnexoSimples, number> = {
  I: 0.55,   // comércio: ICMS pesa mais
  III: 0.42, // serviços
  V: 0.42,
};

/** Alíquota efetiva do Simples pela RBT12 e anexo (%). Acima do teto → NaN. */
export function simplesAliquotaEfetiva(rbt12: number, anexo: AnexoSimples): number {
  if (rbt12 <= 0) return 0;
  const faixas = TABELAS_SIMPLES[anexo];
  const faixa = faixas.find((f) => rbt12 <= f.ate) ?? null;
  if (!faixa) return NaN; // desenquadrado do Simples
  const efetiva = (rbt12 * (faixa.nominal / 100) - faixa.deduz) / rbt12;
  return round4(efetiva * 100);
}

/** Fator R: folha 12m / receita 12m. ≥ 28% → anexo III; senão anexo V. */
export function anexoPorFatorR(folha12: number, receita12: number): AnexoSimples {
  if (receita12 <= 0) return "V";
  return folha12 / receita12 >= 0.28 ? "III" : "V";
}

// ───────────────────────── Entrada / saída do simulador ──────────────────────

export type PerfilCliente = "B2B" | "B2C" | "misto";
export type Atividade = "servico" | "comercio";

export interface RegimeSimInput {
  faturamentoAnual: number;
  /** RBT12 p/ faixa do Simples; default = faturamentoAnual. */
  rbt12?: number;
  atividade: Atividade;
  /** Anexo do Simples; se ausente e serviço, decide por Fator R. */
  anexo?: AnexoSimples;
  folhaAnual: number;
  /** Custos/insumos creditáveis de CBS/IBS no ano (base de crédito). */
  insumosCreditaveis: number;
  perfilCliente: PerfilCliente;
  /** Redução de alíquota do IVA (0 = integral, 0.6 = paga 40%, 1 = zero). Ver reforma-rates. */
  reducaoIva?: number;
}

export type NomeRegime = "simples" | "hibrido" | "normal";

export interface RegimeAnoResultado {
  ano: AnoProjecao;
  simples: number;
  hibrido: number;
  normal: number;
  /** Regime de menor carga no ano. */
  melhor: NomeRegime;
}

export interface SimulacaoResultado {
  anos: RegimeAnoResultado[];
  /** Carga total acumulada 2027-2033 por regime. */
  totais: Record<NomeRegime, number>;
  /** Regime de menor carga acumulada. */
  recomendado: NomeRegime;
  /** Economia acumulada do recomendado vs. o pior. */
  economiaVsPior: number;
  /** Crédito de CBS/IBS que o cliente B2B ganharia se a empresa recolher por
   * fora (Híbrido/Normal) — perdido no Simples padrão. Média anual do período. */
  creditoAoClienteMedioAno: number;
  anexoUsado: AnexoSimples | null;
}

// ───────────────────────── Cálculo por regime / ano ──────────────────────────

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
function round4(n: number): number {
  return Math.round((n + Number.EPSILON) * 10000) / 10000;
}

/** IVA (CBS+IBS) recolhido sobre o valor agregado no ano (por fora), com redução
 * setorial opcional (0 = integral, 0.6 = paga 40%, 1 = alíquota zero). */
function ivaSobreValorAgregado(valorAgregado: number, ano: number, reducao = 0): number {
  const cbs = (IVA_REF.cbs / 100) * cbsFracao(ano);
  const ibs = (IVA_REF.ibs / 100) * ibsFracao(ano);
  const fator = 1 - Math.min(Math.max(reducao, 0), 1);
  return valorAgregado * (cbs + ibs) * fator;
}

/** ISS legado sobre o faturamento (serviços) no ano. */
function issLegado(faturamento: number, ano: number, atividade: Atividade): number {
  if (atividade !== "servico") return 0;
  return faturamento * (ISS_BASE / 100) * issFracaoLegado(ano);
}

/** 1) Simples padrão: DAS efetivo sobre o faturamento (aprox. estável no período). */
function calcSimples(input: RegimeSimInput, anexo: AnexoSimples): number {
  const rbt12 = input.rbt12 ?? input.faturamentoAnual;
  const efetiva = simplesAliquotaEfetiva(rbt12, anexo);
  if (Number.isNaN(efetiva)) return NaN;
  return round2(input.faturamentoAnual * (efetiva / 100));
}

/** 2) Híbrido: Simples SEM a parcela indireta + CBS/IBS por fora sobre VA. */
function calcHibrido(input: RegimeSimInput, anexo: AnexoSimples, ano: number): number {
  const rbt12 = input.rbt12 ?? input.faturamentoAnual;
  const efetiva = simplesAliquotaEfetiva(rbt12, anexo);
  if (Number.isNaN(efetiva)) return NaN;
  const dasReduzido =
    input.faturamentoAnual * (efetiva / 100) * (1 - FRACAO_INDIRETA_DAS[anexo]);
  const va = Math.max(input.faturamentoAnual - input.insumosCreditaveis, 0);
  const iva = ivaSobreValorAgregado(va, ano, input.reducaoIva ?? 0);
  return round2(dasReduzido + iva);
}

/** 3) Normal (Lucro Presumido): CBS/IBS + ISS legado + IRPJ/CSLL + CPP. */
function calcNormal(input: RegimeSimInput, ano: number): number {
  const R = input.faturamentoAnual;
  const va = Math.max(R - input.insumosCreditaveis, 0);
  const iva = ivaSobreValorAgregado(va, ano, input.reducaoIva ?? 0);
  const iss = issLegado(R, ano, input.atividade);

  // Presunção do lucro: serviços 32%, comércio 8%.
  const presuncao = input.atividade === "servico" ? 0.32 : 0.08;
  const baseLucro = R * presuncao;
  const irpj = baseLucro * 0.15 + Math.max(baseLucro - 240_000, 0) * 0.10; // 15% + adicional 10%
  const csll = baseLucro * 0.09;
  const cpp = input.folhaAnual * 0.20; // patronal (fora do Simples)

  return round2(iva + iss + irpj + csll + cpp);
}

/** Crédito de CBS/IBS gerado ao cliente ao recolher por fora (sobre o VA). */
function creditoAoCliente(input: RegimeSimInput, ano: number): number {
  const va = Math.max(input.faturamentoAnual - input.insumosCreditaveis, 0);
  return round2(ivaSobreValorAgregado(va, ano, input.reducaoIva ?? 0));
}

// ───────────────────────── Orquestração ──────────────────────────────────────

function menor(a: number, b: number, c: number): NomeRegime {
  const arr: Array<[NomeRegime, number]> = [
    ["simples", a],
    ["hibrido", b],
    ["normal", c],
  ];
  const validos = arr.filter(([, v]) => !Number.isNaN(v));
  const alvo = validos.length ? validos : arr;
  return alvo.reduce((best, cur) => (cur[1] < best[1] ? cur : best))[0];
}

export function simularRegimes(input: RegimeSimInput): SimulacaoResultado {
  const anexo =
    input.anexo ??
    (input.atividade === "comercio"
      ? "I"
      : anexoPorFatorR(input.folhaAnual, input.faturamentoAnual));

  const anos: RegimeAnoResultado[] = ANOS_PROJECAO.map((ano) => {
    const simples = calcSimples(input, anexo);
    const hibrido = calcHibrido(input, anexo, ano);
    const normal = calcNormal(input, ano);
    return { ano, simples, hibrido, normal, melhor: menor(simples, hibrido, normal) };
  });

  // NaN-estrito: se o regime é inelegível em qualquer ano (ex.: desenquadrado do
  // Simples), o acumulado fica NaN — nunca R$0, que falsamente pareceria o melhor.
  const totais: Record<NomeRegime, number> = {
    simples: round2(sumStrict(anos.map((a) => a.simples))),
    hibrido: round2(sumStrict(anos.map((a) => a.hibrido))),
    normal: round2(sumStrict(anos.map((a) => a.normal))),
  };

  const recomendado = menor(totais.simples, totais.hibrido, totais.normal);
  const valores = [totais.simples, totais.hibrido, totais.normal].filter((v) => !Number.isNaN(v));
  const economiaVsPior = round2(Math.max(...valores) - totais[recomendado]);

  const creditoAoClienteMedioAno = round2(
    sum(ANOS_PROJECAO.map((ano) => creditoAoCliente(input, ano))) / ANOS_PROJECAO.length,
  );

  return {
    anos,
    totais,
    recomendado,
    economiaVsPior,
    creditoAoClienteMedioAno,
    anexoUsado: Number.isNaN(simplesAliquotaEfetiva(input.rbt12 ?? input.faturamentoAnual, anexo))
      ? null
      : anexo,
  };
}

function sum(arr: number[]): number {
  return arr.reduce((s, n) => s + (Number.isNaN(n) ? 0 : n), 0);
}

/** Soma que propaga NaN: um único termo inelegível torna o total inelegível. */
function sumStrict(arr: number[]): number {
  return arr.some((n) => Number.isNaN(n)) ? NaN : arr.reduce((s, n) => s + n, 0);
}

export const NOME_REGIME_LABEL: Record<NomeRegime, string> = {
  simples: "Simples Nacional",
  hibrido: "Simples Híbrido",
  normal: "Regime Normal",
};
