import { describe, it, expect } from "vitest";
import {
  CATALOGO_INTEGRACOES, INTEGRACAO_POR_ID, integracoesPorCategoria,
  camposFaltando, progressoConfiguracao,
} from "@/lib/integracoes-catalogo";
import { IDS_COM_DETECCAO } from "@/lib/integracoes-io";

describe("catálogo de integrações", () => {
  it("todo item tem guia com passos, custo e ganho declarados", () => {
    for (const i of CATALOGO_INTEGRACOES) {
      expect(i.guia.passos.length, `${i.id} sem passos`).toBeGreaterThanOrEqual(3);
      expect(i.guia.custo.length, `${i.id} sem custo`).toBeGreaterThan(20);
      expect(i.ganho.length, `${i.id} sem ganho`).toBeGreaterThan(20);
    }
  });

  it("ids são únicos e o índice bate com a lista", () => {
    const ids = CATALOGO_INTEGRACOES.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(Object.keys(INTEGRACAO_POR_ID).length).toBe(ids.length);
  });

  it("todo campo secreto é password ou file (nunca texto à vista)", () => {
    for (const i of CATALOGO_INTEGRACOES) {
      for (const c of i.campos.filter((c) => c.segredo)) {
        expect(["password", "file"], `${i.id}.${c.key}`).toContain(c.tipo);
      }
    }
  });

  it("select sempre traz opções", () => {
    for (const i of CATALOGO_INTEGRACOES) {
      for (const c of i.campos.filter((c) => c.tipo === "select")) {
        expect(c.opcoes?.length, `${i.id}.${c.key}`).toBeGreaterThan(1);
      }
    }
  });

  it("agrupa por categoria sem perder nenhum item", () => {
    const total = integracoesPorCategoria().reduce((s, g) => s + g.itens.length, 0);
    expect(total).toBe(CATALOGO_INTEGRACOES.length);
  });
});

describe("camposFaltando", () => {
  const asaas = INTEGRACAO_POR_ID.asaas;

  it("aponta o que falta para salvar", () => {
    expect(camposFaltando(asaas, {})).toContain("Chave de API");
  });

  it("vazio quando os obrigatórios estão preenchidos", () => {
    expect(camposFaltando(asaas, { api_key: "abc123" })).toEqual([]);
  });

  it("espaço em branco não conta como preenchido", () => {
    expect(camposFaltando(asaas, { api_key: "   " })).toContain("Chave de API");
  });
});

describe("progressoConfiguracao", () => {
  it("conta as configuradas sobre o total", () => {
    const p = progressoConfiguracao(["asaas", "openfinance"]);
    expect(p.feitas).toBe(2);
    expect(p.total).toBe(CATALOGO_INTEGRACOES.length);
    expect(p.pct).toBe(Math.round((2 / CATALOGO_INTEGRACOES.length) * 100));
  });

  it("ignora id desconhecido", () => {
    expect(progressoConfiguracao(["inexistente"]).feitas).toBe(0);
  });
});

describe("catálogo e detecção andam juntos", () => {
  it("toda integração do catálogo sabe ser detectada como configurada", () => {
    // Drift real que já aconteceu: o Stripe entrou no catálogo e a detecção não
    // soube dele — ficaria "não configurado" para sempre e o progresso da
    // plataforma nunca fecharia em 100%.
    const semDeteccao = CATALOGO_INTEGRACOES
      .map((i) => i.id)
      .filter((id) => !(IDS_COM_DETECCAO as readonly string[]).includes(id));
    expect(semDeteccao).toEqual([]);
  });

  it("não existe detecção órfã, apontando para integração que saiu do catálogo", () => {
    const ids = CATALOGO_INTEGRACOES.map((i) => i.id);
    const orfas = (IDS_COM_DETECCAO as readonly string[]).filter((id) => !ids.includes(id));
    expect(orfas).toEqual([]);
  });
});
