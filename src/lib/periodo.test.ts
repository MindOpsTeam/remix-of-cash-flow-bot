import { describe, it, expect } from "vitest";
import { calcularJanela, type PontoPeriodo } from "@/lib/periodo";

// 12 meses: ago/2025 → jul/2026, receita crescente e simples de somar.
const trend: PontoPeriodo[] = Array.from({ length: 12 }, (_, i) => {
  const d = new Date(2025, 7 + i, 1); // começa em agosto/2025
  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  return { key, receita: 100 + i * 10, custos: 40, despesas: 20 };
});

describe("calcularJanela", () => {
  it("mês atual (sem mesKey) usa o último mês e o anterior como base", () => {
    const j = calcularJanela(trend, { mode: "mes" });
    expect(j.current.receita).toBe(210); // jul/2026 = 100 + 11*10
    expect(j.previous.receita).toBe(200); // jun/2026
    expect(j.temComparacao).toBe(true);
    expect(j.periodoLabel).toBe("julho de 2026");
    expect(j.comparacaoLabel).toBe("vs mês anterior");
  });

  it("primeiro mês da janela não tem base de comparação", () => {
    const j = calcularJanela(trend, { mode: "mes", mesKey: "2025-08-01" });
    expect(j.current.receita).toBe(100);
    expect(j.temComparacao).toBe(false);
    expect(j.comparacaoLabel).toBe("sem mês anterior");
  });

  it("intervalo soma o período e compara com o período anterior de mesmo tamanho", () => {
    // mai–jul/2026 (índices 9,10,11) vs fev–abr/2026 (índices 6,7,8)
    const j = calcularJanela(trend, { mode: "intervalo", inicioKey: "2026-05-01", fimKey: "2026-07-01" });
    expect(j.current.receita).toBe(190 + 200 + 210); // 600
    expect(j.previous.receita).toBe(160 + 170 + 180); // 510
    expect(j.temComparacao).toBe(true);
    expect(j.comparacaoLabel).toBe("vs período anterior");
    expect(j.periodoLabel).toBe("Mai/26 – Jul/26");
  });

  it("intervalo sem histórico anterior suficiente marca sem comparação", () => {
    // jan–jul/2026 (7 meses); antes só há ago–dez/2025 (5 meses) → sem base igual
    const j = calcularJanela(trend, { mode: "intervalo", inicioKey: "2026-01-01", fimKey: "2026-07-01" });
    expect(j.temComparacao).toBe(false);
    expect(j.comparacaoLabel).toBe("7 meses");
  });

  it("ano acumula os meses do ano e marca acumulado quando parcial", () => {
    const j = calcularJanela(trend, { mode: "ano", ano: "2026" });
    // jan–jul/2026 = índices 5..11 → receitas 150..210
    expect(j.current.receita).toBe(150 + 160 + 170 + 180 + 190 + 200 + 210);
    expect(j.temComparacao).toBe(false); // não há jan–jul/2025 na janela
    expect(j.periodoLabel).toBe("Ano 2026 (acumulado)");
    expect(j.comparacaoLabel).toBe("acumulado do ano");
  });

  it("trend vazio devolve zeros sem quebrar", () => {
    const j = calcularJanela([], { mode: "mes" });
    expect(j.current.receita).toBe(0);
    expect(j.temComparacao).toBe(false);
  });
});
