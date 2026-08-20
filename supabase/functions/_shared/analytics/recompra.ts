/**
 * Recorrência de compra virando entrada de caixa provável.
 *
 * POR QUE
 * O sistema já sabe que um cliente compra a cada 32 dias e que hoje é o dia 30
 * desde a última compra. Essa informação vive numa tela de radar e morre ali.
 * Ela é, na prática, uma entrada de caixa com probabilidade alta no mês que
 * vem, e a projeção ignora.
 *
 * O QUE ESTE MÓDULO NÃO FAZ
 * Não soma nada. Devolve a expectativa, e quem projeta decide como usar. Isso é
 * deliberado: somar a expectativa ao que já está contratado é dupla contagem, e
 * dupla contagem infla o caixa previsto justamente do lado otimista, que é o
 * erro mais caro que uma previsão financeira pode cometer.
 */

export interface ClientePadrao {
  contact_id: string;
  ticket_medio: number;
  /** Mediana dos intervalos entre compras, em dias. */
  intervalo_dias: number;
  /** Dispersão dos intervalos. Zero significa relógio; alto significa irregular. */
  desvio_dias?: number;
  /** YYYY-MM-DD */
  ultima_compra: string;
  /** Quantas compras sustentam o padrão. */
  n_compras: number;
}

/** Abaixo disso não há padrão, há coincidência. */
export const MINIMO_COMPRAS = 3;

/** Nenhum cliente é certo: teto de probabilidade. */
export const TETO_PROBABILIDADE = 0.95;

/** Passou de 2 ciclos sem comprar, tratamos como perdido (alinhado à view). */
export const CICLOS_ATE_PERDIDO = 2;

function diasEntre(de: string, ate: Date): number {
  const d = new Date(`${de}T00:00:00Z`).getTime();
  return Math.floor((ate.getTime() - d) / 86_400_000);
}

/**
 * Probabilidade de o cliente comprar dentro da janela que termina em `ateDias`
 * a partir de hoje.
 *
 * Modelo: densidade acumulada em torno do intervalo típico. Quanto mais perto
 * do intervalo (e além dele), maior a chance de a compra já estar por vir. A
 * dispersão alarga a janela: cliente irregular tem probabilidade mais espalhada
 * e nunca concentrada num mês só.
 */
export function probabilidadeAte(
  cliente: ClientePadrao,
  ateDias: number,
  hoje: Date = new Date(),
): number {
  if (cliente.n_compras < MINIMO_COMPRAS) return 0;
  if (!(cliente.intervalo_dias > 0)) return 0;

  const decorridos = diasEntre(cliente.ultima_compra, hoje);
  if (decorridos < 0) return 0;

  // sumiu há mais de 2 ciclos: virou win-back, não previsão de caixa
  if (decorridos > cliente.intervalo_dias * CICLOS_ATE_PERDIDO) return 0;

  // dispersão mínima de 20% do intervalo: fingir precisão de relógio numa PME
  // produz probabilidade 0 ou 1, que é pior que uma estimativa honesta
  const sigma = Math.max(cliente.desvio_dias ?? 0, cliente.intervalo_dias * 0.2);

  // z do fim da janela em relação ao intervalo esperado
  const z = (decorridos + ateDias - cliente.intervalo_dias) / sigma;
  const p = cdfNormal(z);

  return Math.min(TETO_PROBABILIDADE, Math.max(0, p));
}

/** Normal acumulada por Abramowitz-Stegun 7.1.26, sem dependência externa. */
function cdfNormal(z: number): number {
  const sinal = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-x * x);
  return 0.5 * (1 + sinal * y);
}

/**
 * Probabilidade de a compra cair DENTRO de um mês específico do horizonte.
 * É a diferença entre a acumulada até o fim e até o começo do mês, que evita
 * contar o mesmo cliente em dois meses seguidos.
 */
export function probabilidadeNoMes(
  cliente: ClientePadrao,
  inicioDias: number,
  fimDias: number,
  hoje: Date = new Date(),
): number {
  const ate = probabilidadeAte(cliente, fimDias, hoje);
  const antes = probabilidadeAte(cliente, inicioDias, hoje);
  return Math.max(0, ate - antes);
}

export interface EntradaEsperada {
  valor: number;
  /** Quantos clientes contribuíram com probabilidade relevante. */
  clientes: number;
}

/**
 * Entrada esperada de um mês do horizonte: soma de ticket × probabilidade.
 * `mesIndice` é 1 para o próximo mês.
 */
export function entradaEsperadaDoMes(
  clientes: ClientePadrao[],
  mesIndice: number,
  hoje: Date = new Date(),
): EntradaEsperada {
  const inicio = (mesIndice - 1) * 30;
  const fim = mesIndice * 30;

  let valor = 0;
  let contados = 0;
  for (const c of clientes) {
    const p = probabilidadeNoMes(c, inicio, fim, hoje);
    if (p <= 0.01) continue; // ruído: não vale poluir o número
    valor += c.ticket_medio * p;
    contados++;
  }
  return { valor: Math.round(valor * 100) / 100, clientes: contados };
}

/** Entradas esperadas para todo o horizonte. */
export function entradasEsperadas(
  clientes: ClientePadrao[],
  meses: number,
  hoje: Date = new Date(),
): EntradaEsperada[] {
  return Array.from({ length: meses }, (_, i) => entradaEsperadaDoMes(clientes, i + 1, hoje));
}

/**
 * Intervalo típico robusto: mediana dos intervalos reais entre compras
 * consecutivas, com a dispersão.
 *
 * A view atual usa (última − primeira) / (n − 1), que é média e por isso se
 * desloca inteira por causa de uma compra atípica. A mediana ignora o outlier.
 */
export function intervaloRobusto(
  datasCompra: string[],
): { intervalo_dias: number; desvio_dias: number; n_intervalos: number } | null {
  if (datasCompra.length < 2) return null;

  const ordenadas = [...datasCompra].sort();
  const intervalos: number[] = [];
  for (let i = 1; i < ordenadas.length; i++) {
    const dias = Math.round(
      (new Date(`${ordenadas[i]}T00:00:00Z`).getTime() -
        new Date(`${ordenadas[i - 1]}T00:00:00Z`).getTime()) /
        86_400_000,
    );
    if (dias > 0) intervalos.push(dias);
  }
  if (!intervalos.length) return null;

  const ord = [...intervalos].sort((a, b) => a - b);
  const meio = Math.floor(ord.length / 2);
  const mediana = ord.length % 2 ? ord[meio] : (ord[meio - 1] + ord[meio]) / 2;
  const m = intervalos.reduce((s, n) => s + n, 0) / intervalos.length;
  const desvio =
    intervalos.length < 2
      ? 0
      : Math.sqrt(intervalos.reduce((s, n) => s + (n - m) ** 2, 0) / intervalos.length);

  return {
    intervalo_dias: Math.round(mediana),
    desvio_dias: Math.round(desvio),
    n_intervalos: intervalos.length,
  };
}
