import { describe, expect, it } from "vitest";
import { mensagemDaEdge, mensagemDoCorpo } from "@/lib/edge-erro";

/**
 * O supabase-js transforma QUALQUER resposta não-2xx de edge function na mesma
 * frase: "Edge Function returned a non-2xx status code". A explicação real fica
 * no corpo, dentro de error.context. Sem isto, o usuário lê uma frase que não
 * diz nada e não sugere nada, e abre um chamado que não existe suporte para
 * atender.
 */

/** Imita o FunctionsHttpError do supabase-js. */
function erroDeEdge(corpo: unknown, status = 400) {
  return {
    name: "FunctionsHttpError",
    message: "Edge Function returned a non-2xx status code",
    context: {
      status,
      json: async () => corpo,
      text: async () => JSON.stringify(corpo),
    },
  };
}

describe("mensagem real em vez da frase genérica", () => {
  it("lê a explicação de dentro do corpo", async () => {
    const e = erroDeEdge({ error: "Stripe não configurado: informe a chave secreta em Configurações." });
    expect(await mensagemDaEdge(e)).toBe("Stripe não configurado: informe a chave secreta em Configurações.");
  });

  it("prefere `detalhe`, que é o campo mais específico das nossas edges", async () => {
    const e = erroDeEdge({ error: "READ_ONLY_ROLE", detalhe: "Seu perfil é somente leitura nesta empresa." });
    expect(await mensagemDaEdge(e)).toBe("Seu perfil é somente leitura nesta empresa.");
  });

  it("traduz código cru para frase de gente", async () => {
    const e = erroDeEdge({ error: "EVOLUTION_NOT_CONFIGURED" }, 409);
    const m = await mensagemDaEdge(e);
    expect(m).toContain("URL e a API key");
    expect(m).not.toBe("EVOLUTION_NOT_CONFIGURED");
  });

  it("desce um nível quando o provedor aninha em error.message", async () => {
    const e = erroDeEdge({ error: { message: "No such customer: cus_123" } });
    expect(await mensagemDaEdge(e)).toBe("No such customer: cus_123");
  });

  it("aceita corpo em texto puro", async () => {
    const e = {
      name: "FunctionsHttpError",
      message: "Edge Function returned a non-2xx status code",
      context: { status: 500, json: async () => { throw new Error("não é json"); }, text: async () => "Boom no servidor" },
    };
    expect(await mensagemDaEdge(e)).toBe("Boom no servidor");
  });
});

describe("nunca troca o erro por um erro sobre o erro", () => {
  it("corpo ilegível cai no padrão informado", async () => {
    const e = {
      name: "FunctionsHttpError",
      message: "Edge Function returned a non-2xx status code",
      context: { status: 500, json: async () => { throw new Error("x"); }, text: async () => { throw new Error("y"); } },
    };
    expect(await mensagemDaEdge(e, "A conexão falhou.")).toBe("A conexão falhou.");
  });

  it("erro comum sem contexto mantém a própria mensagem", async () => {
    expect(await mensagemDaEdge(new Error("Sem rede"))).toBe("Sem rede");
  });

  it("nulo e vazio não quebram", async () => {
    expect(await mensagemDaEdge(null, "padrão")).toBe("padrão");
    expect(await mensagemDaEdge(undefined, "padrão")).toBe("padrão");
  });

  it("a frase genérica NUNCA é devolvida quando não há corpo", async () => {
    const e = { name: "FunctionsHttpError", message: "Edge Function returned a non-2xx status code" };
    expect(await mensagemDaEdge(e, "A conexão falhou.")).toBe("A conexão falhou.");
  });
});

describe("corpo 200 que carrega erro dentro", () => {
  it("extrai a mensagem", () => {
    expect(mensagemDoCorpo({ error: "Canal Stripe não pertence a esta empresa." }))
      .toBe("Canal Stripe não pertence a esta empresa.");
  });

  it("devolve null quando não há erro nenhum", () => {
    expect(mensagemDoCorpo({ ok: true, saldo: 10 })).toBeNull();
    expect(mensagemDoCorpo(null)).toBeNull();
  });
});
