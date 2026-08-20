import { describe, expect, it } from "vitest";

import {
  bandaPorResiduo,
  bandasDoHorizonte,
  MINIMO_MESES_BANDA,
  residuosRelativos,
} from "../../supabase/functions/_shared/analytics/incerteza";
import {
  aplicarSazonalidade,
  basesSazonais,
  fatoresSazonais,
  MINIMO_MESES_SAZONALIDADE,
} from "../../supabase/functions/_shared/analytics/sazonalidade";
import {
  avaliar,
  cobertura,
  dentroDaBanda,
  frasePrecisao,
  MINIMO_AVALIACOES,
  vies,
  wape,
} from "../../supabase/functions/_shared/analytics/acuracia";
import {
  entradaEsperadaDoMes,
  intervaloRobusto,
  probabilidadeAte,
  probabilidadeNoMes,
  TETO_PROBABILIDADE,
  type ClientePadrao,
} from "../../supabase/functions/_shared/analytics/recompra";
import type { MesHistorico } from "../../supabase/functions/_shared/forecast";

/* ------------------------------------------------------------------ */
/* Incerteza                                                           */
/* ------------------------------------------------------------------ */

const SERIE_ESTAVEL = [100, 102, 98, 101, 99, 100, 101, 99];
const SERIE_VOLATIL = [100, 180, 40, 160, 30, 190, 20, 170];

describe("banda de incerteza", () => {
  it("p10 < p50 < p90, sempre", () => {
    const b = bandaPorResiduo(SERIE_ESTAVEL, 100, 1)!;
    expect(b).not.toBeNull();
    expect(b.p10).toBeLessThan(b.p50);
    expect(b.p50).toBeLessThan(b.p90);
  });

  it("série volátil produz banda mais larga que série estável", () => {
    const estavel = bandaPorResiduo(SERIE_ESTAVEL, 100, 1)!;
    const volatil = bandaPorResiduo(SERIE_VOLATIL, 100, 1)!;
    const larguraEstavel = estavel.p90 - estavel.p10;
    const larguraVolatil = volatil.p90 - volatil.p10;
    expect(larguraVolatil).toBeGreaterThan(larguraEstavel);
  });

  it("a banda abre com o horizonte: prever 3 meses é mais incerto que 1", () => {
    const m1 = bandaPorResiduo(SERIE_VOLATIL, 100, 1)!;
    const m3 = bandaPorResiduo(SERIE_VOLATIL, 100, 3)!;
    expect(m3.p90 - m3.p10).toBeGreaterThan(m1.p90 - m1.p10);
  });

  it("p10 nunca fica negativo: caixa previsto negativo lê-se como zero", () => {
    const b = bandaPorResiduo(SERIE_VOLATIL, 10, 3)!;
    expect(b.p10).toBeGreaterThanOrEqual(0);
  });

  it("com menos de 6 meses devolve null, e o chamador segue sem banda", () => {
    expect(bandaPorResiduo([100, 100, 100, 100, 100], 100, 1)).toBeNull();
    expect(MINIMO_MESES_BANDA).toBe(6);
  });

  it("base zero ou negativa devolve null em vez de banda sem sentido", () => {
    expect(bandaPorResiduo(SERIE_ESTAVEL, 0, 1)).toBeNull();
    expect(bandaPorResiduo(SERIE_ESTAVEL, -50, 1)).toBeNull();
  });

  it("declara em quantas observações a banda se apoia", () => {
    const b = bandaPorResiduo(SERIE_ESTAVEL, 100, 1)!;
    expect(b.observacoes).toBe(residuosRelativos(SERIE_ESTAVEL).length);
    expect(b.observacoes).toBeGreaterThan(0);
  });

  it("bandasDoHorizonte devolve uma entrada por mês projetado", () => {
    const hist: MesHistorico[] = SERIE_ESTAVEL.map((v, i) => ({
      mes: `2026-0${(i % 9) + 1}`,
      receita: v * 1000,
      despesa: v * 800,
    }));
    const bandas = bandasDoHorizonte(hist, [
      { receita: 100_000, despesa: 80_000 },
      { receita: 100_000, despesa: 80_000 },
    ]);
    expect(bandas).toHaveLength(2);
    expect(bandas[0].receita).not.toBeNull();
    expect(bandas[0].despesa).not.toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* Sazonalidade                                                        */
/* ------------------------------------------------------------------ */

/** Dois anos: dezembro sempre o dobro, o resto estável. */
function doisAnosComDezembroForte(): Array<{ mes: string; valor: number }> {
  const out: Array<{ mes: string; valor: number }> = [];
  for (const ano of [2025, 2026]) {
    for (let m = 1; m <= 12; m++) {
      out.push({ mes: `${ano}-${String(m).padStart(2, "0")}`, valor: m === 12 ? 200 : 100 });
    }
  }
  return out;
}

describe("sazonalidade", () => {
  it("com dois ciclos, dezembro forte vira fator maior que 1", () => {
    const f = fatoresSazonais(doisAnosComDezembroForte())!;
    expect(f).not.toBeNull();
    const dez = f.find((x) => x.mes === 12)!;
    expect(dez.fator).toBeGreaterThan(1.5);
    const jun = f.find((x) => x.mes === 6)!;
    expect(jun.fator).toBeCloseTo(1, 1);
  });

  it("exige 24 meses: com um ciclo devolve null em vez de confundir tendência com sazonalidade", () => {
    const umAno = doisAnosComDezembroForte().slice(0, 12);
    expect(fatoresSazonais(umAno)).toBeNull();
    expect(MINIMO_MESES_SAZONALIDADE).toBe(24);
  });

  it("um único mês atípico não vira regra, porque usamos mediana", () => {
    const dados = doisAnosComDezembroForte();
    // um março absurdo num único ano
    const i = dados.findIndex((d) => d.mes === "2026-03");
    dados[i] = { mes: "2026-03", valor: 5_000 };

    const f = fatoresSazonais(dados)!;
    const mar = f.find((x) => x.mes === 3)!;
    // mediana entre 100 e 5000 = 2550... mas o limitador segura em 2.0
    expect(mar.fator).toBeLessThanOrEqual(2.0);
  });

  it("os fatores ficam limitados entre 0,5 e 2", () => {
    const dados = doisAnosComDezembroForte().map((d) =>
      d.mes.endsWith("-01") ? { ...d, valor: 1 } : d,
    );
    const f = fatoresSazonais(dados)!;
    for (const x of f) {
      expect(x.fator).toBeGreaterThanOrEqual(0.5);
      expect(x.fator).toBeLessThanOrEqual(2.0);
    }
  });

  it("aplicarSazonalidade multiplica a base do mês alvo", () => {
    const f = fatoresSazonais(doisAnosComDezembroForte())!;
    const base = 100_000;
    expect(aplicarSazonalidade(base, 12, f)).toBeGreaterThan(base);
    // mês sem fator conhecido fica neutro
    expect(aplicarSazonalidade(base, 99, f)).toBe(base);
  });

  it("basesSazonais devolve null sem histórico suficiente, preservando o caminho antigo", () => {
    const curto: MesHistorico[] = [{ mes: "2026-01", receita: 100, despesa: 80 }];
    expect(basesSazonais(curto, 100, 80, [2, 3, 4])).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* Acurácia                                                            */
/* ------------------------------------------------------------------ */

describe("acurácia", () => {
  it("WAPE de erro conhecido bate com a conta feita à mão", () => {
    // erros 10 + 10 = 20; reais 100 + 100 = 200 → 10%
    const r = wape([
      { previsto: 110, real: 100 },
      { previsto: 90, real: 100 },
    ]);
    expect(r).toBeCloseTo(0.1, 5);
  });

  it("real somando zero devolve null em vez de Infinity", () => {
    expect(wape([{ previsto: 50, real: 0 }])).toBeNull();
  });

  it("viés positivo denuncia sistema otimista", () => {
    const v = vies([
      { previsto: 120, real: 100 },
      { previsto: 130, real: 100 },
    ])!;
    expect(v).toBeGreaterThan(0);
  });

  it("erros simétricos dão viés perto de zero mesmo com WAPE alto", () => {
    const pares = [
      { previsto: 150, real: 100 },
      { previsto: 50, real: 100 },
    ];
    expect(vies(pares)!).toBeCloseTo(0, 5);
    expect(wape(pares)!).toBeCloseTo(0.5, 5);
  });

  it("abaixo do mínimo de avaliações não inventa número", () => {
    const r = avaliar([{ previsto: 100, real: 90 }]);
    expect(r.wape).toBeNull();
    expect(r.observacoes).toBe(1);
    expect(MINIMO_AVALIACOES).toBe(3);
  });

  it("a frase da tela diz que está medindo quando não há base", () => {
    expect(frasePrecisao(avaliar([{ previsto: 1, real: 1 }]))).toMatch(/Ainda medindo/i);
  });

  it("a frase da tela informa o erro quando há base", () => {
    const r = avaliar([
      { previsto: 110, real: 100 },
      { previsto: 90, real: 100 },
      { previsto: 105, real: 100 },
    ]);
    expect(frasePrecisao(r)).toMatch(/erro médio foi de \d+%/);
  });

  it("cobertura mede quantas vezes o real caiu dentro da banda anunciada", () => {
    expect(dentroDaBanda(100, 80, 120)).toBe(true);
    expect(dentroDaBanda(130, 80, 120)).toBe(false);

    const c = cobertura([
      { real: 100, p10: 80, p90: 120 },
      { real: 110, p10: 80, p90: 120 },
      { real: 200, p10: 80, p90: 120 },
      { real: 90, p10: 80, p90: 120 },
    ])!;
    expect(c).toBeCloseTo(0.75, 5);
  });
});

/* ------------------------------------------------------------------ */
/* Recompra                                                            */
/* ------------------------------------------------------------------ */

const HOJE = new Date("2026-08-19T12:00:00Z");

function cliente(over: Partial<ClientePadrao> = {}): ClientePadrao {
  return {
    contact_id: "c1",
    ticket_medio: 1_000,
    intervalo_dias: 30,
    desvio_dias: 5,
    ultima_compra: "2026-07-20", // 30 dias atrás
    n_compras: 6,
    ...over,
  };
}

describe("recompra como entrada de caixa", () => {
  it("cliente no ponto do ciclo tem probabilidade alta de comprar logo", () => {
    const p = probabilidadeAte(cliente(), 15, HOJE);
    expect(p).toBeGreaterThan(0.5);
  });

  it("nunca chega a 100%: nenhum cliente é certo", () => {
    const p = probabilidadeAte(cliente({ ultima_compra: "2026-06-01" }), 60, HOJE);
    expect(p).toBeLessThanOrEqual(TETO_PROBABILIDADE);
  });

  it("cliente sumido há mais de 2 ciclos pesa zero: é win-back, não previsão", () => {
    const sumido = cliente({ ultima_compra: "2026-01-01", intervalo_dias: 30 });
    expect(probabilidadeAte(sumido, 30, HOJE)).toBe(0);
  });

  it("com menos de 3 compras não há padrão, e sim coincidência", () => {
    expect(probabilidadeAte(cliente({ n_compras: 2 }), 30, HOJE)).toBe(0);
  });

  it("o mesmo cliente não é contado cheio em dois meses seguidos", () => {
    const c = cliente();
    const mes1 = probabilidadeNoMes(c, 0, 30, HOJE);
    const mes2 = probabilidadeNoMes(c, 30, 60, HOJE);
    expect(mes1 + mes2).toBeLessThanOrEqual(TETO_PROBABILIDADE + 0.001);
  });

  it("cliente irregular espalha a probabilidade em vez de concentrar", () => {
    const relogio = probabilidadeNoMes(cliente({ desvio_dias: 1 }), 0, 30, HOJE);
    const irregular = probabilidadeNoMes(cliente({ desvio_dias: 25 }), 0, 30, HOJE);
    expect(relogio).toBeGreaterThan(irregular);
  });

  it("entrada esperada é ticket vezes probabilidade, nunca o ticket cheio", () => {
    const r = entradaEsperadaDoMes([cliente()], 1, HOJE);
    expect(r.valor).toBeGreaterThan(0);
    expect(r.valor).toBeLessThan(1_000);
    expect(r.clientes).toBe(1);
  });

  it("carteira sem padrão devolve zero, sem inflar o caixa", () => {
    const r = entradaEsperadaDoMes([cliente({ n_compras: 1 })], 1, HOJE);
    expect(r.valor).toBe(0);
    expect(r.clientes).toBe(0);
  });
});

describe("intervalo robusto (mediana) contra a média atual", () => {
  it("uma compra atípica não desloca o intervalo típico", () => {
    // compras a cada 30 dias, com um intervalo gigante no meio
    const datas = ["2026-01-01", "2026-01-31", "2026-03-02", "2026-09-01", "2026-10-01"];
    const r = intervaloRobusto(datas)!;

    // a média dos intervalos seria puxada pelo salto de ~183 dias
    const mediaSimples = (new Date("2026-10-01").getTime() - new Date("2026-01-01").getTime()) /
      86_400_000 / (datas.length - 1);

    expect(r.intervalo_dias).toBeLessThan(mediaSimples);
    expect(r.intervalo_dias).toBeGreaterThanOrEqual(30);
    expect(r.intervalo_dias).toBeLessThanOrEqual(32);
  });

  it("relata a dispersão e quantos intervalos sustentam o número", () => {
    const r = intervaloRobusto(["2026-01-01", "2026-01-31", "2026-03-02"])!;
    expect(r.n_intervalos).toBe(2);
    expect(r.desvio_dias).toBeGreaterThanOrEqual(0);
  });

  it("uma compra só não gera padrão", () => {
    expect(intervaloRobusto(["2026-01-01"])).toBeNull();
  });
});
