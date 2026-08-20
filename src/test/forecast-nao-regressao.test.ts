import { describe, expect, it } from "vitest";

import {
  projetarCaixa,
  type Compromisso,
  type MesHistorico,
} from "../../supabase/functions/_shared/forecast";

/**
 * Contrato de não regressão do motor de projeção.
 *
 * A camada de previsibilidade (incerteza, sazonalidade, recompra) entra por
 * PARÂMETROS OPCIONAIS. Este arquivo congela o comportamento de quem chama do
 * jeito antigo: se qualquer camada nova vazar para o caminho padrão, aqui quebra.
 *
 * Não é teste de "o número está certo", é teste de "o número não mudou".
 */

const HISTORICO: MesHistorico[] = [
  { mes: "2026-01", receita: 100_000, despesa: 80_000 },
  { mes: "2026-02", receita: 110_000, despesa: 82_000 },
  { mes: "2026-03", receita: 95_000, despesa: 79_000 },
  { mes: "2026-04", receita: 120_000, despesa: 85_000 },
  { mes: "2026-05", receita: 115_000, despesa: 83_000 },
  { mes: "2026-06", receita: 130_000, despesa: 90_000 },
];

const SEM_COMPROMISSOS: Compromisso[] = [];

describe("projetarCaixa: assinatura antiga produz o resultado antigo", () => {
  it("com histórico e sem compromissos, a base é a média ponderada", () => {
    const r = projetarCaixa(HISTORICO, SEM_COMPROMISSOS, 50_000, 3);

    // média ponderada com peso linear (i+1): recente pesa mais
    // (100*1 + 110*2 + 95*3 + 120*4 + 115*5 + 130*6) / 21 = 116.190,47...
    expect(r.forecast).toHaveLength(3);
    expect(r.forecast[0].projected_revenue).toBeCloseTo(116_190.48, 1);
    expect(r.forecast[0].projected_expense).toBeCloseTo(84_571.43, 1);

    // todos os meses usam a MESMA base quando não há camada nova
    expect(r.forecast[1].projected_revenue).toBeCloseTo(r.forecast[0].projected_revenue, 5);
    expect(r.forecast[2].projected_revenue).toBeCloseTo(r.forecast[0].projected_revenue, 5);
  });

  it("o saldo acumula mês a mês a partir do saldo inicial", () => {
    const r = projetarCaixa(HISTORICO, SEM_COMPROMISSOS, 50_000, 3);
    const delta = r.forecast[0].projected_revenue - r.forecast[0].projected_expense;

    expect(r.forecast[0].saldo_projetado).toBeCloseTo(50_000 + delta, 1);
    expect(r.forecast[1].saldo_projetado).toBeCloseTo(50_000 + delta * 2, 1);
    expect(r.forecast[2].saldo_projetado).toBeCloseTo(50_000 + delta * 3, 1);
  });

  it("contratado maior que a média manda, e vira o valor do mês", () => {
    const hoje = new Date();
    const proximoMes = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() + 1, 15));
    const iso = proximoMes.toISOString().slice(0, 10);

    const r = projetarCaixa(
      HISTORICO,
      [{ data: iso, valor: 500_000, tipo: "entrada", origem: "recebivel" }],
      0,
      3,
    );

    expect(r.forecast[0].contratado_entrada).toBe(500_000);
    expect(r.forecast[0].projected_revenue).toBe(500_000);
  });

  it("contratado menor que a média NÃO derruba a projeção", () => {
    const hoje = new Date();
    const proximoMes = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() + 1, 15));
    const iso = proximoMes.toISOString().slice(0, 10);

    const r = projetarCaixa(
      HISTORICO,
      [{ data: iso, valor: 1_000, tipo: "entrada", origem: "recebivel" }],
      0,
      3,
    );

    // o pouco contratado não substitui a média: seria pessimismo indevido
    expect(r.forecast[0].projected_revenue).toBeCloseTo(116_190.48, 1);
  });

  it("sem histórico nenhum, não explode e devolve zeros", () => {
    const r = projetarCaixa([], SEM_COMPROMISSOS, 10_000, 3);
    expect(r.forecast).toHaveLength(3);
    expect(r.forecast[0].projected_revenue).toBe(0);
    expect(r.forecast[0].saldo_projetado).toBe(10_000);
  });

  it("a confiança continua categórica e nos mesmos degraus", () => {
    const r = projetarCaixa(HISTORICO, SEM_COMPROMISSOS, 50_000, 3);
    for (const m of r.forecast) {
      expect(["high", "medium", "low"]).toContain(m.confidence);
    }
    // mês 1 com histórico longo e baixa volatilidade pontua mais que o mês 3
    const ordem = { high: 3, medium: 2, low: 1 } as const;
    expect(ordem[r.forecast[0].confidence]).toBeGreaterThanOrEqual(ordem[r.forecast[2].confidence]);
  });

  it("devolve runway e base histórica, que a tela consome", () => {
    const r = projetarCaixa(HISTORICO, SEM_COMPROMISSOS, 50_000, 3);
    // baseHistorica é a RECEITA base ponderada, não a contagem de meses
    expect(r.baseHistorica).toBeCloseTo(116_190.48, 1);
    expect(r.runwayMeses === null || typeof r.runwayMeses === "number").toBe(true);
  });

  it("nenhum campo do contrato de saída sumiu", () => {
    const r = projetarCaixa(HISTORICO, SEM_COMPROMISSOS, 50_000, 1);
    // Chave A MAIS é segura (quem consome ignora); chave A MENOS quebra tela.
    // Por isso o teste checa presença, não igualdade exata do conjunto.
    const chaves = Object.keys(r.forecast[0]);
    for (const obrigatoria of [
      "confidence",
      "contratado_entrada",
      "contratado_saida",
      "month",
      "projected_expense",
      "projected_revenue",
      "saldo_projetado",
    ]) {
      expect(chaves).toContain(obrigatoria);
    }
  });

  it("origem_receita diz de onde veio o número, e é sempre um dos três", () => {
    const semNada = projetarCaixa(HISTORICO, SEM_COMPROMISSOS, 50_000, 1);
    expect(semNada.forecast[0].origem_receita).toBe("modelo");

    const proximo = new Date();
    const dataProxima = new Date(Date.UTC(proximo.getUTCFullYear(), proximo.getUTCMonth() + 1, 15))
      .toISOString()
      .slice(0, 10);
    const comContrato = projetarCaixa(
      HISTORICO,
      [{ data: dataProxima, valor: 900_000, tipo: "entrada", origem: "recebivel" }],
      50_000,
      1,
    );
    expect(comContrato.forecast[0].origem_receita).toBe("contratado");

    const comRecompra = projetarCaixa(HISTORICO, SEM_COMPROMISSOS, 50_000, 1, undefined, undefined, [900_000]);
    expect(comRecompra.forecast[0].origem_receita).toBe("recompra");
  });
});

describe("camadas novas: aditivas e sem dupla contagem", () => {
  const proximoMesISO = () => {
    const h = new Date();
    return new Date(Date.UTC(h.getUTCFullYear(), h.getUTCMonth() + 1, 15)).toISOString().slice(0, 10);
  };

  it("banda entra na saída sem mexer em nenhum valor projetado", () => {
    const semBanda = projetarCaixa(HISTORICO, SEM_COMPROMISSOS, 50_000, 2);
    const comBanda = projetarCaixa(HISTORICO, SEM_COMPROMISSOS, 50_000, 2, undefined, [
      { receita: { p10: 90_000, p90: 140_000 }, despesa: { p10: 70_000, p90: 95_000 } },
      { receita: { p10: 85_000, p90: 150_000 }, despesa: { p10: 68_000, p90: 98_000 } },
    ]);

    expect(comBanda.forecast[0].projected_revenue).toBe(semBanda.forecast[0].projected_revenue);
    expect(comBanda.forecast[0].saldo_projetado).toBe(semBanda.forecast[0].saldo_projetado);
    expect(comBanda.forecast[0].faixa_receita).toEqual({ p10: 90_000, p90: 140_000 });
    expect(semBanda.forecast[0].faixa_receita).toBeUndefined();
  });

  it("RISCO Nº1: cliente com recebível E padrão de recompra não conta duas vezes", () => {
    // 500k já contratado no próximo mês, e a recompra esperaria 120k do mesmo período
    const r = projetarCaixa(
      HISTORICO,
      [{ data: proximoMesISO(), valor: 500_000, tipo: "entrada", origem: "recebivel" }],
      0,
      1,
      undefined,
      undefined,
      [120_000],
    );

    // tem que ser o MAIOR, nunca a soma
    expect(r.forecast[0].projected_revenue).toBe(500_000);
    expect(r.forecast[0].projected_revenue).not.toBe(620_000);
  });

  it("recompra manda quando é maior que contratado e que a média", () => {
    const r = projetarCaixa(HISTORICO, SEM_COMPROMISSOS, 0, 1, undefined, undefined, [300_000]);
    expect(r.forecast[0].projected_revenue).toBe(300_000);
    expect(r.forecast[0].esperado_recompra).toBe(300_000);
  });

  it("recompra menor que a média não derruba a projeção", () => {
    const r = projetarCaixa(HISTORICO, SEM_COMPROMISSOS, 0, 1, undefined, undefined, [1_000]);
    expect(r.forecast[0].projected_revenue).toBeCloseTo(116_190.48, 1);
  });

  it("recompra zero não polui a saída com campo vazio", () => {
    const r = projetarCaixa(HISTORICO, SEM_COMPROMISSOS, 0, 1, undefined, undefined, [0]);
    expect(r.forecast[0].esperado_recompra).toBeUndefined();
  });

  it("base do modelo por mês continua funcionando junto das camadas novas", () => {
    const r = projetarCaixa(
      HISTORICO, SEM_COMPROMISSOS, 0, 2,
      [{ receita: 200_000, despesa: 100_000 }, { receita: 210_000, despesa: 101_000 }],
      undefined,
      [50_000, 50_000],
    );
    expect(r.forecast[0].projected_revenue).toBe(200_000);
    expect(r.forecast[1].projected_revenue).toBe(210_000);
  });
});
