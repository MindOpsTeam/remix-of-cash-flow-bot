/**
 * Acurácia das previsões, medida contra o que aconteceu de verdade.
 *
 * POR QUE
 * Sem isto, "o sistema prevê" é fé. Com isto, vira "ele errou 8% nas últimas
 * 12 previsões DESTA empresa, então eu confio nessa margem". É o único número
 * que transforma projeção em ferramenta de decisão, e é o que separa um produto
 * sério de um gerador de gráfico bonito.
 *
 * MÉTRICA
 * WAPE (erro absoluto ponderado): soma dos erros absolutos dividida pela soma
 * dos valores reais. Escolhido no lugar do MAPE porque o MAPE explode quando o
 * real é próximo de zero, o que num mês fraco de PME acontece o tempo todo e
 * produziria "erro de 400%" sem significado.
 */

export interface ParPrevistoReal {
  previsto: number;
  real: number;
}

export interface ResultadoAcuracia {
  /** 0.08 = errou 8%. Null quando não há base para medir. */
  wape: number | null;
  /** Quantos meses sustentam o número. */
  observacoes: number;
  /** Quanto o previsto ficou acima (+) ou abaixo (−) do real, em média. */
  vies: number | null;
}

/** Mínimo de meses fechados para o número significar algo. */
export const MINIMO_AVALIACOES = 3;

/**
 * WAPE de uma série de pares. Devolve null quando a soma dos reais é zero:
 * dividir por zero produziria Infinity, que na tela vira "erro infinito" e
 * assusta sem informar.
 */
export function wape(pares: ParPrevistoReal[]): number | null {
  if (!pares.length) return null;
  const somaReal = pares.reduce((s, p) => s + Math.abs(p.real), 0);
  if (somaReal === 0) return null;
  const somaErro = pares.reduce((s, p) => s + Math.abs(p.previsto - p.real), 0);
  return somaErro / somaReal;
}

/**
 * Viés: positivo significa que o sistema é otimista (previu mais do que veio).
 * Importa tanto quanto o erro: um método que erra 10% sempre para cima é
 * perigoso de um jeito diferente de um que erra 10% para os dois lados.
 */
export function vies(pares: ParPrevistoReal[]): number | null {
  if (!pares.length) return null;
  const somaReal = pares.reduce((s, p) => s + Math.abs(p.real), 0);
  if (somaReal === 0) return null;
  const somaDiferenca = pares.reduce((s, p) => s + (p.previsto - p.real), 0);
  return somaDiferenca / somaReal;
}

export function avaliar(pares: ParPrevistoReal[]): ResultadoAcuracia {
  const validos = pares.filter((p) => Number.isFinite(p.previsto) && Number.isFinite(p.real));
  if (validos.length < MINIMO_AVALIACOES) {
    return { wape: null, observacoes: validos.length, vies: null };
  }
  return { wape: wape(validos), observacoes: validos.length, vies: vies(validos) };
}

/**
 * Frase pronta para a tela. Sem base suficiente, diz que ainda está medindo em
 * vez de mostrar um número que não se sustenta.
 */
export function frasePrecisao(r: ResultadoAcuracia): string {
  if (r.wape === null) {
    const faltam = MINIMO_AVALIACOES - r.observacoes;
    return faltam > 0
      ? `Ainda medindo: faltam ${faltam} ${faltam === 1 ? "mês fechado" : "meses fechados"} para calcular a precisão.`
      : "Ainda medindo a precisão desta empresa.";
  }
  const pct = Math.round(r.wape * 100);
  const tendencia =
    r.vies === null || Math.abs(r.vies) < 0.03
      ? ""
      : r.vies > 0
        ? ", com tendência a projetar acima do que entra"
        : ", com tendência a projetar abaixo do que entra";
  return `Nas últimas ${r.observacoes} previsões, o erro médio foi de ${pct}%${tendencia}.`;
}

/** Uma previsão caiu dentro da banda que ela mesma anunciou? */
export function dentroDaBanda(real: number, p10: number, p90: number): boolean {
  return real >= p10 && real <= p90;
}

/**
 * Taxa de cobertura: quantas vezes o real caiu dentro da banda. Uma banda de
 * 80% honesta acerta perto de 80%. Muito acima significa banda larga demais
 * (inútil); muito abaixo, banda estreita demais (falsa segurança).
 */
export function cobertura(
  pares: Array<{ real: number; p10: number; p90: number }>,
): number | null {
  if (pares.length < MINIMO_AVALIACOES) return null;
  const dentro = pares.filter((p) => dentroDaBanda(p.real, p.p10, p.p90)).length;
  return dentro / pares.length;
}
