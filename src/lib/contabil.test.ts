import { describe, it, expect } from "vitest";
import {
  classificarPorPadrao, validarClassificacao, normalizarDescricao,
} from "../../supabase/functions/_shared/contabil-heuristica";
import {
  conhecimentoContabilParaPrompt, NATUREZA_DAS_CONTAS, PRINCIPIOS_CFC, ARMADILHAS,
} from "../../supabase/functions/_shared/contabil-br";

describe("normalizarDescricao", () => {
  it("tira acento, caixa e espaço extra (é assim que o banco escreve)", () => {
    expect(normalizarDescricao("  Taxa   de Antecipação ")).toBe("TAXA DE ANTECIPACAO");
  });
});

describe("classificarPorPadrao — tributos e encargos", () => {
  it("DAS do Simples é imposto sobre faturamento (5.7)", () => {
    const r = classificarPorPadrao("PAGAMENTO DAS SIMPLES NACIONAL", "expense");
    expect(r.sugestao?.codigo).toBe("5.7");
  });

  it("FGTS/INSS é encargo de pessoal (5.2), NÃO imposto", () => {
    expect(classificarPorPadrao("GRF FGTS 07/2026", "expense").sugestao?.codigo).toBe("5.2");
    expect(classificarPorPadrao("GPS INSS COMPETENCIA 07", "expense").sugestao?.codigo).toBe("5.2");
  });
});

describe("classificarPorPadrao — o erro clássico de custo x despesa", () => {
  it("taxa de maquininha é CUSTO (4.3), não despesa administrativa", () => {
    const r = classificarPorPadrao("TAXA CARTAO STONE", "expense");
    expect(r.sugestao?.codigo).toBe("4.3");
  });

  it("tarifa bancária é despesa financeira (5.8), não custo", () => {
    const r = classificarPorPadrao("TARIFA MANUTENCAO DE CONTA", "expense");
    expect(r.sugestao?.codigo).toBe("5.8");
  });

  it("juros e IOF vão para 5.8, nunca para o custo do produto", () => {
    expect(classificarPorPadrao("JUROS DE MORA", "expense").sugestao?.codigo).toBe("5.8");
    expect(classificarPorPadrao("IOF SOBRE OPERACAO", "expense").sugestao?.codigo).toBe("5.8");
  });
});

describe("classificarPorPadrao — o que NÃO é resultado", () => {
  it("transferência entre contas próprias é bloqueada", () => {
    const r = classificarPorPadrao("TRANSFERENCIA ENTRE CONTAS", "revenue");
    expect(r.bloqueio).not.toBeNull();
    expect(r.sugestao).toBeNull();
  });

  it("aporte de sócio não é receita (princípio da Entidade)", () => {
    expect(classificarPorPadrao("APORTE DE SOCIO", "revenue").bloqueio).not.toBeNull();
  });

  it("empréstimo recebido é passivo, não receita", () => {
    expect(classificarPorPadrao("LIBERACAO EMPRESTIMO CAPITAL DE GIRO", "revenue").bloqueio).not.toBeNull();
  });

  it("distribuição de lucro não é despesa", () => {
    expect(classificarPorPadrao("DISTRIBUICAO DE LUCRO SOCIOS", "expense").bloqueio).not.toBeNull();
  });
});

describe("validarClassificacao", () => {
  const receita = { id: "a", code: "3.1", type: "revenue" };
  const despesa = { id: "b", code: "5.4", type: "expense" };

  it("aceita a combinação correta", () => {
    expect(validarClassificacao({ tipo: "revenue", descricao: "VENDA DE SERVICO", conta: receita })).toEqual([]);
  });

  it("barra entrada classificada em conta de despesa", () => {
    const p = validarClassificacao({ tipo: "revenue", descricao: "PIX RECEBIDO", conta: despesa });
    expect(p.some((x) => x.gravidade === "erro")).toBe(true);
  });

  it("barra saída classificada em conta de receita", () => {
    const p = validarClassificacao({ tipo: "expense", descricao: "PAGAMENTO FORNECEDOR", conta: receita });
    expect(p.some((x) => x.gravidade === "erro")).toBe(true);
  });

  it("barra transferência entre contas próprias mesmo com conta válida", () => {
    const p = validarClassificacao({ tipo: "revenue", descricao: "TRANSFERENCIA ENTRE CONTAS", conta: receita });
    expect(p.some((x) => x.gravidade === "erro")).toBe(true);
  });

  it("alerta quando a descrição contradiz a conta escolhida", () => {
    // maquininha (4.3) classificada como aluguel (5.4)
    const p = validarClassificacao({ tipo: "expense", descricao: "TAXA CARTAO CIELO", conta: despesa });
    expect(p.some((x) => x.gravidade === "alerta")).toBe(true);
  });

  it("sem conta não inventa erro de natureza", () => {
    expect(validarClassificacao({ tipo: "expense", descricao: "COMPRA QUALQUER", conta: null })).toEqual([]);
  });
});

describe("base de conhecimento", () => {
  it("o prompt carrega princípios, natureza das contas e armadilhas", () => {
    const texto = conhecimentoContabilParaPrompt();
    expect(texto).toContain("Competência");
    expect(texto).toContain("CUSTO x DESPESA");
    expect(texto).toContain("CENTRO DE CUSTO");
    expect(texto).toContain("4.3");
    expect(texto.length).toBeGreaterThan(1500);
  });

  it("toda conta do plano padrão tem natureza declarada", () => {
    const codigos = NATUREZA_DAS_CONTAS.map((n) => n.codigo);
    for (const c of ["3.1", "3.2", "4.1", "4.3", "5.2", "5.3", "5.7", "5.8"]) {
      expect(codigos, `faltou ${c}`).toContain(c);
    }
  });

  it("todo princípio cita a norma que o sustenta", () => {
    for (const p of PRINCIPIOS_CFC) expect(p.norma.length).toBeGreaterThan(5);
  });

  it("toda armadilha diz o erro E o correto", () => {
    for (const a of ARMADILHAS) {
      expect(a.erro.length).toBeGreaterThan(5);
      expect(a.correto.length).toBeGreaterThan(10);
    }
  });
});
