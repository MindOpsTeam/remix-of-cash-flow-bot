import { describe, it, expect } from "vitest";
import { icmsInterstateRate, calcularDifal, UFS } from "@/lib/icms";

describe("icmsInterstateRate (Res. Senado 22/89 + 13/12)", () => {
  it("importado = 4% independente da rota", () => {
    expect(icmsInterstateRate("SP", "RJ", true)).toBe(4);
    expect(icmsInterstateRate("BA", "CE", true)).toBe(4);
  });

  it("Sul/Sudeste (exceto ES) → N/NE/CO ou ES = 7%", () => {
    expect(icmsInterstateRate("SP", "BA")).toBe(7);   // SE → NE
    expect(icmsInterstateRate("RS", "GO")).toBe(7);   // S → CO
    expect(icmsInterstateRate("MG", "ES")).toBe(7);   // SE → ES (exceção)
    expect(icmsInterstateRate("RJ", "AM")).toBe(7);   // SE → N
  });

  it("demais operações interestaduais = 12%", () => {
    expect(icmsInterstateRate("BA", "SP")).toBe(12);  // NE → SE
    expect(icmsInterstateRate("ES", "SP")).toBe(12);  // ES → SE (ES não está no grupo de origem)
    expect(icmsInterstateRate("SP", "RJ")).toBe(12);  // dentro do grupo S/SE
    expect(icmsInterstateRate("GO", "MT")).toBe(12);  // CO → CO
  });

  it("mesma UF = null (operação interna)", () => {
    expect(icmsInterstateRate("SP", "SP")).toBeNull();
  });

  it("cobre as 27 UFs", () => {
    expect(UFS.length).toBe(27);
  });
});

describe("calcularDifal (EC 87/2015)", () => {
  it("base única: valor × (interna − interestadual)", () => {
    // SP→BA, interna BA 20,5%? usemos 18%; interestadual 7%
    const r = calcularDifal({ valor: 1000, aliquotaInternaDestino: 18, aliquotaInterestadual: 7 });
    expect(r.difal).toBe(110); // 1000 * (0.18 - 0.07)
  });

  it("com FCP soma o adicional do destino", () => {
    const r = calcularDifal({ valor: 1000, aliquotaInternaDestino: 18, aliquotaInterestadual: 7, fcpDestino: 2 });
    expect(r.fcp).toBe(20);
    expect(r.total).toBe(130);
  });

  it("base dupla (por dentro) difere da base única", () => {
    const dupla = calcularDifal({ valor: 1000, aliquotaInternaDestino: 18, aliquotaInterestadual: 7, baseDupla: true });
    const unica = calcularDifal({ valor: 1000, aliquotaInternaDestino: 18, aliquotaInterestadual: 7 });
    // base = (1000 - 70)/(1 - 0.18) = 1134.15; difal = 1134.15*0.18 - 70 = 134.15
    expect(dupla.difal).toBeCloseTo(134.15, 1);
    expect(dupla.difal).toBeGreaterThan(unica.difal);
  });
});
