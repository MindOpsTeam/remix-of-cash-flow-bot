import { describe, it, expect } from "vitest";
import {
  resumirRecompra, ordenarRadar, resumirMrr, ltvPorChurn, formatarIntervalo,
  type RecompraCliente, type MrrMes,
} from "@/lib/recorrencia";

function cliente(over: Partial<RecompraCliente>): RecompraCliente {
  return {
    contact_id: "c", name: "Cliente", whatsapp: null, n_compras: 3,
    primeira_compra: "2026-01-01", ultima_compra: "2026-06-01", total_gasto: 300,
    ticket_medio: 100, intervalo_medio_dias: 30, dias_desde_ultima: 35,
    proxima_esperada: "2026-07-01", tem_contrato: false, status: "previsto", ...over,
  };
}

describe("resumirRecompra", () => {
  it("conta por status e soma a receita quente (previsto + atrasado)", () => {
    const r = resumirRecompra([
      cliente({ status: "previsto", ticket_medio: 100 }),
      cliente({ status: "atrasado", ticket_medio: 200 }),
      cliente({ status: "perdido", ticket_medio: 50 }),
      cliente({ status: "em_dia", ticket_medio: 999 }),
      cliente({ status: "novo", ticket_medio: 999 }),
    ]);
    expect(r.previstos).toBe(1);
    expect(r.atrasados).toBe(1);
    expect(r.receitaEmJogo).toBe(300); // 100 + 200
    expect(r.receitaPerdida).toBe(50);
    expect(r.emDia).toBe(1);
    expect(r.novos).toBe(1);
  });
});

describe("ordenarRadar", () => {
  it("coloca oportunidade quente primeiro e maior ticket antes", () => {
    const ordenado = ordenarRadar([
      cliente({ name: "EmDia", status: "em_dia" }),
      cliente({ name: "AtrasadoPequeno", status: "atrasado", ticket_medio: 10 }),
      cliente({ name: "PrevistoGrande", status: "previsto", ticket_medio: 500 }),
      cliente({ name: "PrevistoPequeno", status: "previsto", ticket_medio: 50 }),
    ]);
    expect(ordenado.map((c) => c.name)).toEqual([
      "PrevistoGrande", "PrevistoPequeno", "AtrasadoPequeno", "EmDia",
    ]);
  });
});

describe("resumirMrr", () => {
  const meses: MrrMes[] = [
    { mes: "2026-05-01", mrr_ativo: 1000, mrr_novo: 200, mrr_perdido: 0, contratos_novos: 2, contratos_perdidos: 0 },
    { mes: "2026-06-01", mrr_ativo: 1100, mrr_novo: 150, mrr_perdido: 50, contratos_novos: 1, contratos_perdidos: 1 },
  ];
  it("usa o mês mais recente e calcula churn sobre o mês anterior", () => {
    const r = resumirMrr(meses);
    expect(r.mrrAtual).toBe(1100);
    expect(r.mrrNovoMes).toBe(150);
    expect(r.mrrPerdidoMes).toBe(50);
    expect(r.netNewMes).toBe(100);
    expect(r.churnPct).toBeCloseTo(5, 5); // 50 / 1000
  });
  it("vazio devolve zeros", () => {
    expect(resumirMrr([]).mrrAtual).toBe(0);
  });
});

describe("ltvPorChurn", () => {
  it("ticket recorrente sobre churn mensal", () => {
    expect(ltvPorChurn(100, 5)).toBe(2000); // 100 / 0.05
  });
  it("sem churn não há LTV finito", () => {
    expect(ltvPorChurn(100, 0)).toBeNull();
  });
});

describe("formatarIntervalo", () => {
  it("dias e meses", () => {
    expect(formatarIntervalo(30)).toBe("30 dias");
    expect(formatarIntervalo(90)).toBe("~3 meses");
    expect(formatarIntervalo(null)).toBe("—");
  });
});
