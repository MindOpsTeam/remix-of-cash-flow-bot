import { describe, it, expect } from "vitest";
import {
  calcularIbsCbs,
  montarGrupoIbsCbs,
  montarGrupoIbsCbsFocus,
  docExigeDestaque,
  regimeDestacaEm,
  reformaReadiness,
  REFORMA_2026,
  CCLASS_TRIB_PADRAO,
} from "@/lib/reforma";

describe("calcularIbsCbs (ano-teste 2026: CBS 0,9% + IBS 0,1%)", () => {
  it("calcula destaque sobre a base com arredondamento a 2 casas", () => {
    const v = calcularIbsCbs(1000);
    expect(v.cbsValor).toBe(9.0);
    expect(v.ibsValor).toBe(1.0);
    expect(v.cbsAliquota).toBe(0.9);
    expect(v.ibsAliquota).toBe(0.1);
  });

  it("arredonda valores quebrados corretamente", () => {
    const v = calcularIbsCbs(123.45);
    expect(v.cbsValor).toBe(1.11); // 123.45 * 0.009 = 1.11105
    expect(v.ibsValor).toBe(0.12); // 123.45 * 0.001 = 0.12345
  });

  it("base zero produz destaque zero", () => {
    const v = calcularIbsCbs(0);
    expect(v.cbsValor).toBe(0);
    expect(v.ibsValor).toBe(0);
  });
});

describe("montarGrupoIbsCbs", () => {
  it("usa cClassTrib padrão de tributação integral quando não informado", () => {
    const g = montarGrupoIbsCbs(500);
    expect(g.cClassTrib).toBe(CCLASS_TRIB_PADRAO);
    expect(g.cbsValor).toBe(4.5);
  });

  it("aceita cClassTrib customizado", () => {
    expect(montarGrupoIbsCbs(500, "200001").cClassTrib).toBe("200001");
  });
});

describe("docExigeDestaque", () => {
  it("NFe, NFCe, NFSe e CTe exigem; MDFe não", () => {
    expect(docExigeDestaque("nfe")).toBe(true);
    expect(docExigeDestaque("nfce")).toBe(true);
    expect(docExigeDestaque("nfse")).toBe(true);
    expect(docExigeDestaque("cte")).toBe(true);
    expect(docExigeDestaque("mdfe")).toBe(false);
  });
});

describe("regimeDestacaEm", () => {
  it("regime regular destaca desde 2026", () => {
    expect(regimeDestacaEm("regular", 2026)).toBe(true);
    expect(regimeDestacaEm("regular", 2025)).toBe(false);
  });
  it("Simples só a partir de 2027; MEI nunca", () => {
    expect(regimeDestacaEm("simples", 2026)).toBe(false);
    expect(regimeDestacaEm("simples", 2027)).toBe(true);
    expect(regimeDestacaEm("mei", 2027)).toBe(false);
  });
});

describe("reformaReadiness", () => {
  it("empresa regular sem cClassTrib configurado NÃO está pronta", () => {
    const r = reformaReadiness({
      regime: "regular",
      cClassTribPadrao: null,
      emiteDocsComDestaque: true,
    });
    expect(r.pronto).toBe(false);
    expect(r.items.find((i) => i.key === "cclasstrib")?.ok).toBe(false);
  });

  it("empresa regular com tudo configurado está pronta", () => {
    const r = reformaReadiness({
      regime: "regular",
      cClassTribPadrao: "000001",
      emiteDocsComDestaque: true,
    });
    expect(r.pronto).toBe(true);
  });

  it("Simples em 2026 não bloqueia por cClassTrib (só destaca em 2027)", () => {
    const r = reformaReadiness({
      regime: "simples",
      cClassTribPadrao: null,
      emiteDocsComDestaque: true,
    });
    expect(r.pronto).toBe(true);
  });

  it("sem regime informado nunca está pronta", () => {
    const r = reformaReadiness({
      regime: null,
      cClassTribPadrao: null,
      emiteDocsComDestaque: false,
    });
    expect(r.pronto).toBe(false);
  });
});

describe("constantes de vigência", () => {
  it("datas-chave da NT 2025.002 registradas", () => {
    expect(REFORMA_2026.vigenciaDestaque).toBe("2026-01-01");
    expect(REFORMA_2026.inicioRejeicao).toBe("2026-08-03");
  });
});

describe("destaque IBS/CBS no formato da Focus NFe", () => {
  it("usa a mesma conta do mapeador do PlugNotas, só mudando o nome do campo", () => {
    const plug = montarGrupoIbsCbs(1000);
    const focus = montarGrupoIbsCbsFocus(1000);
    expect(focus.ibs_cbs_base_calculo).toBe(plug.baseCalculo);
    expect(focus.cbs_valor).toBe(plug.cbsValor);
    expect(focus.ibs_uf_valor).toBe(plug.ibsUfValor);
    expect(focus.ibs_mun_valor).toBe(plug.ibsMunValor);
    expect(focus.ibs_cbs_situacao_tributaria).toBe(plug.cst);
    expect(focus.ibs_cbs_classificacao_tributaria).toBe(plug.cClassTrib);
  });

  it("aplica as alíquotas do ano-teste sobre a base", () => {
    const g = montarGrupoIbsCbsFocus(1000);
    expect(g.cbs_aliquota).toBe(0.9);
    expect(g.cbs_valor).toBe(9);
    expect(g.ibs_uf_aliquota).toBe(0.1);
    expect(g.ibs_uf_valor).toBe(1);
    expect(g.ibs_mun_valor).toBe(0);
  });
});
