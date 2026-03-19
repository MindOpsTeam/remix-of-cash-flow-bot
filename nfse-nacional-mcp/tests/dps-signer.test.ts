import { describe, it, expect } from "vitest";
import { buildDpsXml, signDpsXml, type DpsInput } from "../src/xml/dps-builder.js";
import type { TlsCredentials } from "../src/auth/cert-manager.js";
import forge from "node-forge";

// Generate a self-signed test certificate
function generateTestCredentials(): TlsCredentials {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();

  cert.publicKey = keys.publicKey;
  cert.serialNumber = "01";
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notAfter.getFullYear() + 1);

  const attrs = [
    { name: "commonName", value: "Test Empresa:11222333000181" },
    { name: "organizationName", value: "Test Org" },
  ];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.sign(keys.privateKey, forge.md.sha256.create());

  return {
    cert: forge.pki.certificateToPem(cert),
    key: forge.pki.privateKeyToPem(keys.privateKey),
  };
}

const baseDps: DpsInput = {
  cnpjPrestador: "11222333000181",
  codigoMunicipio: "3550308",
  competencia: "2026-03",
  serieDps: "1",
  numeroDps: "1",
  servico: {
    codigoTribNac: "01.01.02",
    descricao: "Desenvolvimento de software",
  },
  valores: {
    valorServicos: 1000,
    aliquotaIss: 2,
  },
};

describe("signDpsXml", () => {
  const credentials = generateTestCredentials();

  it("should produce XML with Signature element", () => {
    const xml = buildDpsXml(baseDps);
    const signed = signDpsXml(xml, credentials);

    expect(signed).toContain("<Signature");
    expect(signed).toContain("</Signature>");
  });

  it("should use RSA-SHA256 signature method", () => {
    const xml = buildDpsXml(baseDps);
    const signed = signDpsXml(xml, credentials);

    expect(signed).toContain("rsa-sha256");
  });

  it("should use SHA-256 digest method", () => {
    const xml = buildDpsXml(baseDps);
    const signed = signDpsXml(xml, credentials);

    expect(signed).toContain("xmlenc#sha256");
  });

  it("should include X509Certificate", () => {
    const xml = buildDpsXml(baseDps);
    const signed = signDpsXml(xml, credentials);

    expect(signed).toContain("<X509Certificate>");
    expect(signed).toContain("</X509Certificate>");
  });

  it("should include enveloped-signature transform", () => {
    const xml = buildDpsXml(baseDps);
    const signed = signDpsXml(xml, credentials);

    expect(signed).toContain("enveloped-signature");
  });

  it("should insert Signature before closing infDPS", () => {
    const xml = buildDpsXml(baseDps);
    const signed = signDpsXml(xml, credentials);

    // Signature should be inside infDPS, before closing tag
    const sigIdx = signed.indexOf("<Signature");
    const closeIdx = signed.indexOf("</infDPS>");
    expect(sigIdx).toBeGreaterThan(0);
    expect(closeIdx).toBeGreaterThan(sigIdx);
  });

  it("should have DigestValue and SignatureValue", () => {
    const xml = buildDpsXml(baseDps);
    const signed = signDpsXml(xml, credentials);

    expect(signed).toMatch(/<DigestValue>[A-Za-z0-9+/=]+<\/DigestValue>/);
    expect(signed).toMatch(/<SignatureValue>[A-Za-z0-9+/=]+<\/SignatureValue>/);
  });
});
