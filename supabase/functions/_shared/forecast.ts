/**
 * Previsão de caixa DETERMINÍSTICA.
 *
 * Antes, seis totais mensais eram jogados no modelo e o modelo devolvia o
 * número projetado, com temperatura acima de zero. A mesma pergunta duas vezes
 * dava dois resultados, e um CFO que vê a previsão mudar sozinha deixa de
 * confiar em todas as telas, inclusive nas certas.
 *
 * Aqui a conta é feita em código, e o modelo entra só para explicar a causa.
 *
 * O ponto que o mercado erra: a maior parte do caixa dos próximos 90 dias JÁ
 * ESTÁ CONTRATADA. Recebível tem vencimento, conta a pagar tem vencimento,
 * contrato tem próxima cobrança. Pedir para a IA adivinhar um número que o
 * banco já sabe é queimar crédito e credibilidade ao mesmo tempo. O modelo
 * projeta apenas a parcela NÃO comprometida, e mesmo essa por média histórica.
 */

export interface MesHistorico {
  mes: string;
  receita: number;
  despesa: number;
}

export interface Compromisso {
  data: string;
  valor: number;
  tipo: "entrada" | "saida";
  origem: "recebivel" | "conta_a_pagar" | "contrato";
}

export interface MesProjetado {
  month: string;
  projected_revenue: number;
  projected_expense: number;
  /** Parcela do mês que já está contratada, não estimada. */
  contratado_entrada: number;
  contratado_saida: number;
  confidence: "high" | "medium" | "low";
  saldo_projetado: number;
}

function media(v: number[]): number {
  return v.length ? v.reduce((s, n) => s + n, 0) / v.length : 0;
}

function desvioPadrao(v: number[]): number {
  if (v.length < 2) return 0;
  const m = media(v);
  return Math.sqrt(media(v.map((n) => (n - m) ** 2)));
}

/** Média ponderada: mês recente pesa mais, porque PME muda rápido. */
function mediaPonderada(v: number[]): number {
  if (!v.length) return 0;
  let soma = 0;
  let pesos = 0;
  v.forEach((n, i) => {
    const peso = i + 1;
    soma += n * peso;
    pesos += peso;
  });
  return soma / pesos;
}

function rotuloMes(d: Date): string {
  const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${meses[d.getUTCMonth()]}/${String(d.getUTCFullYear()).slice(2)}`;
}

/**
 * Projeta N meses. `saldoInicial` é o saldo bancário de hoje: sem ele o número
 * é um delta, não um saldo, e a única pergunta que o dono faz de verdade
 * ("quanto tempo o caixa aguenta?") fica sem resposta.
 */
export function projetarCaixa(
  historico: MesHistorico[],
  compromissos: Compromisso[],
  saldoInicial: number,
  meses = 3,
): { forecast: MesProjetado[]; runwayMeses: number | null; baseHistorica: number } {
  const receitas = historico.map((h) => h.receita);
  const despesas = historico.map((h) => h.despesa);

  const receitaBase = mediaPonderada(receitas);
  const despesaBase = mediaPonderada(despesas);
  const volatilidade = receitaBase > 0 ? desvioPadrao(receitas) / receitaBase : 1;

  const hoje = new Date();
  const forecast: MesProjetado[] = [];
  let saldo = saldoInicial;

  for (let i = 1; i <= meses; i++) {
    const alvo = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() + i, 1));
    const fim = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0));

    const doMes = compromissos.filter((c) => {
      const d = new Date(c.data + "T00:00:00Z");
      return d >= alvo && d <= fim;
    });
    const contratadoEntrada = doMes.filter((c) => c.tipo === "entrada").reduce((s, c) => s + c.valor, 0);
    const contratadoSaida = doMes.filter((c) => c.tipo === "saida").reduce((s, c) => s + c.valor, 0);

    // O contratado NÃO se soma à média cheia: ele já faz parte do que a
    // empresa costuma faturar. Projetamos o maior entre o contratado e a média,
    // que é o comportamento conservador e explicável.
    const receita = Math.max(contratadoEntrada, receitaBase);
    const despesa = Math.max(contratadoSaida, despesaBase);

    saldo += receita - despesa;

    // Confiança cai com o horizonte e com a volatilidade do histórico, e sobe
    // quando a maior parte do mês já está contratada. Isso é medida, não
    // opinião do modelo.
    const cobertura = receita > 0 ? contratadoEntrada / receita : 0;
    const pontos = (historico.length >= 4 ? 1 : 0) + (volatilidade < 0.35 ? 1 : 0) + (cobertura > 0.5 ? 1 : 0) + (i === 1 ? 1 : 0);
    const confidence: MesProjetado["confidence"] = pontos >= 3 ? "high" : pontos >= 2 ? "medium" : "low";

    forecast.push({
      month: rotuloMes(alvo),
      projected_revenue: Math.round(receita * 100) / 100,
      projected_expense: Math.round(despesa * 100) / 100,
      contratado_entrada: Math.round(contratadoEntrada * 100) / 100,
      contratado_saida: Math.round(contratadoSaida * 100) / 100,
      confidence,
      saldo_projetado: Math.round(saldo * 100) / 100,
    });
  }

  const queimaMensal = despesaBase - receitaBase;
  const runwayMeses = queimaMensal > 0 && saldoInicial > 0
    ? Math.round((saldoInicial / queimaMensal) * 10) / 10
    : null;

  return { forecast, runwayMeses, baseHistorica: Math.round(receitaBase * 100) / 100 };
}
