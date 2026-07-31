import { describe, it, expect } from "vitest";
import {
  mrr,
  aging,
  inadimplencia,
  dso,
  dpo,
  burnMensal,
  runwayMeses,
  concentracaoClientes,
  progressoMeta,
  receivablesAbertos,
} from "../lib/metrics";

const HOJE = new Date("2026-07-30T12:00:00Z");

describe("mrr", () => {
  it("mensaliza ciclos diferentes e ignora contratos não ativos", () => {
    const valor = mrr([
      { amount: 1200, cycle: "MONTHLY", status: "active" },
      { amount: 12000, cycle: "YEARLY", status: "active" },
      { amount: 900, cycle: "QUARTERLY", status: "active" },
      { amount: 5000, cycle: "MONTHLY", status: "paused" },
    ]);
    expect(valor).toBe(1200 + 1000 + 300);
  });

  it("ciclo desconhecido conta como mensal, nunca some", () => {
    expect(mrr([{ amount: 100, cycle: "CUSTOM", status: "active" }])).toBe(100);
  });
});

describe("aging", () => {
  it("distribui pelos buckets de atraso, inclusive fronteiras", () => {
    const b = aging(
      [
        { valor: 100, vencimento: "2026-08-10" },
        { valor: 200, vencimento: "2026-07-30" },
        { valor: 300, vencimento: "2026-07-15" },
        { valor: 400, vencimento: "2026-06-30" },
        { valor: 500, vencimento: "2026-05-01" },
      ],
      "2026-07-30",
    );
    expect(b.aVencer).toBe(300);
    expect(b.ate15).toBe(300);
    expect(b.de16a30).toBe(400);
    expect(b.acima30).toBe(500);
    expect(b.total).toBe(1500);
  });
});

describe("inadimplência e abertos", () => {
  const rows = [
    { amount: 600, due_date: "2026-08-15", status: "a_receber", payment_date: null },
    { amount: 400, due_date: "2026-07-01", status: "a_receber", payment_date: null },
    { amount: 900, due_date: "2026-06-01", status: "recebido", payment_date: "2026-06-03" },
  ];

  it("status efetivo transforma a_receber vencido em vencido", () => {
    expect(receivablesAbertos(rows, HOJE)).toHaveLength(2);
    expect(inadimplencia(rows, HOJE)).toBeCloseTo(40, 5);
  });

  it("sem aberto, inadimplência é zero", () => {
    expect(inadimplencia([rows[2]], HOJE)).toBe(0);
  });
});

describe("dso / dpo / burn / runway", () => {
  it("dso aproxima dias de receita parados em aberto", () => {
    expect(dso(30000, 90000, 90)).toBeCloseTo(30, 5);
    expect(dso(30000, 0, 90)).toBeNull();
  });

  it("dpo usa a mesma régua sobre as saídas", () => {
    expect(dpo(20000, 60000, 90)).toBeCloseTo(30, 5);
  });

  it("burn médio é saída menos entrada; lucro dá burn negativo", () => {
    expect(
      burnMensal([
        { receita: 100, custos: 80, despesas: 40 },
        { receita: 100, custos: 60, despesas: 20 },
      ]),
    ).toBe(0);
    expect(burnMensal([{ receita: 300, custos: 100, despesas: 50 }])).toBe(-150);
    expect(burnMensal([])).toBe(0);
  });

  it("runway divide caixa pela queima; sem queima não há runway finito", () => {
    expect(runwayMeses(50000, 10000)).toBe(5);
    expect(runwayMeses(50000, 0)).toBeNull();
    expect(runwayMeses(null, 10000)).toBeNull();
  });
});

describe("concentração de clientes", () => {
  it("top N e participação sobre o faturado total", () => {
    const { top, participacaoPct } = concentracaoClientes(
      [
        { name: "A", faturado: 500 },
        { name: "B", faturado: 300 },
        { name: "C", faturado: 200 },
        { name: "D", faturado: 0 },
        { name: null, faturado: null },
      ],
      2,
    );
    expect(top.map((c) => c.name)).toEqual(["A", "B"]);
    expect(participacaoPct).toBeCloseTo(80, 5);
  });

  it("sem faturado, participação é zero", () => {
    expect(concentracaoClientes([]).participacaoPct).toBe(0);
  });
});

describe("progressoMeta", () => {
  it("meta acima: progresso proporcional, batida no alvo", () => {
    expect(progressoMeta(50, 100, "acima")).toEqual({ pct: 50, atingida: false });
    expect(progressoMeta(120, 100, "acima").atingida).toBe(true);
    expect(progressoMeta(120, 100, "acima").pct).toBe(100);
  });

  it("meta abaixo: batida no alvo ou menos; o dobro zera a barra", () => {
    expect(progressoMeta(3, 5, "abaixo")).toEqual({ pct: 100, atingida: true });
    expect(progressoMeta(7.5, 5, "abaixo")).toEqual({ pct: 50, atingida: false });
    expect(progressoMeta(10, 5, "abaixo")).toEqual({ pct: 0, atingida: false });
  });

  it("alvo zero não divide por zero", () => {
    expect(progressoMeta(0, 0, "acima").atingida).toBe(true);
    expect(progressoMeta(1, 0, "abaixo").atingida).toBe(false);
  });
});
