import { describe, it, expect } from "vitest";
import {
  simplesAliquotaEfetiva,
  anexoPorFatorR,
  cbsFracao,
  ibsFracao,
  issFracaoLegado,
  simularRegimes,
  ANOS_PROJECAO,
  IVA_REF_TOTAL,
  type RegimeSimInput,
} from "@/lib/reforma-simulator";

describe("simplesAliquotaEfetiva", () => {
  it("faixa 1 do anexo III = 6% nominal sem dedução", () => {
    expect(simplesAliquotaEfetiva(180_000, "III")).toBe(6);
  });
  it("faixa 2 do anexo III aplica dedução", () => {
    // (300000*0.112 - 9360)/300000 = 8.08%
    expect(simplesAliquotaEfetiva(300_000, "III")).toBe(8.08);
  });
  it("acima do teto de 4,8M retorna NaN (desenquadrado)", () => {
    expect(Number.isNaN(simplesAliquotaEfetiva(5_000_000, "III"))).toBe(true);
  });
  it("rbt12 zero retorna 0", () => {
    expect(simplesAliquotaEfetiva(0, "I")).toBe(0);
  });
});

describe("anexoPorFatorR", () => {
  it("folha/receita >= 28% => anexo III", () => {
    expect(anexoPorFatorR(30_000, 100_000)).toBe("III");
    expect(anexoPorFatorR(28_000, 100_000)).toBe("III");
  });
  it("folha/receita < 28% => anexo V", () => {
    expect(anexoPorFatorR(10_000, 100_000)).toBe("V");
  });
});

describe("cronograma de transição", () => {
  it("CBS entra cheia em 2027, nada em 2026", () => {
    expect(cbsFracao(2027)).toBe(1);
    expect(cbsFracao(2026)).toBe(0);
  });
  it("IBS: 0 até 2028, sobe 10pp/ano 2029-2032, integral em 2033", () => {
    expect(ibsFracao(2028)).toBe(0);
    expect(ibsFracao(2029)).toBe(0.1);
    expect(ibsFracao(2032)).toBe(0.4);
    expect(ibsFracao(2033)).toBe(1);
  });
  it("ISS legado é complementar ao IBS e some em 2033", () => {
    expect(issFracaoLegado(2028)).toBe(1);
    expect(issFracaoLegado(2030)).toBe(0.8);
    expect(issFracaoLegado(2033)).toBe(0);
  });
  it("alíquota de referência do IVA ~26,5%", () => {
    expect(IVA_REF_TOTAL).toBeCloseTo(26.5, 1);
  });
});

describe("simularRegimes", () => {
  const microServico: RegimeSimInput = {
    faturamentoAnual: 180_000,
    atividade: "servico",
    folhaAnual: 60_000, // Fator R 0.33 => anexo III
    insumosCreditaveis: 0,
    perfilCliente: "B2C",
  };

  it("projeta os 7 anos 2027-2033", () => {
    const r = simularRegimes(microServico);
    expect(r.anos.map((a) => a.ano)).toEqual([...ANOS_PROJECAO]);
  });

  it("micro serviço B2C: Simples é o mais barato (carga acumulada)", () => {
    const r = simularRegimes(microServico);
    // 180000 * 6% = 10800/ano * 7 anos
    expect(r.totais.simples).toBe(75_600);
    expect(r.recomendado).toBe("simples");
    expect(r.anexoUsado).toBe("III");
    expect(r.economiaVsPior).toBeGreaterThan(0);
  });

  it("gera crédito médio ao cliente > 0 quando há valor agregado", () => {
    const r = simularRegimes(microServico);
    expect(r.creditoAoClienteMedioAno).toBeGreaterThan(0);
  });

  it("empresa desenquadrada do Simples (>4,8M) recomenda outro regime", () => {
    const grande: RegimeSimInput = {
      faturamentoAnual: 6_000_000,
      atividade: "servico",
      folhaAnual: 1_000_000,
      insumosCreditaveis: 1_500_000,
      perfilCliente: "B2B",
    };
    const r = simularRegimes(grande);
    expect(Number.isNaN(r.totais.simples)).toBe(true);
    expect(r.recomendado).not.toBe("simples");
    expect(["hibrido", "normal"]).toContain(r.recomendado);
  });

  it("melhor de cada ano é um dos três regimes", () => {
    const r = simularRegimes(microServico);
    for (const a of r.anos) {
      expect(["simples", "hibrido", "normal"]).toContain(a.melhor);
    }
  });

  it("redução setorial de 60% baixa Híbrido/Normal e o crédito, sem mexer no Simples", () => {
    const base: RegimeSimInput = {
      faturamentoAnual: 600_000, atividade: "servico", folhaAnual: 200_000,
      insumosCreditaveis: 50_000, perfilCliente: "B2B",
    };
    const integral = simularRegimes(base);
    const reduzido = simularRegimes({ ...base, reducaoIva: 0.6 });
    expect(reduzido.totais.hibrido).toBeLessThan(integral.totais.hibrido);
    expect(reduzido.totais.normal).toBeLessThan(integral.totais.normal);
    expect(reduzido.totais.simples).toBe(integral.totais.simples); // DAS não usa alíquota IVA
    expect(reduzido.creditoAoClienteMedioAno).toBeLessThan(integral.creditoAoClienteMedioAno);
  });

  it("alíquota zero (reducao=1) zera o IVA e o crédito ao cliente", () => {
    const r = simularRegimes({
      faturamentoAnual: 300_000, atividade: "servico", folhaAnual: 90_000,
      insumosCreditaveis: 0, perfilCliente: "B2B", reducaoIva: 1,
    });
    expect(r.creditoAoClienteMedioAno).toBe(0);
  });
});
