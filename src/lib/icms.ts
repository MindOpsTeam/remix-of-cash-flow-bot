/**
 * ICMS — a camada "hardcodável" (regra fixa, sem feed externo).
 * Matriz interestadual (Res. Senado 22/1989 + 13/2012) e DIFAL (EC 87/2015 +
 * LC 190/2022). Alíquotas INTERNAS por UF e FCP NÃO estão aqui — não há fonte
 * oficial machine-readable; vivem no rate store (tax_rates, confidence=revisar).
 * Ver docs/INTEGRADOR-NACIONAL-ALIQUOTAS.md.
 *
 * ⚠️ ICMS/ISS migram para o IBS entre 2029-2032 e são extintos em 2033.
 */

// UFs do grupo "Sul/Sudeste exceto ES" (origem que dispara a alíquota de 7%).
const SUL_SUDESTE_EXC_ES = new Set(["PR", "SC", "RS", "SP", "RJ", "MG"]);

export const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;

export type UF = (typeof UFS)[number];

/**
 * Alíquota interestadual de ICMS entre duas UFs.
 * - Importado (conteúdo de importação): 4% (Res. 13/2012).
 * - Origem Sul/Sudeste (exceto ES) → destino N/NE/CO ou ES: 7%.
 * - Demais operações interestaduais: 12%.
 * Retorna null quando origin === dest (operação interna, não interestadual).
 */
export function icmsInterstateRate(origin: string, dest: string, imported = false): number | null {
  if (origin === dest) return null;
  if (imported) return 4;
  if (SUL_SUDESTE_EXC_ES.has(origin) && !SUL_SUDESTE_EXC_ES.has(dest)) return 7;
  return 12;
}

export interface DifalInput {
  valor: number;
  aliquotaInternaDestino: number; // %
  aliquotaInterestadual: number; // %
  fcpDestino?: number; // % adicional de Fundo de Combate à Pobreza (0 se não houver)
  baseDupla?: boolean; // true = base dupla ("por dentro"); varia por UF e é litigado
}

export interface DifalResult {
  difal: number; // ICMS de partilha devido ao destino
  fcp: number;
  total: number;
}

/**
 * DIFAL em venda interestadual a consumidor final não-contribuinte (EC 87/2015).
 * baseUnica: difal = valor × (alíqInterna − alíqInter).
 * baseDupla:  base = (valor − valor×alíqInter) / (1 − alíqInterna);
 *             difal = base×alíqInterna − valor×alíqInter.
 */
export function calcularDifal(input: DifalInput): DifalResult {
  const v = input.valor;
  const aiDest = input.aliquotaInternaDestino / 100;
  const aInter = input.aliquotaInterestadual / 100;
  const fcpPct = (input.fcpDestino ?? 0) / 100;

  let difal: number;
  if (input.baseDupla) {
    const base = (v - v * aInter) / (1 - aiDest);
    difal = base * aiDest - v * aInter;
  } else {
    difal = v * (aiDest - aInter);
  }
  const fcp = v * fcpPct;
  const round = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
  return { difal: round(difal), fcp: round(fcp), total: round(difal + fcp) };
}
