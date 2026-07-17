import { describe, it, expect } from "vitest";
import { ivaAliquotaAno, analisarCreditoB2B } from "@/lib/reforma-credito";
import type { ClienteCarteira } from "@/hooks/useReformaCarteira";

describe("ivaAliquotaAno", () => {
  it("2033 pleno ≈ 26,5%", () => {
    expect(ivaAliquotaAno(2033)).toBeCloseTo(0.265, 3);
  });
  it("2027 só CBS ≈ 8,8% (IBS ainda em teste)", () => {
    expect(ivaAliquotaAno(2027)).toBeCloseTo(0.088, 3);
  });
  it("redução 60% aplica sobre a alíquota", () => {
    expect(ivaAliquotaAno(2033, 0.6)).toBeCloseTo(0.106, 3);
  });
});

describe("analisarCreditoB2B", () => {
  const clientes: ClienteCarteira[] = [
    { contactId: "1", nome: "Indústria PJ", tipo: "B2B", receitaAno: 100_000 },
    { contactId: "2", nome: "Consumidor", tipo: "B2C", receitaAno: 50_000 },
    { contactId: "3", nome: "Atacado PJ", tipo: "B2B", receitaAno: 200_000 },
  ];

  it("considera só B2B e ordena por risco desc", () => {
    const r = analisarCreditoB2B(clientes);
    expect(r.clientesB2B).toBe(2);
    expect(r.porCliente[0].contactId).toBe("3"); // maior receita → maior risco
    expect(r.receitaB2B).toBe(300_000);
  });

  it("crédito em risco = cheio − simples (regime pleno 2033)", () => {
    const r = analisarCreditoB2B(clientes);
    const c3 = r.porCliente.find((c) => c.contactId === "3")!;
    expect(c3.creditoCheio).toBe(53_000); // 200000 × 0,265
    expect(c3.creditoSimples).toBe(5_000); // 200000 × 0,025
    expect(c3.creditoEmRisco).toBe(48_000);
    expect(r.creditoEmRiscoTotal).toBeGreaterThan(0);
  });

  it("carteira sem B2B → tudo zero", () => {
    const r = analisarCreditoB2B([{ contactId: "x", nome: "PF", tipo: "B2C", receitaAno: 9_999 }]);
    expect(r.clientesB2B).toBe(0);
    expect(r.creditoEmRiscoTotal).toBe(0);
  });
});
