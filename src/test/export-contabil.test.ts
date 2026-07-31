import { describe, it, expect } from "vitest";
import {
  diarioParaCsv,
  razaoParaCsv,
  partidasParaCsv,
  planoDeContasParaCsv,
  resumoQualidade,
  valorBr,
  type LancamentoExport,
} from "../lib/export-contabil";

const lancamentos: LancamentoExport[] = [
  { date: "2026-07-05", description: "Venda serviço", amount: 1500.5, type: "revenue", status: "confirmed", source: "manual", conta_codigo: "3.1", conta_nome: "Receita de Serviços", centro_nome: "Comercial" },
  { date: "2026-07-02", description: "Aluguel", amount: 3200, type: "expense", status: "confirmed", source: "openfinance", conta_codigo: "5.1", conta_nome: "Despesas Administrativas", centro_nome: null },
  { date: "2026-07-10", description: "Pix sem conta", amount: 90, type: "expense", status: "confirmed", source: "importacao", conta_codigo: null, conta_nome: null },
];

describe("valorBr", () => {
  it("vírgula decimal, duas casas, sem milhar", () => {
    expect(valorBr(1500.5)).toBe("1500,50");
    expect(valorBr(0)).toBe("0,00");
  });
});

describe("diarioParaCsv", () => {
  it("data BR, D/C pelo tipo, sem-conta explícito", () => {
    const { headers, rows } = diarioParaCsv(lancamentos);
    expect(headers[0]).toBe("Data");
    expect(rows[0][0]).toBe("05/07/2026");
    expect(rows[0][7]).toBe("C");
    expect(rows[1][7]).toBe("D");
    expect(rows[2][3]).toBe("SEM CLASSIFICAÇÃO");
  });
});

describe("razaoParaCsv", () => {
  it("agrupa por conta, ordena por data, saldo corrente e total da conta", () => {
    const { rows } = razaoParaCsv([
      ...lancamentos,
      { date: "2026-07-20", description: "Outra venda", amount: 500, type: "revenue", status: "confirmed", source: "manual", conta_codigo: "3.1", conta_nome: "Receita de Serviços" },
    ]);
    const daReceita = rows.filter((r) => r[0] === "3.1");
    expect(daReceita).toHaveLength(3);
    expect(daReceita[0][6]).toBe("1500,50");
    expect(daReceita[1][6]).toBe("2000,50");
    expect(daReceita[2][3]).toBe("TOTAL DA CONTA");
    expect(daReceita[2][5]).toBe("C");
    const semConta = rows.filter((r) => r[1] === "SEM CLASSIFICAÇÃO");
    expect(semConta.length).toBeGreaterThan(0);
  });
});

describe("partidasParaCsv", () => {
  it("exporta o livro como veio do gatilho", () => {
    const { rows } = partidasParaCsv([
      { date: "2026-07-01", debit_account: "Caixa", credit_account: "Receita", amount: 100, description: "Venda" },
    ]);
    expect(rows[0]).toEqual(["01/07/2026", "Caixa", "Receita", "100,00", "Venda"]);
  });
});

describe("planoDeContasParaCsv", () => {
  it("ordena por código e traduz o tipo", () => {
    const { rows } = planoDeContasParaCsv([
      { code: "5.1", name: "Adm", type: "expense", group_code: "G5" },
      { code: "3.1", name: "Serviços", type: "revenue", group_code: null },
    ]);
    expect(rows[0][0]).toBe("3.1");
    expect(rows[0][2]).toBe("Receita");
    expect(rows[1][3]).toBe("G5");
  });
});

describe("resumoQualidade", () => {
  it("conta e soma o que está sem classificação", () => {
    const r = resumoQualidade(lancamentos);
    expect(r.total).toBe(3);
    expect(r.semConta).toBe(1);
    expect(r.valorSemConta).toBe(90);
  });
});
