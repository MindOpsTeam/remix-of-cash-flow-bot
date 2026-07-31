import { describe, it, expect } from "vitest";
import {
  widgetConfigSchema,
  tiposPermitidos,
  serieMensal,
  seriePorEmpresa,
  seriePorVencimento,
  METRICAS_BI,
} from "../lib/bi-catalog";

describe("widgetConfigSchema", () => {
  it("aceita combinação válida e aplica default de meses", () => {
    const parsed = widgetConfigSchema.parse({ metrica: "receita", dimensao: "tempo", tipo: "line" });
    expect(parsed.meses).toBe(12);
  });

  it("rejeita métrica desconhecida", () => {
    expect(() => widgetConfigSchema.parse({ metrica: "lucro_magico", dimensao: "tempo", tipo: "bar" })).toThrow();
  });

  it("rejeita dimensão que a métrica não aceita", () => {
    expect(() =>
      widgetConfigSchema.parse({ metrica: "faturado_cliente", dimensao: "tempo", tipo: "bar" }),
    ).toThrow(/não aceita a dimensão/);
  });

  it("rejeita linha em dimensão categórica", () => {
    expect(() =>
      widgetConfigSchema.parse({ metrica: "receita", dimensao: "empresa", tipo: "line" }),
    ).toThrow(/não aceita gráfico/);
  });

  it("rejeita janela de meses fora da faixa", () => {
    expect(() =>
      widgetConfigSchema.parse({ metrica: "receita", dimensao: "tempo", tipo: "bar", meses: 48 }),
    ).toThrow();
  });
});

describe("tiposPermitidos", () => {
  it("tempo aceita linha; categórica não", () => {
    expect(tiposPermitidos("tempo")).toContain("line");
    expect(tiposPermitidos("empresa")).not.toContain("line");
    expect(tiposPermitidos("cliente")).toContain("table");
  });

  it("nenhuma métrica declara dimensão que o schema recusaria", () => {
    for (const m of METRICAS_BI) {
      for (const d of m.dimensoes) {
        const tipo = tiposPermitidos(d)[0];
        expect(() => widgetConfigSchema.parse({ metrica: m.key, dimensao: d, tipo })).not.toThrow();
      }
    }
  });
});

describe("agregações", () => {
  const rows = [
    { company_id: "a", month: "2026-06-01", receita: 100, custos: 40, despesas: 20 },
    { company_id: "b", month: "2026-06-01", receita: 50, custos: 10, despesas: 10 },
    { company_id: "a", month: "2026-07-01", receita: 200, custos: 80, despesas: 40 },
  ];

  it("serieMensal soma empresas no mesmo mês e ordena", () => {
    const serie = serieMensal(rows, "resultado");
    expect(serie).toEqual([
      { label: "Jun/26", valor: 70 },
      { label: "Jul/26", valor: 80 },
    ]);
  });

  it("margem operacional é percentual sobre a receita agregada", () => {
    const serie = serieMensal(rows, "margem_operacional");
    expect(serie[0].valor).toBeCloseTo((70 / 150) * 100, 5);
  });

  it("seriePorEmpresa nomeia e ordena por valor", () => {
    const serie = seriePorEmpresa(rows, "receita", { a: "Alfa", b: "Beta" });
    expect(serie[0]).toEqual({ label: "Alfa", valor: 300 });
    expect(serie[1]).toEqual({ label: "Beta", valor: 50 });
  });

  it("seriePorVencimento agrupa por mês", () => {
    const serie = seriePorVencimento([
      { valor: 100, vencimento: "2026-08-10" },
      { valor: 50, vencimento: "2026-08-20" },
      { valor: 30, vencimento: "2026-09-01" },
    ]);
    expect(serie).toEqual([
      { label: "Ago/26", valor: 150 },
      { label: "Set/26", valor: 30 },
    ]);
  });
});
