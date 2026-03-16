import { describe, it, expect } from "vitest";
import { buildDpsXml, buildIdDps, type DpsInput } from "../src/xml/dps-builder.js";

const baseDps: DpsInput = {
  cnpjPrestador: "11222333000181",
  codigoMunicipio: "3550308",
  competencia: "2026-03",
  serieDps: "1",
  numeroDps: "42",
  servico: {
    codigoTribNac: "01.01.02",
    descricao: "Desenvolvimento de software sob encomenda",
  },
  valores: {
    valorServicos: 5000.0,
    aliquotaIss: 2.0,
  },
};

describe("buildDpsXml", () => {
  it("should produce XML with mandatory elements", () => {
    const xml = buildDpsXml(baseDps);

    // Must have XML declaration
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');

    // Must have DPS root with correct namespace
    expect(xml).toContain('xmlns="http://www.sped.fazenda.gov.br/nfse"');
    expect(xml).toContain('versao="1.00"');

    // Must have infDPS with Id attribute
    expect(xml).toMatch(/<infDPS[^>]*Id="[^"]+"/);

    // Prestador CNPJ
    expect(xml).toContain(`<CNPJ>${baseDps.cnpjPrestador}</CNPJ>`);

    // Serie and number
    expect(xml).toContain(`<serie>${baseDps.serieDps}</serie>`);
    expect(xml).toContain(`<nDPS>${baseDps.numeroDps}</nDPS>`);

    // Service code
    expect(xml).toContain(`<cTribNac>${baseDps.servico.codigoTribNac}</cTribNac>`);

    // Service description
    expect(xml).toContain(`<xDescServ>${baseDps.servico.descricao}</xDescServ>`);

    // Values
    expect(xml).toContain("<vServ>5000.00</vServ>");

    // Competência as date
    expect(xml).toContain("<dCompet>2026-03-01</dCompet>");

    // Ambiente (default homologacao = 2)
    expect(xml).toContain("<tpAmb>2</tpAmb>");
  });

  it("should include tomador when provided", () => {
    const dps: DpsInput = {
      ...baseDps,
      tomador: {
        cpfCnpj: "12345678901",
        razaoSocial: "Cliente Teste",
        email: "cli@test.com",
      },
    };
    const xml = buildDpsXml(dps);

    expect(xml).toContain("<CPF>12345678901</CPF>");
    expect(xml).toContain("<xNome>Cliente Teste</xNome>");
    expect(xml).toContain("<email>cli@test.com</email>");
  });

  it("should calculate base de calculo correctly", () => {
    const dps: DpsInput = {
      ...baseDps,
      valores: {
        valorServicos: 10000,
        deducoes: 2000,
        descontoIncondicionado: 500,
        aliquotaIss: 3,
      },
    };
    const xml = buildDpsXml(dps);

    // Base = 10000 - 2000 - 500 = 7500
    expect(xml).toContain("<vCalcDR>7500.00</vCalcDR>");
  });
});

describe("buildIdDps", () => {
  it("should format idDps with padded serie and number", () => {
    const id = buildIdDps(baseDps);

    // DPS + CNPJ(14) + serie padded to 5 + number padded to 15 = 37 chars
    expect(id).toBe("DPS1122233300018100001000000000000042");
    expect(id.startsWith("DPS")).toBe(true);
    expect(id).toContain(baseDps.cnpjPrestador);
  });
});
