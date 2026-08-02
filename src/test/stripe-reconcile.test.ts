import { describe, it, expect } from "vitest";
import {
  componhePayout,
  confereDePayout,
  paraReais,
  paraCentavos,
  janelaPayout,
  creditoCasaComPayout,
  destinoDoCreditoDePayout,
  descricaoDoPayout,
  externalIdDaTaxa,
  externalIdDoPayout,
  leAssinaturaStripe,
  assinaturaDentroDaJanela,
  cargaAssinada,
  comparaEmTempoConstante,
  hmacSha256Hex,
  assinaturaStripeConfere,
  ehUuid,
  estaPago,
  TOLERANCIA_ASSINATURA_SEGUNDOS,
  type ItemDePayout,
} from "../../supabase/functions/_shared/stripe-reconcile";

const item = (bruto: number, taxa: number, id = "txn_1"): ItemDePayout => ({
  id,
  tipo: "charge",
  bruto,
  taxa,
  liquido: bruto - taxa,
});

describe("composição do lote", () => {
  it("soma bruto, taxa e líquido das cobranças do repasse", () => {
    const c = componhePayout([item(10000, 439, "txn_1"), item(5000, 289, "txn_2")]);
    expect(c).toEqual({ quantidade: 2, bruto: 15000, taxa: 728, liquido: 14272 });
  });

  it("lote vazio é zero, não NaN", () => {
    expect(componhePayout([])).toEqual({ quantidade: 0, bruto: 0, taxa: 0, liquido: 0 });
  });

  it("estorno entra como valor negativo e derruba o líquido", () => {
    const c = componhePayout([item(10000, 439), { ...item(-3000, 0), tipo: "refund", id: "txn_r" }]);
    expect(c.bruto).toBe(7000);
    expect(c.liquido).toBe(6561);
  });
});

describe("conferência do lote", () => {
  it("fecha quando a soma dos itens reproduz o líquido informado", () => {
    const r = confereDePayout(14272, [item(10000, 439, "a"), item(5000, 289, "b")]);
    expect(r.fecha).toBe(true);
    expect(r.diferenca).toBe(0);
  });

  it("não fecha quando falta item no lote, e diz de quanto é o buraco", () => {
    const r = confereDePayout(14272, [item(10000, 439, "a")]);
    expect(r.fecha).toBe(false);
    expect(r.diferenca).toBe(4711);
  });

  it("centavo de diferença já barra: em lote não existe quase fecha", () => {
    expect(confereDePayout(14273, [item(10000, 439, "a"), item(5000, 289, "b")]).fecha).toBe(false);
  });
});

describe("conversão de valor", () => {
  it("centavos viram reais sem erro de ponto flutuante", () => {
    expect(paraReais(14272)).toBe(142.72);
    expect(paraReais(1)).toBe(0.01);
    expect(paraReais(0)).toBe(0);
  });

  it("reais viram centavos inteiros", () => {
    expect(paraCentavos(142.72)).toBe(14272);
    expect(paraCentavos(0.1 + 0.2)).toBe(30);
  });
});

describe("janela de chegada do crédito", () => {
  it("abre três dias para cada lado da data prevista", () => {
    expect(janelaPayout("2026-08-10")).toEqual({ de: "2026-08-07", ate: "2026-08-13" });
  });

  it("atravessa virada de mês sem quebrar", () => {
    expect(janelaPayout("2026-03-01", 2)).toEqual({ de: "2026-02-27", ate: "2026-03-03" });
  });

  it("aceita timestamp completo e usa só a data", () => {
    expect(janelaPayout("2026-08-10T22:15:00Z", 1)).toEqual({ de: "2026-08-09", ate: "2026-08-11" });
  });
});

describe("casamento do crédito bancário", () => {
  it("casa pelo líquido do repasse, não pelo bruto", () => {
    expect(creditoCasaComPayout(142.72, 14272)).toBe(true);
    expect(creditoCasaComPayout(150.0, 14272)).toBe(false);
  });

  it("absorve arredondamento de um centavo", () => {
    expect(creditoCasaComPayout(142.73, 14272)).toBe(true);
    expect(creditoCasaComPayout(142.74, 14272)).toBe(false);
  });
});

describe("classificação contábil do repasse", () => {
  it("o crédito do repasse é transferência, jamais receita", () => {
    expect(destinoDoCreditoDePayout()).toBe("transferencia");
  });

  it("a descrição expõe quantidade, bruto e taxa do lote", () => {
    const d = descricaoDoPayout("po_123", { quantidade: 2, bruto: 15000, taxa: 728, liquido: 14272 });
    expect(d).toContain("po_123");
    expect(d).toContain("2 cobranças");
    expect(d).toContain("150.00");
    expect(d).toContain("7.28");
  });

  it("external_id da taxa e do repasse são distintos e idempotentes", () => {
    expect(externalIdDaTaxa("po_1")).toBe("stripe_fee_po_1");
    expect(externalIdDoPayout("po_1")).toBe("stripe_payout_po_1");
    expect(externalIdDaTaxa("po_1")).not.toBe(externalIdDoPayout("po_1"));
  });
});

describe("assinatura do webhook", () => {
  it("lê timestamp e assinaturas v1", () => {
    expect(leAssinaturaStripe("t=1700000000,v1=abc,v1=def")).toEqual({
      timestamp: 1700000000,
      assinaturas: ["abc", "def"],
    });
  });

  it("ignora esquemas antigos como v0", () => {
    expect(leAssinaturaStripe("t=1700000000,v0=zzz,v1=abc")?.assinaturas).toEqual(["abc"]);
  });

  it("cabeçalho ausente, sem t ou sem v1 não autentica", () => {
    expect(leAssinaturaStripe(null)).toBeNull();
    expect(leAssinaturaStripe("")).toBeNull();
    expect(leAssinaturaStripe("v1=abc")).toBeNull();
    expect(leAssinaturaStripe("t=1700000000")).toBeNull();
    expect(leAssinaturaStripe("t=nao-e-numero,v1=abc")).toBeNull();
  });

  it("recusa assinatura fora da janela de tolerância — replay não passa", () => {
    const t = 1700000000;
    expect(assinaturaDentroDaJanela(t, t + 10)).toBe(true);
    expect(assinaturaDentroDaJanela(t, t + TOLERANCIA_ASSINATURA_SEGUNDOS)).toBe(true);
    expect(assinaturaDentroDaJanela(t, t + TOLERANCIA_ASSINATURA_SEGUNDOS + 1)).toBe(false);
    expect(assinaturaDentroDaJanela(t, t - TOLERANCIA_ASSINATURA_SEGUNDOS - 1)).toBe(false);
  });

  it("a carga assinada é timestamp ponto corpo cru", () => {
    expect(cargaAssinada(123, '{"a":1}')).toBe('123.{"a":1}');
  });

  it("comparação constante distingue igual de diferente e de tamanho diferente", () => {
    expect(comparaEmTempoConstante("abc", "abc")).toBe(true);
    expect(comparaEmTempoConstante("abc", "abd")).toBe(false);
    expect(comparaEmTempoConstante("abc", "ab")).toBe(false);
  });
});

describe("conferência completa da assinatura — a fronteira de confiança", () => {
  const SEGREDO = "whsec_teste_do_webhook";
  const CORPO = '{"id":"evt_1","type":"charge.succeeded","data":{"object":{"amount":10000}}}';
  const AGORA = 1800000000;

  /** Assina como o Stripe assina, para o teste exercitar o caminho de verdade. */
  async function assinaComo(corpo: string, t: number, segredo = SEGREDO) {
    return `t=${t},v1=${await hmacSha256Hex(segredo, cargaAssinada(t, corpo))}`;
  }

  it("aceita a assinatura legítima", async () => {
    const h = await assinaComo(CORPO, AGORA);
    expect(await assinaturaStripeConfere(h, CORPO, SEGREDO, AGORA)).toBe(true);
  });

  it("recusa quando o corpo foi adulterado no caminho", async () => {
    const h = await assinaComo(CORPO, AGORA);
    const adulterado = CORPO.replace("10000", "9999900");
    expect(await assinaturaStripeConfere(h, adulterado, SEGREDO, AGORA)).toBe(false);
  });

  it("recusa assinatura feita com outro segredo — é isso que isola uma empresa da outra", async () => {
    const h = await assinaComo(CORPO, AGORA, "whsec_de_outra_empresa");
    expect(await assinaturaStripeConfere(h, CORPO, SEGREDO, AGORA)).toBe(false);
  });

  it("isola CANAIS da mesma empresa, não só empresas diferentes", async () => {
    // "Loja SP" e "Checkout site" são contas Stripe distintas dentro do mesmo
    // CNPJ, cada uma com o seu whsec. Um evento da loja endereçado ao canal do
    // site não pode passar: seria dinheiro entrando na conta errada, dentro de
    // casa, onde a fronteira de empresa não protege.
    const segredoLoja = "whsec_canal_loja";
    const segredoSite = "whsec_canal_site";
    const h = await assinaComo(CORPO, AGORA, segredoLoja);

    expect(await assinaturaStripeConfere(h, CORPO, segredoLoja, AGORA)).toBe(true);
    expect(await assinaturaStripeConfere(h, CORPO, segredoSite, AGORA)).toBe(false);
  });

  it("recusa replay: assinatura legítima, porém velha", async () => {
    const h = await assinaComo(CORPO, AGORA);
    expect(await assinaturaStripeConfere(h, CORPO, SEGREDO, AGORA + 301)).toBe(false);
  });

  it("aceita quando uma das assinaturas do cabeçalho é a certa (rotação de segredo)", async () => {
    const boa = await hmacSha256Hex(SEGREDO, cargaAssinada(AGORA, CORPO));
    expect(
      await assinaturaStripeConfere(`t=${AGORA},v1=00deadbeef,v1=${boa}`, CORPO, SEGREDO, AGORA),
    ).toBe(true);
  });

  it("sem segredo configurado nada passa, nem cabeçalho bem formado", async () => {
    const h = await assinaComo(CORPO, AGORA);
    expect(await assinaturaStripeConfere(h, CORPO, "", AGORA)).toBe(false);
  });

  it("cabeçalho ausente não passa", async () => {
    expect(await assinaturaStripeConfere(null, CORPO, SEGREDO, AGORA)).toBe(false);
  });
});

describe("metadata não confiável", () => {
  it("aceita uuid de verdade", () => {
    expect(ehUuid("3f2504e0-4f89-11d3-9a0c-0305e82c3301")).toBe(true);
    expect(ehUuid("3F2504E0-4F89-11D3-9A0C-0305E82C3301")).toBe(true);
  });

  it("recusa o que derrubaria a consulta por uuid", () => {
    // Caso real: uma cobrança de teste trazia metadata.receivable_id="teste-composicao".
    // Sem a checagem, o Postgres recusa a query (22P02) e o webhook entra em laço.
    expect(ehUuid("teste-composicao")).toBe(false);
    expect(ehUuid("")).toBe(false);
    expect(ehUuid(null)).toBe(false);
    expect(ehUuid(undefined)).toBe(false);
    expect(ehUuid(123)).toBe(false);
    expect(ehUuid("3f2504e0-4f89-11d3-9a0c")).toBe(false);
    expect(ehUuid("' OR 1=1 --")).toBe(false);
  });
});

describe("status pago", () => {
  it("reconhece os status que significam dinheiro", () => {
    expect(estaPago("succeeded")).toBe(true);
    expect(estaPago("paid")).toBe(true);
  });

  it("pendente, falho ou ausente não é dinheiro", () => {
    expect(estaPago("processing")).toBe(false);
    expect(estaPago("requires_payment_method")).toBe(false);
    expect(estaPago(null)).toBe(false);
    expect(estaPago(undefined)).toBe(false);
  });
});
