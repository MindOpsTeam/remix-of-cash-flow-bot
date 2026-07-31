/**
 * Saídas contábeis: transforma os dados do ledger em linhas de CSV que um
 * contador importa em qualquer sistema (Domínio, Alterdata, Excel).
 *
 * Formato deliberadamente GENÉRICO e estável: colunas nomeadas, datas
 * DD/MM/AAAA, valores com vírgula decimal (padrão BR de importador). Layout
 * proprietário de sistema contábil específico fica fora daqui até um contador
 * pedir um; formato que muda a cada release é pior que formato simples.
 */

export interface LancamentoExport {
  date: string; // YYYY-MM-DD
  description: string;
  amount: number;
  type: string; // revenue | expense
  status: string;
  source: string;
  conta_codigo?: string | null;
  conta_nome?: string | null;
  centro_nome?: string | null;
}

export interface PartidaExport {
  date: string;
  debit_account: string;
  credit_account: string;
  amount: number;
  description: string | null;
}

export interface ContaExport {
  code: string | null;
  name: string;
  type: string;
  group_code?: string | null;
}

const dataBr = (iso: string) => {
  const [ano, mes, dia] = iso.slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
};

/** Valor no padrão de importador BR: vírgula decimal, sem separador de milhar. */
export const valorBr = (v: number) => v.toFixed(2).replace(".", ",");

export function diarioParaCsv(lancamentos: LancamentoExport[]): { headers: string[]; rows: string[][] } {
  return {
    headers: ["Data", "Tipo", "Conta", "Nome da Conta", "Centro de Custo", "Descrição", "Valor", "D/C", "Origem", "Status"],
    rows: lancamentos.map((l) => [
      dataBr(l.date),
      l.type === "revenue" ? "Receita" : "Despesa",
      l.conta_codigo ?? "",
      l.conta_nome ?? "SEM CLASSIFICAÇÃO",
      l.centro_nome ?? "",
      l.description,
      valorBr(l.amount),
      l.type === "revenue" ? "C" : "D",
      l.source,
      l.status,
    ]),
  };
}

/** Razão: lançamentos agrupados por conta, com subtotal por conta. */
export function razaoParaCsv(lancamentos: LancamentoExport[]): { headers: string[]; rows: string[][] } {
  const porConta = new Map<string, LancamentoExport[]>();
  for (const l of lancamentos) {
    const chave = `${l.conta_codigo ?? "zzz"}|${l.conta_nome ?? "SEM CLASSIFICAÇÃO"}`;
    porConta.set(chave, [...(porConta.get(chave) ?? []), l]);
  }

  const rows: string[][] = [];
  for (const [chave, doGrupo] of [...porConta.entries()].sort(([a], [b]) => a.localeCompare(b, "pt-BR"))) {
    const [codigo, nome] = chave.split("|");
    const ordenados = [...doGrupo].sort((a, b) => a.date.localeCompare(b.date));
    let saldo = 0;
    for (const l of ordenados) {
      const sinal = l.type === "revenue" ? 1 : -1;
      saldo += sinal * l.amount;
      rows.push([
        codigo === "zzz" ? "" : codigo,
        nome,
        dataBr(l.date),
        l.description,
        valorBr(l.amount),
        l.type === "revenue" ? "C" : "D",
        valorBr(saldo),
      ]);
    }
    rows.push([codigo === "zzz" ? "" : codigo, nome, "", "TOTAL DA CONTA", valorBr(Math.abs(saldo)), saldo >= 0 ? "C" : "D", ""]);
  }

  return { headers: ["Conta", "Nome da Conta", "Data", "Descrição", "Valor", "D/C", "Saldo Corrente"], rows };
}

export function partidasParaCsv(partidas: PartidaExport[]): { headers: string[]; rows: string[][] } {
  return {
    headers: ["Data", "Conta Débito", "Conta Crédito", "Valor", "Histórico"],
    rows: partidas.map((p) => [dataBr(p.date), p.debit_account, p.credit_account, valorBr(p.amount), p.description ?? ""]),
  };
}

export function planoDeContasParaCsv(contas: ContaExport[]): { headers: string[]; rows: string[][] } {
  return {
    headers: ["Código", "Nome", "Tipo", "Código do Grupo"],
    rows: [...contas]
      .sort((a, b) => (a.code ?? "").localeCompare(b.code ?? "", "pt-BR"))
      .map((c) => [c.code ?? "", c.name, c.type === "revenue" ? "Receita" : "Despesa", c.group_code ?? ""]),
  };
}

/** Sanidade pré-export: o contador precisa saber o que está fora. */
export function resumoQualidade(lancamentos: LancamentoExport[]): { total: number; semConta: number; valorSemConta: number } {
  const semConta = lancamentos.filter((l) => !l.conta_codigo && !l.conta_nome);
  return {
    total: lancamentos.length,
    semConta: semConta.length,
    valorSemConta: semConta.reduce((s, l) => s + l.amount, 0),
  };
}
