import { describe, it, expect } from "vitest";
import {
  isValidCNPJ,
  isValidCPF,
  isValidDocument,
  formatDocument,
  newIdIntegracao,
  mapNfse,
  mapNfe,
  mapNfce,
  mapCte,
  mapMdfe,
  extractErrorMessage,
  type NfeFormData,
  type NfseFormData,
} from "@/lib/plugnotas";

describe("validação de documentos", () => {
  it("aceita CNPJ válido com e sem máscara", () => {
    expect(isValidCNPJ("11.222.333/0001-81")).toBe(true);
    expect(isValidCNPJ("11222333000181")).toBe(true);
  });

  it("rejeita CNPJ com dígito verificador errado ou repetido", () => {
    expect(isValidCNPJ("11222333000182")).toBe(false);
    expect(isValidCNPJ("11111111111111")).toBe(false);
    expect(isValidCNPJ("123")).toBe(false);
  });

  it("aceita CPF válido e rejeita inválido", () => {
    expect(isValidCPF("529.982.247-25")).toBe(true);
    expect(isValidCPF("52998224726")).toBe(false);
    expect(isValidCPF("00000000000")).toBe(false);
  });

  it("isValidDocument roteia por tamanho", () => {
    expect(isValidDocument("529.982.247-25")).toBe(true);
    expect(isValidDocument("11.222.333/0001-81")).toBe(true);
    expect(isValidDocument("12345")).toBe(false);
  });

  it("formatDocument aplica máscara de CPF e CNPJ", () => {
    expect(formatDocument("52998224725")).toBe("529.982.247-25");
    expect(formatDocument("11222333000181")).toBe("11.222.333/0001-81");
    expect(formatDocument(null)).toBe("");
    expect(formatDocument("abc")).toBe("abc");
  });
});

describe("newIdIntegracao", () => {
  it("gera ids únicos com prefixo do documento", () => {
    const a = newIdIntegracao("nfe");
    const b = newIdIntegracao("nfe");
    expect(a).toMatch(/^nfe-\d{14}-[a-z0-9]{6}$/);
    expect(a).not.toBe(b);
  });
});

const tomador = { cpfCnpj: "11.222.333/0001-81", razaoSocial: "Cliente LTDA" };

describe("mapNfse", () => {
  const base: NfseFormData = {
    prestadorCnpj: "11.222.333/0001-81",
    tomador,
    servico: {
      codigoTributacaoMunicipio: "010101",
      itemListaServico: "01.01",
      discriminacao: "Consultoria",
      valorServico: 1500.5,
    },
  };

  it("normaliza documentos para dígitos e monta valor do serviço", () => {
    const p = mapNfse(base);
    expect(p.prestador.cpfCnpj).toBe("11222333000181");
    expect(p.tomador.cpfCnpj).toBe("11222333000181");
    expect(p.servico.valor.servico).toBe(1500.5);
    expect(p.servico.issRetido).toBe(false);
  });

  it("omite campos opcionais ausentes", () => {
    const p = mapNfse(base) as Record<string, unknown>;
    expect(p.informacoesComplementares).toBeUndefined();
    expect(p.competencia).toBeUndefined();
  });
});

describe("mapNfe / mapNfce", () => {
  const nfe: NfeFormData = {
    emitenteCnpj: "11.222.333/0001-81",
    destinatario: tomador,
    naturezaOperacao: "Venda",
    itens: [
      { codigo: "P1", descricao: "Produto 1", ncm: "12345678", cfop: "5102", unidade: "UN", quantidade: 3, valorUnitario: 10.333 },
      { codigo: "P2", descricao: "Produto 2", ncm: "12345678", cfop: "5102", unidade: "UN", quantidade: 1, valorUnitario: 5 },
    ],
  };

  it("numera itens e arredonda totais a 2 casas", () => {
    const p = mapNfe(nfe);
    expect(p.itens[0].numeroItem).toBe(1);
    expect(p.itens[1].numeroItem).toBe(2);
    expect(p.itens[0].valorTotal).toBe(31.0);
    expect(p.totais.valorTotal).toBe(36.0);
  });

  it("mapNfce herda NFe e adiciona consumidor/pagamento", () => {
    const p = mapNfce({ ...nfe, consumidorFinal: true, formaPagamento: "01", valorPago: 40 });
    expect(p.idIntegracao.startsWith("nfce-")).toBe(true);
    expect(p.consumidorFinal).toBe(true);
    expect(p.pagamento).toEqual({ formaPagamento: "01", valorPago: 40 });
  });
});

describe("mapCte / mapMdfe", () => {
  it("mapCte monta prestação, carga e percurso", () => {
    const p = mapCte({
      emitenteCnpj: "11222333000181",
      naturezaOperacao: "Transporte",
      modal: "01",
      remetente: tomador,
      destinatario: tomador,
      tomador: "remetente",
      valorTotal: 900,
      pesoBruto: 120,
      origemMunicipio: "3550308",
      destinoMunicipio: "3106200",
    });
    expect(p.prestacao.valor).toBe(900);
    expect(p.carga.pesoBruto).toBe(120);
    expect(p.tomador).toBe("remetente");
  });

  it("mapMdfe vincula documentos por chave", () => {
    const p = mapMdfe({
      emitenteCnpj: "11222333000181",
      modal: "1",
      ufOrigem: "SP",
      ufDestino: "MG",
      veiculoPlaca: "ABC1D23",
      documentosVinculados: ["chave1", "chave2"],
      pesoBruto: 500,
    });
    expect(p.documentos).toEqual([{ chave: "chave1" }, { chave: "chave2" }]);
  });
});

describe("extractErrorMessage", () => {
  it("extrai mensagem aninhada em error.message", () => {
    expect(extractErrorMessage({ error: { message: "CNPJ inválido" } })).toBe("CNPJ inválido");
  });
  it("cai para message no topo e para JSON truncado", () => {
    expect(extractErrorMessage({ message: "falhou" })).toBe("falhou");
    expect(extractErrorMessage({ foo: 1 })).toBe('{"foo":1}');
    expect(extractErrorMessage(null)).toBe("Erro desconhecido");
  });
});

// ---------- Reforma Tributária nos mappers ----------

import { deveDestacar, extractReformaMeta, ibsCbsPayloadGroup } from "@/lib/plugnotas";
import { montarGrupoIbsCbs } from "@/lib/reforma";

describe("destaque CBS/IBS nos mappers (formato PlugNotas ibscbs)", () => {
  const nfeReforma: NfeFormData = {
    emitenteCnpj: "11222333000181",
    destinatario: tomador,
    naturezaOperacao: "Venda",
    itens: [
      { codigo: "P1", descricao: "Produto 1", ncm: "12345678", cfop: "5102", unidade: "UN", quantidade: 1, valorUnitario: 1000 },
    ],
  };

  it("mapNfe com reforma anexa itens[].tributos.ibscbs com cst/classificacao e IBS uf+municipio", () => {
    const p = mapNfe(nfeReforma, { cClassTrib: "000001" });
    const g = p.itens[0].tributos?.ibscbs;
    expect(g?.cst).toBe("000");
    expect(g?.classificacao).toBe("000001");
    expect(g?.baseCalculo).toBe(1000);
    expect(g?.uf).toEqual({ aliquota: 0.1, valor: 1.0 });
    expect(g?.municipio).toEqual({ aliquota: 0, valor: 0 });
    expect(g?.cbs).toEqual({ aliquota: 0.9, valor: 9.0 });
  });

  it("mapNfe sem reforma NÃO anexa grupo (retrocompatível)", () => {
    const p = mapNfe(nfeReforma);
    expect(p.itens[0].tributos).toBeUndefined();
  });

  it("mapNfse e mapCte NÃO anexam grupo (NFS-e Nacional é a via; PlugNotas não emite CT-e)", () => {
    const nfse = mapNfse({
      prestadorCnpj: "11222333000181",
      tomador,
      servico: { codigoTributacaoMunicipio: "01", itemListaServico: "01.01", discriminacao: "x", valorServico: 2000 },
    }, {}) as Record<string, unknown>;
    expect(nfse.ibscbs).toBeUndefined();
    expect(nfse.ibsCbs).toBeUndefined();

    const cte = mapCte({
      emitenteCnpj: "11222333000181", naturezaOperacao: "T", modal: "01",
      remetente: tomador, destinatario: tomador, tomador: "remetente",
      valorTotal: 500, pesoBruto: 1, origemMunicipio: "1", destinoMunicipio: "2",
    }, {}) as Record<string, unknown>;
    expect(cte.ibscbs).toBeUndefined();
  });

  it("deveDestacar respeita regime e documento", () => {
    expect(deveDestacar("regular", "nfe", 2026)).toBe(true);
    expect(deveDestacar("simples", "nfe", 2026)).toBe(false);
    expect(deveDestacar("regular", "mdfe", 2026)).toBe(false);
    expect(deveDestacar(null, "nfe", 2026)).toBe(false);
  });

  it("extractReformaMeta soma grupos dos itens → colunas do banco", () => {
    const doisItens: NfeFormData = {
      ...nfeReforma,
      itens: [
        { codigo: "P1", descricao: "A", ncm: "1", cfop: "5102", unidade: "UN", quantidade: 1, valorUnitario: 1000 },
        { codigo: "P2", descricao: "B", ncm: "1", cfop: "5102", unidade: "UN", quantidade: 1, valorUnitario: 500 },
      ],
    };
    const meta = extractReformaMeta(mapNfe(doisItens, {}));
    expect(meta).toEqual({
      cbs_valor: 13.5, ibs_valor: 1.5, cbs_aliquota: 0.9, ibs_aliquota: 0.1, cclasstrib: "000001",
    });
    expect(extractReformaMeta(mapNfe(nfeReforma))).toBeUndefined();
  });

  it("ibsCbsPayloadGroup emite o shape do schema ibscbsNfe", () => {
    const g = ibsCbsPayloadGroup(montarGrupoIbsCbs(100));
    expect(g).toEqual({
      cst: "000",
      classificacao: "000001",
      baseCalculo: 100,
      uf: { aliquota: 0.1, valor: 0.1 },
      municipio: { aliquota: 0, valor: 0 },
      cbs: { aliquota: 0.9, valor: 0.9 },
    });
  });
});

describe("cClassTrib por produto (override do padrão da empresa)", () => {
  it("item com cClassTrib próprio ganha do padrão; sem, herda o da empresa", () => {
    const p = mapNfe({
      emitenteCnpj: "11222333000181",
      destinatario: tomador,
      naturezaOperacao: "Venda",
      itens: [
        { codigo: "A", descricao: "c/ override", ncm: "1", cfop: "5102", unidade: "UN", quantidade: 1, valorUnitario: 100, cClassTrib: "200003" },
        { codigo: "B", descricao: "sem override", ncm: "1", cfop: "5102", unidade: "UN", quantidade: 1, valorUnitario: 100 },
      ],
    }, { cClassTrib: "000001" });
    expect(p.itens[0].tributos?.ibscbs.classificacao).toBe("200003");
    expect(p.itens[1].tributos?.ibscbs.classificacao).toBe("000001");
  });
});
