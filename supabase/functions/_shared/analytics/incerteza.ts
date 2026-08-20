import type { MesHistorico } from "../forecast.ts";

/**
 * Banda de incerteza da projeção, medida no erro do próprio método.
 *
 * POR QUE
 * A projeção entrega um número e um rótulo ("confiança alta"). Ninguém decide
 * com rótulo. Quem precisa honrar folha e imposto quer saber o pior caso
 * plausível; quem avalia investimento quer o cenário central. São perguntas
 * diferentes e só uma banda responde as duas.
 *
 * COMO
 * Backtest de janela deslizante: para cada mês do histórico a partir do 4º,
 * projeta com o que se sabia ANTES dele e mede o erro. O desvio desses erros é
 * a incerteza real daquela empresa, não um percentual arbitrário.
 *
 * A banda abre com o horizonte por sqrt(h), que é o comportamento de um passeio
 * aleatório: prever 3 meses à frente é mais incerto que 1, e a raiz é a forma
 * padrão de expressar isso sem inventar precisão.
 */

export interface Banda {
  p10: number;
  p50: number;
  p90: number;
  /** Quantos erros sustentam a estimativa. Menos que isso é chute. */
  observacoes: number;
}

/** Mínimo de meses para haver erro suficiente para medir. */
export const MINIMO_MESES_BANDA = 6;

/** Quantil normal padrão para 80% central (P10 e P90). */
const Z_80 = 1.2816;

function media(v: number[]): number {
  return v.length ? v.reduce((s, n) => s + n, 0) / v.length : 0;
}

function desvioPadrao(v: number[]): number {
  if (v.length < 2) return 0;
  const m = media(v);
  return Math.sqrt(media(v.map((n) => (n - m) ** 2)));
}

/** Média ponderada linear: espelha exatamente o que projetarCaixa usa. */
function mediaPonderada(v: number[]): number {
  if (!v.length) return 0;
  let soma = 0;
  let pesos = 0;
  v.forEach((n, i) => {
    soma += n * (i + 1);
    pesos += i + 1;
  });
  return soma / pesos;
}

/**
 * Erros relativos do método sobre o próprio histórico.
 * Exportado porque a acurácia também consome, e porque é o número que explica
 * a largura da banda quando alguém perguntar.
 */
export function residuosRelativos(valores: number[]): number[] {
  const residuos: number[] = [];
  // começa no índice 3: com menos de 3 pontos a média ponderada não tem sinal
  for (let i = 3; i < valores.length; i++) {
    const previsto = mediaPonderada(valores.slice(0, i));
    const real = valores[i];
    if (previsto <= 0) continue;
    residuos.push((real - previsto) / previsto);
  }
  return residuos;
}

/**
 * Banda para UM mês do horizonte. `horizonte` é 1 para o próximo mês.
 * Devolve null quando não há histórico para medir: a tela mostra só o número,
 * como sempre fez.
 */
export function bandaPorResiduo(
  valores: number[],
  base: number,
  horizonte: number,
): Banda | null {
  if (valores.length < MINIMO_MESES_BANDA) return null;
  if (!(base > 0)) return null;

  const residuos = residuosRelativos(valores);
  if (residuos.length < 2) return null;

  const dispersao = desvioPadrao(residuos) * Math.sqrt(Math.max(1, horizonte));
  const margem = base * dispersao * Z_80;

  return {
    // caixa previsto não fica negativo: abaixo de zero a leitura correta é zero
    p10: Math.max(0, Math.round((base - margem) * 100) / 100),
    p50: Math.round(base * 100) / 100,
    p90: Math.round((base + margem) * 100) / 100,
    observacoes: residuos.length,
  };
}

/** Bandas de receita e despesa para cada mês do horizonte. */
export function bandasDoHorizonte(
  historico: MesHistorico[],
  bases: Array<{ receita: number; despesa: number }>,
): Array<{ receita: Banda | null; despesa: Banda | null }> {
  const receitas = historico.map((h) => h.receita);
  const despesas = historico.map((h) => h.despesa);
  return bases.map((b, i) => ({
    receita: bandaPorResiduo(receitas, b.receita, i + 1),
    despesa: bandaPorResiduo(despesas, b.despesa, i + 1),
  }));
}
