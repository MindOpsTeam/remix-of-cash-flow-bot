import { describe, it, expect } from "vitest";
import {
  mapPessoa,
  mapProduto,
  mapServico,
  mapContaReceber,
  mapContaPagar,
  mapearLote,
  externalId,
} from "../../supabase/functions/_shared/contaazul-map";

describe("externalId", () => {
  it("prefixa recurso e recusa id vazio", () => {
    expect(externalId("pessoa", "abc-123")).toBe("ca:pessoa:abc-123");
    expect(externalId("pessoa", "")).toBeNull();
    expect(externalId("pessoa", undefined)).toBeNull();
  });
});

describe("mapPessoa", () => {
  it("mapeia cliente com aliases de nome e documento", () => {
    const p = mapPessoa({ id: "p1", razao_social: "ACME Ltda", cpf_cnpj: "12345678000199", email: "x@acme.com" })!;
    expect(p).toMatchObject({ external_id: "ca:pessoa:p1", name: "ACME Ltda", document: "12345678000199", type: "customer" });
  });

  it("perfil FORNECEDOR vira supplier (lista ou campo único)", () => {
    expect(mapPessoa({ id: "p2", nome: "Forn", perfis: ["FORNECEDOR"] })!.type).toBe("supplier");
    expect(mapPessoa({ id: "p3", nome: "Forn2", tipo_perfil: "fornecedor" })!.type).toBe("supplier");
  });

  it("sem id ou sem nome, pula", () => {
    expect(mapPessoa({ nome: "Sem id" })).toBeNull();
    expect(mapPessoa({ id: "p4" })).toBeNull();
  });
});

describe("mapProduto / mapServico", () => {
  it("produto com preço em alias e custo", () => {
    const p = mapProduto({ id: "pr1", nome: "Widget", codigo: "W-1", valor_venda: "150.5", custo: 80 })!;
    expect(p).toMatchObject({ external_id: "ca:produto:pr1", sku: "W-1", sell_price: 150.5, cost_price: 80, type: "product" });
  });

  it("serviço nunca tem custo e marca type service", () => {
    const sv = mapServico({ id: "sv1", nome: "Consultoria", valor: 900 })!;
    expect(sv).toMatchObject({ type: "service", sell_price: 900, cost_price: null });
  });

  it("preço ausente vira 0, não NaN", () => {
    expect(mapProduto({ id: "pr2", nome: "Sem preço" })!.sell_price).toBe(0);
  });
});

describe("mapContaReceber", () => {
  it("aberto vs recebido pela situação, com data de pagamento", () => {
    const aberto = mapContaReceber({ id: "r1", valor: 500, data_vencimento: "2026-08-10", situacao: "EM_ABERTO" })!;
    expect(aberto.status).toBe("a_receber");
    expect(aberto.payment_date).toBeNull();

    const pago = mapContaReceber({ id: "r2", valor: 300, data_vencimento: "2026-07-01", situacao: "RECEBIDO", data_pagamento: "2026-07-02T10:00:00Z" })!;
    expect(pago.status).toBe("recebido");
    expect(pago.payment_date).toBe("2026-07-02");
  });

  it("valor zero, negativo ou data inválida pulam", () => {
    expect(mapContaReceber({ id: "r3", valor: 0, data_vencimento: "2026-08-01" })).toBeNull();
    expect(mapContaReceber({ id: "r4", valor: 100, data_vencimento: "10/08/2026" })).toBeNull();
  });
});

describe("mapContaPagar", () => {
  it("fornecedor aninhado e status pago", () => {
    const b = mapContaPagar({ id: "b1", valor: 1200, vencimento: "2026-08-05", situacao: "PAGO", fornecedor: { nome: "Energia SA" } })!;
    expect(b).toMatchObject({ external_id: "ca:pagar:b1", fornecedor: "Energia SA", status: "pago" });
  });

  it("sem fornecedor identificável usa rótulo padrão", () => {
    expect(mapContaPagar({ id: "b2", valor: 10, vencimento: "2026-08-05" })!.fornecedor).toBe("Fornecedor (Conta Azul)");
  });
});

describe("mapearLote", () => {
  it("separa válidos de pulados e aguenta lixo", () => {
    const { validos, resumo } = mapearLote(
      [{ id: "p1", nome: "Ok" }, { nome: "sem id" }, null, "string"],
      mapPessoa,
    );
    expect(validos).toHaveLength(1);
    expect(resumo).toEqual({ mapeados: 1, pulados: 3 });
  });

  it("entrada não-lista vira lote vazio", () => {
    expect(mapearLote(undefined, mapPessoa).resumo).toEqual({ mapeados: 0, pulados: 0 });
  });
});
