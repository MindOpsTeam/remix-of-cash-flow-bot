/**
 * Reforma Tributária — reduções de alíquota por setor/atividade (LC 214/2025).
 * Fonte ÚNICA e configurável dos regimes DIFERENCIADOS (mesma mecânica, só muda o
 * percentual). Os regimes ESPECÍFICOS (combustível ad rem, financeiro, imóveis…)
 * têm base própria e ficam fora do MVP — a UI orienta "consulte o contador".
 *
 * `reducao` = fração de redução da alíquota de referência do IVA (CBS+IBS).
 *   0    → tributação integral (~26,5%)
 *   0.30 → paga 70% (~18,55%) — 18 profissões regulamentadas (art. 127)
 *   0.60 → paga 40% (~10,6%)  — saúde, educação, medicamentos, alimentos, etc.
 *   1.00 → alíquota zero       — cesta básica nacional, transporte público urbano
 */

export interface ReducaoOpcao {
  key: string;
  label: string;
  /** Fração de redução da alíquota (0 = integral, 0.6 = paga 40%, 1 = zero). */
  reducao: number;
  hint: string;
}

export const REDUCOES_IVA: ReducaoOpcao[] = [
  { key: "integral", label: "Tributação integral", reducao: 0, hint: "alíquota cheia (~26,5%)" },
  { key: "reduzido60", label: "Redução 60%", reducao: 0.6, hint: "saúde, educação, medicamentos, alimentos — paga ~40% (≈10,6%)" },
  { key: "reduzido30", label: "Redução 30%", reducao: 0.3, hint: "18 profissões regulamentadas (art. 127) — paga ~70% (≈18,55%)" },
  { key: "zero", label: "Alíquota zero", reducao: 1, hint: "cesta básica nacional, transporte público urbano — isento" },
];

export function reducaoPorKey(key: string): number {
  return REDUCOES_IVA.find((r) => r.key === key)?.reducao ?? 0;
}

export function reducaoLabel(key: string): string {
  return REDUCOES_IVA.find((r) => r.key === key)?.label ?? "Tributação integral";
}
