/**
 * Montagem do DRE a partir das linhas da view.
 *
 * Divisão de responsabilidade proposital: a CLASSIFICAÇÃO (o que é receita,
 * custo, despesa, e quais status contam) vive só na view v_dre_linhas, em SQL.
 * Este arquivo não decide nada disso, ele só ordena, nomeia e soma. Se a régua
 * voltasse a aparecer aqui, seriam duas cópias da mesma regra, que é o defeito
 * que já fez conciliar um lançamento apagá-lo do resultado.
 */

/** Uma linha da view v_dre_linhas, agregada por conta. */
export interface LinhaView {
  account_id: string | null;
  account_code: string | null;
  account_name: string | null;
  type: string;
  grupo: "receita" | "deducao" | "custo" | "despesa" | "a_classificar";
  total: number;
}

export interface DRELine {
  label: string;
  value: number;
  level: number;
  isTotal?: boolean;
  /** Linha que exige ação do usuário, e não um resultado apurado. */
  alerta?: boolean;
  /** Conta que originou a linha — só para abrir o detalhe. Não entra em conta alguma. */
  accountId?: string | null;
}

export interface ResultadoDRE {
  linhas: DRELine[];
  totalReceita: number;
  /** Imposto sobre venda, devolução, desconto incondicional. */
  totalDeducoes: number;
  receitaLiquida: number;
  totalCustos: number;
  totalDespesas: number;
  lucroBruto: number;
  lucroLiquido: number;
  /** Soma do que ficou fora do lucro por não ter conta contábil. */
  naoClassificado: number;
}

/** Linha da view com o mês, para a série do gráfico. */
export interface LinhaMes {
  mes: string;
  grupo: LinhaView["grupo"];
  total: number;
}

export interface PontoSerie {
  chave: string;
  receitas: number;
  /** Custos e despesas somados: é o que sai do caixa no gráfico. */
  despesas: number;

  lucro: number;
  naoClassificado: number;
}

/**
 * Série mensal do gráfico, a partir das MESMAS linhas da tabela.
 *
 * O gráfico antes somava receita e despesa direto de transactions, por type.
 * Isso jogava o não classificado dentro do lucro, então a barra do gráfico e o
 * Lucro Líquido da tabela ao lado mostravam números diferentes na mesma tela.
 *
 * `chaves` são os meses a exibir, em "YYYY-MM", já na ordem desejada. Mês sem
 * movimento entra zerado em vez de sumir, senão o eixo do gráfico mente sobre
 * o intervalo.
 */
export function montarSerieMensal(entrada: readonly LinhaMes[], chaves: readonly string[]): PontoSerie[] {
  const baldes = new Map<string, PontoSerie>(
    chaves.map((c) => [c, { chave: c, receitas: 0, despesas: 0, lucro: 0, naoClassificado: 0 }]),
  );

  for (const l of entrada) {
    const chave = String(l.mes).slice(0, 7);
    const balde = baldes.get(chave);
    if (!balde) continue;
    const valor = Number(l.total) || 0;
    if (l.grupo === "receita") balde.receitas += valor;
    // Dedução REDUZ a receita, não é saída de caixa nem lançamento sem conta.
    // Sem este ramo ela cairia no `else` e apareceria como não classificado,
    // fazendo o gráfico e a tabela ao lado divergirem de novo.
    else if (l.grupo === "deducao") balde.receitas -= valor;
    else if (l.grupo === "custo" || l.grupo === "despesa") balde.despesas += valor;
    else balde.naoClassificado += valor;
  }

  for (const balde of baldes.values()) balde.lucro = balde.receitas - balde.despesas;
  return [...baldes.values()];
}

function rotulo(l: LinhaView): string {
  if (l.account_code) return `${l.account_code} – ${l.account_name}`;
  return l.account_name ?? "Sem conta";
}

export function montarDRE(entrada: readonly LinhaView[]): ResultadoDRE {
  const linhas = entrada.map((l) => ({ ...l, total: Number(l.total) || 0 }));

  const doGrupo = (grupo: LinhaView["grupo"]) =>
    linhas
      .filter((l) => l.grupo === grupo)
      .map((l) => ({ label: rotulo(l), code: l.account_code ?? "", amount: l.total, accountId: l.account_id }))
      .sort((a, b) => a.code.localeCompare(b.code));

  const receitas = doGrupo("receita");
  const deducoes = doGrupo("deducao");
  const custos = doGrupo("custo");
  const despesas = doGrupo("despesa");

  const somar = (itens: { amount: number }[]) => itens.reduce((s, i) => s + i.amount, 0);
  const totalReceita = somar(receitas);
  const totalDeducoes = somar(deducoes);
  const totalCustos = somar(custos);
  const totalDespesas = somar(despesas);

  // Margem se calcula sobre a receita LÍQUIDA. Numa empresa do Simples, que
  // paga imposto sobre o faturamento, usar a bruta infla a receita e desloca
  // toda margem calculada em cima dela.
  const receitaLiquida = totalReceita - totalDeducoes;
  const lucroBruto = receitaLiquida - totalCustos;
  const lucroLiquido = lucroBruto - totalDespesas;

  // O que não tem conta não entra em receita, custo nem despesa, e por isso
  // fica fora do lucro. Antes ficava fora e CALADO. Agora vira linha visível.
  const semContaEntrada = linhas
    .filter((l) => l.grupo === "a_classificar" && l.type === "revenue")
    .reduce((s, l) => s + l.total, 0);
  const semContaSaida = linhas
    .filter((l) => l.grupo === "a_classificar" && l.type === "expense")
    .reduce((s, l) => s + l.total, 0);

  return {
    linhas: [
      { label: "Receita Bruta", value: totalReceita, level: 0, isTotal: true },
      ...receitas.map((r) => ({ label: r.label, value: r.amount, level: 1, accountId: r.accountId })),
      // Só aparece quando existe. DRE de prestador sem imposto retido não
      // precisa carregar uma linha de zero para parecer completo.
      ...(deducoes.length > 0
        ? [
            { label: "(-) Deduções da Receita", value: -totalDeducoes, level: 0 },
            ...deducoes.map((d) => ({ label: d.label, value: -d.amount, level: 1, accountId: d.accountId })),
            { label: "Receita Líquida", value: receitaLiquida, level: 0, isTotal: true },
          ]
        : []),
      { label: "(-) Custos", value: -totalCustos, level: 0 },
      ...custos.map((c) => ({ label: c.label, value: -c.amount, level: 1, accountId: c.accountId })),
      { label: "Lucro Bruto", value: lucroBruto, level: 0, isTotal: true },
      { label: "(-) Despesas Operacionais", value: -totalDespesas, level: 0 },
      ...despesas.map((d) => ({ label: d.label, value: -d.amount, level: 1, accountId: d.accountId })),
      { label: "Lucro Líquido", value: lucroLiquido, level: 0, isTotal: true },
      ...(semContaEntrada > 0
        ? [{ label: "A classificar (entradas)", value: semContaEntrada, level: 0, alerta: true }]
        : []),
      ...(semContaSaida > 0
        ? [{ label: "A classificar (saídas)", value: -semContaSaida, level: 0, alerta: true }]
        : []),
    ],
    totalReceita,
    totalDeducoes,
    receitaLiquida,
    totalCustos,
    totalDespesas,
    lucroBruto,
    lucroLiquido,
    naoClassificado: semContaEntrada + semContaSaida,
  };
}
