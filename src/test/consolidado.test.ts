import { describe, it, expect } from "vitest";
import { montarConsolidado, consolidadoParaCsv, grupoDaConta, type GroupTotalRow } from "../lib/consolidado";

const A = "empresa-a";
const B = "empresa-b";

const rows: GroupTotalRow[] = [
  { company_id: A, month: "2026-07-01", group_code: "3.1", group_name: "Receita de Serviços", type: "revenue", total: 1000 },
  { company_id: B, month: "2026-07-01", group_code: "3.1", group_name: "Receita de Serviços", type: "revenue", total: 500 },
  { company_id: A, month: "2026-07-01", group_code: "4.1", group_name: "CMV", type: "expense", total: 300 },
  { company_id: A, month: "2026-07-01", group_code: "5.2", group_name: "Administrativas", type: "expense", total: 200 },
  { company_id: B, month: "2026-07-01", group_code: "5.9", group_name: "Só na B", type: "expense", total: 100 },
];

describe("grupoDaConta", () => {
  it("revenue é receita; expense 4.x é custo; o resto é despesa", () => {
    expect(grupoDaConta("revenue", "3.1")).toBe("receita");
    expect(grupoDaConta("expense", "4.9")).toBe("custo");
    expect(grupoDaConta("expense", "5.1")).toBe("despesa");
  });
});

describe("montarConsolidado", () => {
  const c = montarConsolidado(rows, [A, B]);

  it("consolida a mesma conta entre CNPJs e zera onde o CNPJ não tem", () => {
    const receita = c.linhas.find((l) => l.code === "3.1")!;
    expect(receita.porEmpresa[A]).toBe(1000);
    expect(receita.porEmpresa[B]).toBe(500);
    expect(receita.total).toBe(1500);

    const soNaB = c.linhas.find((l) => l.code === "5.9")!;
    expect(soNaB.porEmpresa[A]).toBe(0);
    expect(soNaB.porEmpresa[B]).toBe(100);
  });

  it("ordena receita, custo, despesa e por código dentro do grupo", () => {
    expect(c.linhas.map((l) => l.grupo)).toEqual(["receita", "custo", "despesa", "despesa"]);
    expect(c.linhas[2].code < c.linhas[3].code).toBe(true);
  });

  it("totais por empresa e do grupo fecham com a régua", () => {
    expect(c.totais.resultado[A]).toBe(1000 - 300 - 200);
    expect(c.totais.resultado[B]).toBe(500 - 100);
    expect(c.totais.totalResultado).toBe(900);
    expect(c.totais.margemOperacionalPct).toBeCloseTo((900 / 1500) * 100, 5);
  });

  it("meses somam na mesma conta (acumulado)", () => {
    const doisMeses = montarConsolidado(
      [...rows, { company_id: A, month: "2026-06-01", group_code: "3.1", group_name: "Receita de Serviços", type: "revenue", total: 400 }],
      [A, B],
    );
    expect(doisMeses.linhas.find((l) => l.code === "3.1")!.porEmpresa[A]).toBe(1400);
  });

  it("sem receita, margem é null e não NaN", () => {
    const vazio = montarConsolidado([], [A]);
    expect(vazio.totais.margemOperacionalPct).toBeNull();
    expect(vazio.linhas).toHaveLength(0);
  });
});

describe("consolidadoParaCsv", () => {
  it("cabeçalho nomeia empresas e as linhas de totais fecham", () => {
    const c = montarConsolidado(rows, [A, B]);
    const { headers, rows: csv } = consolidadoParaCsv(c, { [A]: "Alfa", [B]: "Beta" }, [A, B]);
    expect(headers).toEqual(["Grupo", "Código", "Conta", "Alfa", "Beta", "Total"]);
    const resultado = csv.at(-1)!;
    expect(resultado[2]).toBe("Resultado");
    expect(resultado.at(-1)).toBe(900);
  });
});
