/**
 * Construtor e assinador de XML da DPS (Declaração de Prestação de Serviço)
 *
 * A DPS é o documento que o prestador envia ao ADN para gerar a NFS-e.
 * Deve ser assinado digitalmente com o certificado ICP-Brasil do prestador.
 *
 * Layout baseado no Manual de Integração NFS-e Nacional v1.00
 */

import * as forge from "node-forge";
import { XMLBuilder } from "fast-xml-parser";
import { DPS_VERSAO, XML_NAMESPACES } from "../config.js";
import type { TlsCredentials } from "../auth/cert-manager.js";

export interface DpsServico {
  codigoTribNac: string;
  descricao: string;
  quantidade?: number;
  valorUnitario?: number;
  codigoCnae?: string;
  codigoNbs?: string;
}

export interface DpsTomador {
  cpfCnpj: string;
  razaoSocial?: string;
  nomeFantasia?: string;
  email?: string;
  telefone?: string;
  endereco?: {
    logradouro?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    codigoMunicipio?: string;
    uf?: string;
    cep?: string;
    codigoPais?: string;
  };
}

export interface DpsValores {
  valorServicos: number;
  deducoes?: number;
  descontoIncondicionado?: number;
  descontoCondicionado?: number;
  aliquotaIss?: number;
  issRetido?: boolean;
  valorIss?: number;
  valorLiquido?: number;
  outrasRetencoes?: number;
  valorIr?: number;
  valorPis?: number;
  valorCofins?: number;
  valorCsll?: number;
  valorInss?: number;
}

export interface DpsInput {
  cnpjPrestador: string;
  inscricaoMunicipal?: string;
  codigoMunicipio: string;
  competencia: string; // YYYY-MM
  serieDps: string;
  numeroDps: string;
  servico: DpsServico;
  tomador?: DpsTomador;
  valores: DpsValores;
  observacoes?: string;
  regimeEspecial?: string;
  naturezaTributacao?: string;
  optanteSimplesNacional?: boolean;
}

/**
 * Constrói o XML da DPS (sem assinatura)
 */
export function buildDpsXml(input: DpsInput): string {
  const baseCalculo = input.valores.valorServicos
    - (input.valores.deducoes || 0)
    - (input.valores.descontoIncondicionado || 0);

  const valorIss = input.valores.valorIss
    ?? (input.valores.aliquotaIss ? baseCalculo * (input.valores.aliquotaIss / 100) : 0);

  const dps: Record<string, unknown> = {
    "?xml": { "@_version": "1.0", "@_encoding": "UTF-8" },
    DPS: {
      "@_xmlns": XML_NAMESPACES.nfse,
      "@_versao": DPS_VERSAO,
      infDPS: {
        "@_Id": buildIdDps(input),
        tpAmb: process.env.NFSE_AMBIENTE === "producao" ? "1" : "2",
        dhEmi: new Date().toISOString(),
        verAplic: "ERP-NFSE-MCP-1.0",
        serie: input.serieDps,
        nDPS: input.numeroDps,
        dCompet: `${input.competencia}-01`,
        // Prestador
        prest: {
          CNPJ: input.cnpjPrestador,
          ...(input.inscricaoMunicipal ? { IM: input.inscricaoMunicipal } : {}),
        },
        // Tomador
        ...(input.tomador ? { toma: buildTomadorXml(input.tomador) } : {}),
        // Serviço
        serv: {
          cServ: {
            cTribNac: input.servico.codigoTribNac,
            ...(input.servico.codigoCnae ? { CNAE: input.servico.codigoCnae } : {}),
            ...(input.servico.codigoNbs ? { cNBS: input.servico.codigoNbs } : {}),
            xDescServ: input.servico.descricao,
          },
        },
        // Valores
        valores: {
          vServPrest: {
            vServ: formatDecimal(input.valores.valorServicos),
            ...(input.valores.deducoes ? { vDeducao: formatDecimal(input.valores.deducoes) } : {}),
            ...(input.valores.descontoIncondicionado ? { vDescIncworthy: formatDecimal(input.valores.descontoIncondicionado) } : {}),
            ...(input.valores.descontoCondicionado ? { vDescCond: formatDecimal(input.valores.descontoCondicionado) } : {}),
          },
          vCalcDR: formatDecimal(baseCalculo),
          trib: {
            ...(input.valores.aliquotaIss != null ? { tribMun: { pAliq: formatDecimal(input.valores.aliquotaIss, 4), vTribMun: formatDecimal(valorIss) } } : {}),
            ...(input.valores.issRetido ? { ISSSt: "1" } : {}),
          },
          ...(input.valores.outrasRetencoes ? { vRetServPrest: { vRetIR: formatDecimal(input.valores.valorIr || 0), vRetPIS: formatDecimal(input.valores.valorPis || 0), vRetCOFINS: formatDecimal(input.valores.valorCofins || 0), vRetCSLL: formatDecimal(input.valores.valorCsll || 0), vRetINSS: formatDecimal(input.valores.valorInss || 0) } } : {}),
        },
        // Info complementar
        ...(input.observacoes ? { infCompl: { xInfComp: input.observacoes } } : {}),
      },
    },
  };

  const builder = new XMLBuilder({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    processEntities: false,
    suppressEmptyNode: true,
    format: false,
  });

  return builder.build(dps) as string;
}

/**
 * Assina o XML da DPS usando o certificado do prestador (enveloped signature)
 */
export function signDpsXml(xml: string, credentials: TlsCredentials): string {
  const privateKey = forge.pki.privateKeyFromPem(credentials.key);
  const certificate = forge.pki.certificateFromPem(credentials.cert);

  // Canonicalize the infDPS element
  const infDpsMatch = xml.match(/<infDPS[^>]*>[\s\S]*?<\/infDPS>/);
  if (!infDpsMatch) throw new Error("Elemento <infDPS> não encontrado no XML");
  const infDpsContent = infDpsMatch[0];

  // SHA-256 digest of infDPS
  const md = forge.md.sha256.create();
  md.update(infDpsContent, "utf8");
  const digestBase64 = forge.util.encode64(md.digest().bytes());

  // Build SignedInfo (C14N)
  const signedInfo = [
    `<SignedInfo xmlns="${XML_NAMESPACES.ds}">`,
    `<CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>`,
    `<SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/>`,
    `<Reference URI="#${extractIdFromXml(xml)}">`,
    `<Transforms>`,
    `<Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>`,
    `<Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>`,
    `</Transforms>`,
    `<DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>`,
    `<DigestValue>${digestBase64}</DigestValue>`,
    `</Reference>`,
    `</SignedInfo>`,
  ].join("");

  // Sign the SignedInfo
  const signMd = forge.md.sha256.create();
  signMd.update(signedInfo, "utf8");
  const signature = privateKey.sign(signMd);
  const signatureBase64 = forge.util.encode64(signature);

  // Certificate in Base64 (DER)
  const certDer = forge.asn1.toDer(forge.pki.certificateToAsn1(certificate)).bytes();
  const certBase64 = forge.util.encode64(certDer);

  // Build Signature element
  const signatureXml = [
    `<Signature xmlns="${XML_NAMESPACES.ds}">`,
    signedInfo,
    `<SignatureValue>${signatureBase64}</SignatureValue>`,
    `<KeyInfo>`,
    `<X509Data>`,
    `<X509Certificate>${certBase64}</X509Certificate>`,
    `</X509Data>`,
    `</KeyInfo>`,
    `</Signature>`,
  ].join("");

  // Insert signature before closing </infDPS>
  return xml.replace("</infDPS>", `${signatureXml}</infDPS>`);
}

// ── Helpers ──

function buildIdDps(input: DpsInput): string {
  return `DPS${input.cnpjPrestador}${input.serieDps.padStart(5, "0")}${input.numeroDps.padStart(15, "0")}`;
}

function extractIdFromXml(xml: string): string {
  const match = xml.match(/Id="([^"]+)"/);
  return match?.[1] || "";
}

function buildTomadorXml(tomador: DpsTomador): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  if (tomador.cpfCnpj.length === 14) {
    result.CNPJ = tomador.cpfCnpj;
  } else if (tomador.cpfCnpj.length === 11) {
    result.CPF = tomador.cpfCnpj;
  }

  if (tomador.razaoSocial) result.xNome = tomador.razaoSocial;
  if (tomador.email) result.email = tomador.email;
  if (tomador.telefone) result.fone = tomador.telefone;

  if (tomador.endereco) {
    const end = tomador.endereco;
    result.ender = {
      ...(end.logradouro ? { xLgr: end.logradouro } : {}),
      ...(end.numero ? { nro: end.numero } : {}),
      ...(end.complemento ? { xCpl: end.complemento } : {}),
      ...(end.bairro ? { xBairro: end.bairro } : {}),
      ...(end.codigoMunicipio ? { cMun: end.codigoMunicipio } : {}),
      ...(end.uf ? { UF: end.uf } : {}),
      ...(end.cep ? { CEP: end.cep } : {}),
      ...(end.codigoPais ? { cPais: end.codigoPais } : { cPais: "1058" }),
    };
  }

  return result;
}

function formatDecimal(value: number, decimals: number = 2): string {
  return value.toFixed(decimals);
}

/**
 * Constrói o XML do evento de cancelamento
 */
export function buildCancelamentoXml(chaveAcesso: string, motivo: string, descricao?: string): string {
  const evento = {
    "?xml": { "@_version": "1.0", "@_encoding": "UTF-8" },
    pedRegEvento: {
      "@_xmlns": XML_NAMESPACES.nfse,
      "@_versao": DPS_VERSAO,
      infPedReg: {
        "@_Id": `EVT${chaveAcesso}`,
        tpEvento: "e101101", // cancelamento
        nSeqEvento: "1",
        chNFSe: chaveAcesso,
        dhEvento: new Date().toISOString(),
        detEvento: {
          cMotCanc: motivo,
          ...(descricao ? { xMotCanc: descricao } : {}),
        },
      },
    },
  };

  const builder = new XMLBuilder({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    processEntities: false,
    suppressEmptyNode: true,
    format: false,
  });

  return builder.build(evento) as string;
}
