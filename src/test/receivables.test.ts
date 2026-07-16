import { describe, it, expect } from "vitest";
import { effectiveStatus, totalsByStatus, nextDueDate, CYCLE_LABEL } from "@/lib/receivables";

describe("effectiveStatus", () => {
  const today = new Date("2026-07-16T12:00:00Z");
  it("recebido e cancelado são fixos", () => {
    expect(effectiveStatus({ status: "recebido", due_date: "2020-01-01" }, today)).toBe("recebido");
    expect(effectiveStatus({ status: "cancelado", due_date: "2020-01-01" }, today)).toBe("cancelado");
  });
  it("a_receber vira vencido quando passou do vencimento", () => {
    expect(effectiveStatus({ status: "a_receber", due_date: "2026-07-10" }, today)).toBe("vencido");
    expect(effectiveStatus({ status: "a_receber", due_date: "2026-07-20" }, today)).toBe("a_receber");
    expect(effectiveStatus({ status: "a_receber", due_date: "2026-07-16" }, today)).toBe("a_receber");
  });
});

describe("totalsByStatus", () => {
  const today = new Date("2026-07-16T12:00:00Z");
  it("soma por bucket efetivo", () => {
    const t = totalsByStatus([
      { status: "a_receber", due_date: "2026-07-20", amount: 100 },
      { status: "a_receber", due_date: "2026-07-01", amount: 50 }, // vencido
      { status: "recebido", due_date: "2026-06-01", amount: 200 },
      { status: "cancelado", due_date: "2026-06-01", amount: 999 },
    ], today);
    expect(t.aReceber).toBe(100);
    expect(t.vencido).toBe(50);
    expect(t.recebido).toBe(200);
  });
});

describe("nextDueDate", () => {
  it("usa o dia deste mês se ainda não passou", () => {
    expect(nextDueDate(20, new Date(2026, 6, 10))).toBe("2026-07-20");
  });
  it("vai para o mês seguinte se o dia já passou", () => {
    expect(nextDueDate(5, new Date(2026, 6, 10))).toBe("2026-08-05");
  });
  it("clampa dia > 28", () => {
    expect(nextDueDate(31, new Date(2026, 6, 1)).endsWith("-28")).toBe(true);
  });
});

describe("rótulos", () => {
  it("ciclos traduzidos", () => {
    expect(CYCLE_LABEL.MONTHLY).toBe("Mensal");
    expect(CYCLE_LABEL.YEARLY).toBe("Anual");
  });
});
