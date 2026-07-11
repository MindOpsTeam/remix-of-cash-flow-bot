import { describe, it, expect } from "vitest";
import {
  mapPluggyTransaction,
  mapBelvoTransaction,
  mapTransaction,
  normalizePluggyStatus,
  canPullHistory,
  OFB_HISTORY_CALLS_LIMIT,
} from "@/lib/openfinance";

describe("mapPluggyTransaction", () => {
  it("valor positivo vira receita, negativo vira despesa, sempre com valor absoluto", () => {
    const receita = mapPluggyTransaction({ id: "t1", description: "PIX recebido", amount: 1500, date: "2026-07-10T00:00:00.000Z", type: "CREDIT", accountId: "a1" });
    expect(receita.direction).toBe("revenue");
    expect(receita.amount).toBe(1500);
    expect(receita.date).toBe("2026-07-10");
    expect(receita.account_external_id).toBe("a1");

    const despesa = mapPluggyTransaction({ id: "t2", description: "Compra", amount: -230.5, date: "2026-07-09T12:00:00.000Z", type: "DEBIT" });
    expect(despesa.direction).toBe("expense");
    expect(despesa.amount).toBe(230.5);
  });

  it("cartão de crédito: type=CREDIT com amount NEGATIVO (compra) é despesa (o sinal manda)", () => {
    // Caso real observado no sandbox: SMART FIT / SPOTIFY vêm como type=CREDIT, amount<0
    const compra = mapPluggyTransaction({ id: "c1", description: "SMART FIT ACADEMIA", amount: -89.9, date: "2026-07-10", type: "CREDIT" });
    expect(compra.direction).toBe("expense");
    expect(compra.amount).toBe(89.9);
  });

  it("desempate por type apenas quando amount = 0", () => {
    expect(mapPluggyTransaction({ id: "z1", amount: 0, date: "2026-01-01", type: "DEBIT" }).direction).toBe("expense");
    expect(mapPluggyTransaction({ id: "z2", amount: 0, date: "2026-01-01", type: "CREDIT" }).direction).toBe("revenue");
  });

  it("sem type, infere pela direção do sinal", () => {
    expect(mapPluggyTransaction({ id: "t", amount: 10, date: "2026-01-01" }).direction).toBe("revenue");
    expect(mapPluggyTransaction({ id: "t", amount: -10, date: "2026-01-01" }).direction).toBe("expense");
  });

  it("usa descriptionRaw como fallback e extrai paymentMethod", () => {
    const t = mapPluggyTransaction({ id: "t", descriptionRaw: "TED XPTO", amount: -5, date: "2026-01-01", type: "DEBIT", paymentData: { paymentMethod: "TED" } });
    expect(t.description).toBe("TED XPTO");
    expect(t.payment_method).toBe("TED");
  });
});

describe("mapBelvoTransaction", () => {
  it("INFLOW/OUTFLOW mapeiam para receita/despesa; value_date vira date", () => {
    const inflow = mapBelvoTransaction({ id: "b1", amount: 900, description: "Depósito", value_date: "2026-07-08", type: "INFLOW", account: { id: "acc" } });
    expect(inflow.direction).toBe("revenue");
    expect(inflow.date).toBe("2026-07-08");
    expect(inflow.account_external_id).toBe("acc");

    const outflow = mapBelvoTransaction({ id: "b2", amount: 120, description: "Pagamento", value_date: "2026-07-07", type: "OUTFLOW" });
    expect(outflow.direction).toBe("expense");
  });
});

describe("mapTransaction (dispatcher)", () => {
  it("roteia por provider", () => {
    expect(mapTransaction("pluggy", { id: "x", amount: 1, date: "2026-01-01", type: "CREDIT" }).direction).toBe("revenue");
    expect(mapTransaction("belvo", { id: "y", amount: 1, value_date: "2026-01-01", type: "OUTFLOW" }).direction).toBe("expense");
  });
});

describe("normalizePluggyStatus", () => {
  it("mapeia os status conhecidos e cai em error no resto", () => {
    expect(normalizePluggyStatus("UPDATED")).toBe("updated");
    expect(normalizePluggyStatus("LOGIN_ERROR")).toBe("login_error");
    expect(normalizePluggyStatus("OUTDATED")).toBe("outdated");
    expect(normalizePluggyStatus("SOMETHING_ELSE")).toBe("error");
  });
});

describe("canPullHistory (limite OFB)", () => {
  it("bloqueia ao atingir o teto mensal de 8 chamadas", () => {
    expect(OFB_HISTORY_CALLS_LIMIT).toBe(8);
    expect(canPullHistory(0)).toBe(true);
    expect(canPullHistory(7)).toBe(true);
    expect(canPullHistory(8)).toBe(false);
    expect(canPullHistory(20)).toBe(false);
  });
});
