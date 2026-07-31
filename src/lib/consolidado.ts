/**
 * Consolidação do grupo: monta a matriz conta × CNPJ a partir de
 * v_group_account_totals (que já filtra confirmados e exclui intercompany).
 *
 * Regra de honestidade: conta sem group_code NÃO consolida entre CNPJs (a view
 * usa o code próprio de cada empresa como fallback), então a tela precisa
 * mostrar o buraco de mapeamento — nunca somar silenciosamente errado.
 */

export interface GroupTotalRow {
  company_id: string;
  month: string; // YYYY-MM-DD (primeiro dia)
  group_code: string;
  group_name: string | null;
  type: "revenue" | "expense" | string;
  total: number;
}

export interface LinhaConsolidada {
  code: string;
  name: string;
  /** revenue | custo (4.x) | despesa (demais expense) */
  grupo: "receita" | "custo" | "despesa";
  porEmpresa: Record<string, number>;
  total: number;
}

export interface TotaisConsolidados {
  receita: Record<string, number> & { __total?: never };
  custos: Record<string, number>;
  despesas: Record<string, number>;
  resultado: Record<string, number>;
  totalReceita: number;
  totalCustos: number;
  totalDespesas: number;
  totalResultado: number;
  margemOperacionalPct: number | null;
}

export interface Consolidado {
  linhas: LinhaConsolidada[];
  totais: TotaisConsolidados;
}

/** Mesma régua do DRE: expense com código 4.x é custo, o resto é despesa. */
export function grupoDaConta(type: string, code: string): "receita" | "custo" | "despesa" {
  if (type === "revenue") return "receita";
  return code.startsWith("4") ? "custo" : "despesa";
}

const ORDEM_GRUPO: Record<LinhaConsolidada["grupo"], number> = { receita: 0, custo: 1, despesa: 2 };

export function montarConsolidado(rows: GroupTotalRow[], companyIds: string[]): Consolidado {
  const porConta = new Map<string, LinhaConsolidada>();

  for (const r of rows) {
    const code = r.group_code || "sem-conta";
    const chave = `${r.type}:${code}`;
    const linha =
      porConta.get(chave) ??
      ({
        code,
        name: r.group_name ?? code,
        grupo: grupoDaConta(r.type, code),
        porEmpresa: Object.fromEntries(companyIds.map((id) => [id, 0])),
        total: 0,
      } as LinhaConsolidada);
    const valor = Number(r.total) || 0;
    linha.porEmpresa[r.company_id] = (linha.porEmpresa[r.company_id] ?? 0) + valor;
    linha.total += valor;
    porConta.set(chave, linha);
  }

  const linhas = [...porConta.values()].sort(
    (a, b) => ORDEM_GRUPO[a.grupo] - ORDEM_GRUPO[b.grupo] || a.code.localeCompare(b.code, "pt-BR"),
  );

  const zero = () => Object.fromEntries(companyIds.map((id) => [id, 0])) as Record<string, number>;
  const receita = zero();
  const custos = zero();
  const despesas = zero();

  for (const linha of linhas) {
    const destino = linha.grupo === "receita" ? receita : linha.grupo === "custo" ? custos : despesas;
    for (const id of companyIds) destino[id] += linha.porEmpresa[id] ?? 0;
  }

  const resultado = zero();
  for (const id of companyIds) resultado[id] = receita[id] - custos[id] - despesas[id];

  const soma = (m: Record<string, number>) => companyIds.reduce((s, id) => s + m[id], 0);
  const totalReceita = soma(receita);
  const totalCustos = soma(custos);
  const totalDespesas = soma(despesas);
  const totalResultado = totalReceita - totalCustos - totalDespesas;

  return {
    linhas,
    totais: {
      receita,
      custos,
      despesas,
      resultado,
      totalReceita,
      totalCustos,
      totalDespesas,
      totalResultado,
      margemOperacionalPct: totalReceita > 0 ? (totalResultado / totalReceita) * 100 : null,
    },
  };
}

/** Linhas CSV da matriz consolidada (mesmo shape da tela, pronto p/ toCsv). */
export function consolidadoParaCsv(
  consolidado: Consolidado,
  nomes: Record<string, string>,
  companyIds: string[],
): { headers: string[]; rows: (string | number)[][] } {
  const headers = ["Grupo", "Código", "Conta", ...companyIds.map((id) => nomes[id] ?? id), "Total"];
  const rows = consolidado.linhas.map((l) => [
    l.grupo,
    l.code,
    l.name,
    ...companyIds.map((id) => l.porEmpresa[id] ?? 0),
    l.total,
  ]);
  const t = consolidado.totais;
  rows.push(["", "", "Receita", ...companyIds.map((id) => t.receita[id]), t.totalReceita]);
  rows.push(["", "", "Custos", ...companyIds.map((id) => t.custos[id]), t.totalCustos]);
  rows.push(["", "", "Despesas", ...companyIds.map((id) => t.despesas[id]), t.totalDespesas]);
  rows.push(["", "", "Resultado", ...companyIds.map((id) => t.resultado[id]), t.totalResultado]);
  return { headers, rows };
}
