import { describe, expect, it, vi } from "vitest";
import {
  caminhoDaRota,
  dataValida,
  ESCOPO_DA_ROTA,
  limiteDaBusca,
  STATUS_DE_CONTA,
  temEscopo,
} from "../../supabase/functions/_shared/api-publica";
import {
  checarLimite,
  corpoLimitado,
  origemDaChamada,
  segredosBatem,
} from "../../supabase/functions/_shared/limite";

/**
 * Trava do hardening de 29/08/2026.
 *
 * Cada bloco aqui corresponde a um buraco que estava aberto em produção, não a
 * uma hipótese. O que estes testes seguram é a REGRESSÃO: a `public-api` já
 * lia `scopes` e ignorava, e nada acusou por meses porque não havia nada
 * afirmando que escopo é para valer.
 */

describe("escopo da chave de API", () => {
  it("a chave com `read` abre todas as rotas — nenhuma chave já emitida perde acesso", () => {
    // `read` é o default da tabela desde 20260709050000_api_keys.sql. Se este
    // teste cair, a mudança quebrou integração de cliente em produção.
    for (const exigido of Object.values(ESCOPO_DA_ROTA)) {
      expect(temEscopo(["read"], exigido)).toBe(true);
    }
  });

  it("a chave com escopo fino abre só a rota dela", () => {
    expect(temEscopo(["transactions:read"], "transactions:read")).toBe(true);
    expect(temEscopo(["transactions:read"], "bills:read")).toBe(false);
    expect(temEscopo(["transactions:read"], "invoices:read")).toBe(false);
  });

  it("chave sem escopo nenhum não lê nada", () => {
    expect(temEscopo([], "transactions:read")).toBe(false);
    expect(temEscopo(null, "transactions:read")).toBe(false);
    expect(temEscopo(undefined, "read")).toBe(false);
  });

  it("`scopes` corrompido não vira permissão", () => {
    // A coluna é text[], mas quem escreve nela é o front. Um valor fora do
    // formato não pode virar "deixa passar" por acidente de tipo.
    expect(temEscopo("read", "read")).toBe(false);
    expect(temEscopo({ read: true }, "read")).toBe(false);
    expect(temEscopo(1, "read")).toBe(false);
  });

  it("toda rota atendida tem escopo declarado", () => {
    // O 404 da função vem de não achar a rota no mapa. Uma rota nova sem escopo
    // não fica aberta: fica inalcançável. Este teste é o lembrete disso.
    const rotasAtendidas = ["/v1/ping", "/v1/transactions", "/v1/margin", "/v1/invoices", "/v1/bills"];
    for (const rota of rotasAtendidas) {
      expect(ESCOPO_DA_ROTA[rota], `rota ${rota} sem escopo`).toBeTruthy();
    }
  });
});

describe("caminho e limite da busca", () => {
  it("barra no fim não muda a rota", () => {
    expect(caminhoDaRota("/functions/v1/public-api/v1/margin")).toBe("/v1/margin");
    expect(caminhoDaRota("/functions/v1/public-api/v1/margin/")).toBe("/v1/margin");
  });

  it("apara o limit no teto em vez de recusar", () => {
    expect(limiteDaBusca("50")).toBe(50);
    expect(limiteDaBusca("99999")).toBe(500);
    expect(limiteDaBusca(null)).toBe(100);
    expect(limiteDaBusca("abacaxi")).toBe(100);
    expect(limiteDaBusca("-10")).toBe(100);
  });

  it("o status de conta a pagar é uma lista fechada", () => {
    expect(STATUS_DE_CONTA).toEqual(["a_vencer", "vencido", "pago"]);
  });
});

describe("data que entra no filtro", () => {
  it("aceita data que existe", () => {
    expect(dataValida("2026-01-31")).toBe("2026-01-31");
    expect(dataValida("2024-02-29")).toBe("2024-02-29"); // bissexto
  });

  it("recusa dia que não existe", () => {
    // `new Date("2026-02-30")` não explode: rola para 02/03. Sem a comparação
    // de ida e volta, uma data inventada passaria como boa.
    expect(dataValida("2026-02-30")).toBeNull();
    expect(dataValida("2025-02-29")).toBeNull();
    expect(dataValida("2026-13-01")).toBeNull();
  });

  it("recusa qualquer coisa que não seja YYYY-MM-DD", () => {
    expect(dataValida("2026-01-01,amount.gt.0")).toBeNull();
    expect(dataValida("31/01/2026")).toBeNull();
    expect(dataValida("")).toBeNull();
    expect(dataValida(null)).toBeNull();
  });
});

describe("comparação de segredo", () => {
  it("bate quando é igual", () => {
    expect(segredosBatem("s3gr3d0-do-webhook", "s3gr3d0-do-webhook")).toBe(true);
  });

  it("não bate quando difere, inclusive no último byte", () => {
    expect(segredosBatem("s3gr3d0-do-webhook", "s3gr3d0-do-webhookX")).toBe(false);
    expect(segredosBatem("s3gr3d0-do-webhooc", "s3gr3d0-do-webhook")).toBe(false);
    expect(segredosBatem("X3gr3d0-do-webhook", "s3gr3d0-do-webhook")).toBe(false);
  });

  it("ausência nunca é igualdade", () => {
    // O caso que importa: `webhooks.secret_token` nulo não pode virar
    // "mandou nada, então confere".
    expect(segredosBatem(null, "segredo")).toBe(false);
    expect(segredosBatem("segredo", null)).toBe(false);
    expect(segredosBatem(null, null)).toBe(false);
    expect(segredosBatem("", "")).toBe(false);
  });

  it("compara todos os bytes quando o tamanho é igual", () => {
    // Não dá para medir tempo de forma estável num teste. O que dá para afirmar
    // é o contrato: duas cadeias do mesmo tamanho que diferem só no fim
    // continuam sendo recusadas, que é o caminho onde o `!==` saía cedo.
    const base = "a".repeat(64);
    expect(segredosBatem(base.slice(0, 63) + "b", base)).toBe(false);
    expect(segredosBatem(base, base)).toBe(true);
  });
});

describe("teto de corpo", () => {
  const pedido = (corpo: string, contentLength?: string) =>
    new Request("https://exemplo.test/webhook-receiver/x", {
      method: "POST",
      headers: contentLength ? { "content-length": contentLength } : undefined,
      body: corpo,
    });

  it("deixa passar corpo dentro do teto", async () => {
    const r = await corpoLimitado(pedido('{"ok":true}'), 1024);
    expect(r).toEqual({ texto: '{"ok":true}' });
  });

  it("recusa corpo acima do teto", async () => {
    const r = await corpoLimitado(pedido("x".repeat(2048)), 1024);
    expect("erro" in r).toBe(true);
  });

  it("não acredita no content-length do cliente", async () => {
    // Quem quer abusar simplesmente mente no header. A conta que vale é a do
    // que chegou, não a do que foi declarado.
    const r = await corpoLimitado(pedido("x".repeat(2048), "10"), 1024);
    expect("erro" in r).toBe(true);
  });

  it("conta bytes, não caracteres", async () => {
    // 400 emoji são 400 caracteres e 1600 bytes. Um teto medido em `.length`
    // deixaria passar quatro vezes o que deveria.
    const r = await corpoLimitado(pedido("😀".repeat(400)), 1000);
    expect("erro" in r).toBe(true);
  });
});

describe("teto de requisição", () => {
  const cliente = (resposta: unknown, erro: unknown = null) => ({
    rpc: vi.fn().mockResolvedValue({ data: resposta, error: erro }),
  });

  it("deixa passar dentro do teto", async () => {
    const db = cliente({
      permitido: true,
      contador: 3,
      teto: 60,
      reinicia_em: new Date(Date.now() + 30_000).toISOString(),
    });
    const r = await checarLimite(db, "teste", 60, 60);
    expect(r.excedeu).toBe(false);
    expect(r.contador).toBe(3);
    expect(db.rpc).toHaveBeenCalledWith("consumir_limite", {
      p_bucket: "teste",
      p_teto: 60,
      p_janela_segundos: 60,
    });
  });

  it("barra com 429 e Retry-After quando estoura", async () => {
    const db = cliente({
      permitido: false,
      contador: 61,
      teto: 60,
      reinicia_em: new Date(Date.now() + 30_000).toISOString(),
    });
    const r = await checarLimite(db, "teste", 60, 60);
    expect(r.excedeu).toBe(true);

    const resposta = r.resposta({});
    expect(resposta.status).toBe(429);
    expect(Number(resposta.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(resposta.headers.get("X-RateLimit-Limit")).toBe("60");
  });

  it("falha ABERTO quando o banco não responde", async () => {
    // Decisão consciente: derrubar o webhook de um banco ou de um emissor por
    // causa de indisponibilidade NOSSA é pior que deixar passar. O limite
    // existe contra abuso, não contra o parceiro.
    const db = cliente(null, { message: "connection refused" });
    const r = await checarLimite(db, "teste", 60, 60);
    expect(r.excedeu).toBe(false);
  });

  it("falha ABERTO quando a RPC explode", async () => {
    const db = { rpc: vi.fn().mockRejectedValue(new Error("boom")) };
    const r = await checarLimite(db, "teste", 60, 60);
    expect(r.excedeu).toBe(false);
  });
});

describe("origem da chamada", () => {
  const pedido = (headers: Record<string, string>) =>
    new Request("https://exemplo.test/", { headers });

  it("usa o primeiro IP do x-forwarded-for", () => {
    expect(origemDaChamada(pedido({ "x-forwarded-for": "203.0.113.9, 10.0.0.1" })))
      .toBe("203.0.113.9");
  });

  it("sem header conhecido, todos caem num balde só — mas ainda contam", () => {
    // Pior para quem usa direito, e é de propósito: o que não pode acontecer é
    // uma chamada sem origem identificável escapar da contagem.
    expect(origemDaChamada(pedido({}))).toBe("sem-origem");
  });
});

describe("a ponte com o Prova", () => {
  /**
   * O contrato está em `docs/CONTRATO-RECEITA.md`, copiado nos três
   * repositórios da casa. O que se prende aqui é a superfície: rota
   * declarada, escopo reusado e nenhuma porta nova.
   */
  test("as duas rotas do Prova existem e pedem escopo", () => {
    expect(ESCOPO_DA_ROTA["/v1/prova/receita"]).toBe("transactions:read");
    expect(ESCOPO_DA_ROTA["/v1/prova/identidade"]).toBe("read");
  });

  /**
   * Escopo de TRANSAÇÃO, não um `prova:read` próprio.
   *
   * A ponte lê exatamente o que o escopo de transação cobre — receita
   * conciliada do período. Um escopo novo daria a impressão de um acesso
   * diferente do que existe, e quem revogasse transação esperaria, com razão,
   * que a ponte parasse junto. Escopo que não corresponde ao que a rota lê é
   * o mesmo defeito de `scopes` ter existido sem ser comparado com nada.
   */
  test("a ponte não inventa escopo próprio", () => {
    expect(temEscopo(["transactions:read"], ESCOPO_DA_ROTA["/v1/prova/receita"]!)).toBe(true);
    expect(temEscopo(["bills:read"], ESCOPO_DA_ROTA["/v1/prova/receita"]!)).toBe(false);
    expect(Object.values(ESCOPO_DA_ROTA)).not.toContain("prova:read");
  });

  test("o caminho da ponte resolve com o prefixo da função", () => {
    expect(caminhoDaRota("/functions/v1/public-api/v1/prova/receita")).toBe("/v1/prova/receita");
    expect(caminhoDaRota("/public-api/v1/prova/identidade")).toBe("/v1/prova/identidade");
  });
});
