import { describe, it, expect } from "vitest";
import {
  toTotals,
  formatMonth,
  formatPercent,
  marginTone,
  lastMonthsKeys,
  companyColor,
  COMPANY_COLORS,
} from "@/lib/margin";

describe("toTotals", () => {
  it("consolida receita, custos e despesas em totais e margens", () => {
    // Arrange
    const rows = [
      { receita: 1000, custos: 400, despesas: 200 },
      { receita: 500, custos: 100, despesas: 100 },
    ];

    // Act
    const t = toTotals(rows);

    // Assert
    expect(t.receita).toBe(1500);
    expect(t.custos).toBe(500);
    expect(t.despesas).toBe(300);
    expect(t.margemBrutaValor).toBe(1000);
    expect(t.resultado).toBe(700);
    expect(t.margemBruta).toBeCloseTo(66.666, 2);
    expect(t.margemOperacional).toBeCloseTo(46.666, 2);
  });

  it("retorna margens 0 quando receita é 0 (sem divisão por zero)", () => {
    const t = toTotals([{ receita: 0, custos: 100, despesas: 50 }]);
    expect(t.margemBruta).toBe(0);
    expect(t.margemOperacional).toBe(0);
    expect(t.resultado).toBe(-150);
  });

  it("trata valores nulos/ausentes como 0", () => {
    const t = toTotals([
      { receita: 100, custos: null as unknown as number, despesas: undefined as unknown as number },
    ]);
    expect(t.custos).toBe(0);
    expect(t.despesas).toBe(0);
    expect(t.resultado).toBe(100);
  });

  it("lista vazia produz totais zerados", () => {
    const t = toTotals([]);
    expect(t.receita).toBe(0);
    expect(t.margemBruta).toBe(0);
  });
});

describe("formatMonth", () => {
  it("formata YYYY-MM-DD como MêsAbrev/AA", () => {
    expect(formatMonth("2026-01-01")).toBe("Jan/26");
    expect(formatMonth("2025-12-01")).toBe("Dez/25");
  });
});

describe("formatPercent", () => {
  it("formata com 1 casa por padrão", () => {
    expect(formatPercent(46.666)).toBe("46.7%");
  });
  it("respeita digits customizado", () => {
    expect(formatPercent(46.666, 0)).toBe("47%");
  });
});

describe("marginTone", () => {
  it("classifica faixas semânticas da margem", () => {
    expect(marginTone(20)).toBe("good");
    expect(marginTone(15)).toBe("good");
    expect(marginTone(14.9)).toBe("warn");
    expect(marginTone(0)).toBe("warn");
    expect(marginTone(-0.1)).toBe("bad");
  });
});

describe("lastMonthsKeys", () => {
  it("gera N meses terminando no mês de referência, mais antigos primeiro", () => {
    const ref = new Date(2026, 6, 9); // Jul/2026
    const keys = lastMonthsKeys(3, ref);
    expect(keys).toEqual(["2026-05-01", "2026-06-01", "2026-07-01"]);
  });

  it("atravessa a virada de ano corretamente", () => {
    const ref = new Date(2026, 0, 15); // Jan/2026
    const keys = lastMonthsKeys(2, ref);
    expect(keys).toEqual(["2025-12-01", "2026-01-01"]);
  });
});

describe("companyColor", () => {
  it("cicla pelas cores de forma estável", () => {
    expect(companyColor(0)).toBe(COMPANY_COLORS[0]);
    expect(companyColor(COMPANY_COLORS.length)).toBe(COMPANY_COLORS[0]);
  });
});
