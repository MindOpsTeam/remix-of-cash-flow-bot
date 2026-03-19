/**
 * Construtor e assinador de XML da DPS (Declaração de Prestação de Serviço)
 *
 * A DPS é o documento que o prestador envia ao ADN para gerar a NFS-e.
 * Deve ser assinado digitalmente com o certificado ICP-Brasil do prestador.
 *
 * Layout baseado no Manual de Integração NFS-e Nacional v1.00
 */

import { SignedXml } from "xml-crypto";
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
        dhEmi: formatDateTimeBRT(new Date()),
        verAplic: "ERP-NFSE-MCP-1.0",
        serie: input.serieDps,
        nDPS: input.numeroDps,
        dCompet: `${input.competencia}-01`,
        tpEmit: "1", // 1 = Prestador
        cLocEmi: input.codigoMunicipio,
        // Prestador (XSD: CNPJ/CPF, CAEPF?, IM?, xNome?, end?, fone?, email?, regTrib)
        prest: {
          CNPJ: input.cnpjPrestador,
          ...(input.inscricaoMunicipal ? { IM: input.inscricaoMunicipal } : {}),
          regTrib: {
            opSimpNac: input.optanteSimplesNacional ? "3" : "1", // 1=Não Optante, 3=ME/EPP
            regEspTrib: input.regimeEspecial || "0", // 0=Nenhum
          },
        },
        // Tomador
        ...(input.tomador ? { toma: buildTomadorXml(input.tomador) } : {}),
        // Serviço (XSD: locPrest, cServ)
        serv: {
          locPrest: {
            cLocPrestacao: input.codigoMunicipio,
          },
          cServ: {
            cTribNac: input.servico.codigoTribNac.replace(/\./g, ""),
            xDescServ: input.servico.descricao,
            ...(input.servico.codigoNbs ? { cNBS: input.servico.codigoNbs } : {}),
          },
        },
        // Valores (XSD: vServPrest, vDescCondIncond?, vDedRed?, trib)
        valores: {
          vServPrest: {
            vServ: formatDecimal(input.valores.valorServicos),
          },
          ...(input.valores.descontoIncondicionado || input.valores.descontoCondicionado ? {
            vDescCondIncond: {
              ...(input.valores.descontoIncondicionado ? { vDescIncond: formatDecimal(input.valores.descontoIncondicionado) } : {}),
              ...(input.valores.descontoCondicionado ? { vDescCond: formatDecimal(input.valores.descontoCondicionado) } : {}),
            },
          } : {}),
          trib: {
            tribMun: {
              tribISSQN: input.naturezaTributacao || "1", // 1=Operação tributável
              tpRetISSQN: input.valores.issRetido ? "2" : "1", // 1=Não Retido, 2=Retido Tomador
            },
            totTrib: {
              indTotTrib: "0", // Não informar valores estimados (Decreto 8.264/2014)
            },
          },
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
  const idDps = extractIdFromXml(xml);

  // Extract the first certificate PEM (skip chain certs)
  const certPemMatch = credentials.cert.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/);
  if (!certPemMatch) throw new Error("Certificado PEM não encontrado nas credenciais");
  const certPem = certPemMatch[0];

  const certDerB64 = certPem
    .replace(/-----BEGIN CERTIFICATE-----/, "")
    .replace(/-----END CERTIFICATE-----/, "")
    .replace(/\s/g, "");

  const sig = new SignedXml({
    privateKey: credentials.key,
    publicCert: certPem,
    canonicalizationAlgorithm: "http://www.w3.org/TR/2001/REC-xml-c14n-20010315",
    signatureAlgorithm: "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256",
    getKeyInfoContent: () => `<X509Data><X509Certificate>${certDerB64}</X509Certificate></X509Data>`,
  });

  sig.addReference({
    xpath: `//*[@Id='${idDps}']`,
    digestAlgorithm: "http://www.w3.org/2001/04/xmlenc#sha256",
    transforms: [
      "http://www.w3.org/2000/09/xmldsig#enveloped-signature",
      "http://www.w3.org/TR/2001/REC-xml-c14n-20010315",
    ],
  });

  sig.computeSignature(xml, {
    location: { reference: "//*[local-name()='infDPS']", action: "after" },
  });

  return sig.getSignedXml();
}

// ── Helpers ──

/**
 * Monta o Id da DPS no formato TSIdDPS (45 caracteres):
 * "DPS" (3) + cMun (7) + tpInscFed (1: "1"=CPF, "2"=CNPJ) + CNPJ/CPF (14) + série (5) + nDPS (15)
 */
export function buildIdDps(input: DpsInput): string {
  const tpInscFed = input.cnpjPrestador.length === 14 ? "2" : "1";
  return `DPS${input.codigoMunicipio}${tpInscFed}${input.cnpjPrestador}${input.serieDps.padStart(5, "0")}${input.numeroDps.padStart(15, "0")}`;
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

/** Format date as TSDateTimeUTC: YYYY-MM-DDThh:mm:ss-03:00 (Brasília time) */
function formatDateTimeBRT(date: Date): string {
  const offset = -3; // BRT
  const local = new Date(date.getTime() + offset * 60 * 60 * 1000);
  const iso = local.toISOString().replace(/\.\d{3}Z$/, "");
  return `${iso}-03:00`;
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
