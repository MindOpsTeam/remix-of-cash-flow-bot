import { describe, it, expect } from "vitest";
import {
  TEMPLATES_AGENTES,
  TEMPLATE_POR_KEY,
  avaliarCaixaBaixo,
  avaliarContasAVencer,
  avaliarImpostos,
  avaliarMeta,
} from "../../supabase/functions/_shared/templates-agentes";

describe("catálogo de templates", () => {
  it("todo template tem chave única, link e dedupe positivo", () => {
    const chaves = TEMPLATES_AGENTES.map((t) => t.key);
    expect(new Set(chaves).size).toBe(chaves.length);
    for (const t of TEMPLATES_AGENTES) {
      expect(t.link.startsWith("/")).toBe(true);
      expect(t.dedupeDias).toBeGreaterThan(0);
      expect(TEMPLATE_POR_KEY[t.key]).toBe(t);
    }
  });

  it("templates de IA estão marcados e os determinísticos não", () => {
    expect(TEMPLATE_POR_KEY.resumo_semanal.requerIa).toBe(true);
    expect(TEMPLATE_POR_KEY.analista_custom.requerIa).toBe(true);
    expect(TEMPLATE_POR_KEY.caixa_baixo.requerIa).toBe(false);
  });
});

describe("avaliarCaixaBaixo", () => {
  it("alerta só quando o saldo apurado fica abaixo do limite", () => {
    expect(avaliarCaixaBaixo(5000, 10000)?.titulo).toBe("Caixa abaixo do limite");
    expect(avaliarCaixaBaixo(15000, 10000)).toBeNull();
    expect(avaliarCaixaBaixo(10000, 10000)).toBeNull();
  });

  it("sem saldo apurado, não inventa alerta", () => {
    expect(avaliarCaixaBaixo(null, 10000)).toBeNull();
  });
});

describe("avaliarContasAVencer", () => {
  const hoje = "2026-07-30";

  it("soma a janela, destaca vencidas e o maior fornecedor", () => {
    const aviso = avaliarContasAVencer(
      [
        { valor: 1000, vencimento: "2026-08-01", fornecedor: "Energia SA" },
        { valor: 5000, vencimento: "2026-07-28", fornecedor: "Aluguel Ltda" },
        { valor: 200, vencimento: "2026-09-15", fornecedor: "Fora da janela" },
      ],
      hoje,
      3,
    );
    expect(aviso?.titulo).toBe("Contas a pagar vencidas");
    expect(aviso?.corpo).toContain("2 conta(s)");
    expect(aviso?.corpo).toContain("Aluguel Ltda");
    expect(aviso?.corpo).not.toContain("Fora da janela");
  });

  it("sem conta na janela, silêncio", () => {
    expect(avaliarContasAVencer([{ valor: 100, vencimento: "2026-12-01" }], hoje, 3)).toBeNull();
  });
});

describe("avaliarImpostos", () => {
  it("só guias dentro da janela futura contam", () => {
    const aviso = avaliarImpostos(
      [
        { valor: 800, vencimento: "2026-08-03", tipo: "DAS" },
        { valor: 300, vencimento: "2026-07-01", tipo: "vencida-nao-entra" },
      ],
      "2026-07-30",
      7,
    );
    expect(aviso?.corpo).toContain("1 guia(s)");
    expect(aviso?.corpo).toContain("DAS");
  });
});

describe("avaliarMeta", () => {
  it("meta acima batida celebra; abaixo estourada alerta; resto silencia", () => {
    expect(
      avaliarMeta({ metric_key: "receita_mes", label: "Receita", valor: 120, alvo: 100, direcao: "acima", formato: "currency" })?.titulo,
    ).toContain("Meta batida");
    expect(
      avaliarMeta({ metric_key: "inadimplencia", label: "Inadimplência", valor: 9, alvo: 5, direcao: "abaixo", formato: "percent" })?.titulo,
    ).toContain("Meta estourada");
    expect(
      avaliarMeta({ metric_key: "receita_mes", label: "Receita", valor: 80, alvo: 100, direcao: "acima", formato: "currency" }),
    ).toBeNull();
    expect(
      avaliarMeta({ metric_key: "inadimplencia", label: "Inadimplência", valor: 3, alvo: 5, direcao: "abaixo", formato: "percent" }),
    ).toBeNull();
  });
});
