/**
 * Parser de respostas XML do ADN NFS-e Nacional
 *
 * Parseia XMLs de NFS-e autorizada, eventos, e lotes.
 */

import { XMLParser } from "fast-xml-parser";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true,
  parseTagValue: true,
  parseAttributeValue: true,
  trimValues: true,
});

export interface NfseAutorizada {
  chaveAcesso: string;
  numero: string;
  serie: string;
  dataEmissao: string;
  competencia: string;
  prestador: {
    cnpj: string;
    inscricaoMunicipal?: string;
    razaoSocial?: string;
  };
  tomador?: {
    cpfCnpj: string;
    razaoSocial?: string;
  };
  servico: {
    codigoTribNac: string;
    descricao: string;
  };
  valores: {
    valorServicos: number;
    baseCalculo: number;
    aliquotaIss?: number;
    valorIss?: number;
    valorLiquido: number;
    issRetido: boolean;
  };
  status: "autorizada" | "cancelada" | "substituida";
  xmlOriginal: string;
}

export interface LoteResultado {
  protocolo: string;
  situacao: "em_processamento" | "processado" | "erro";
  notas: Array<{
    chaveAcesso?: string;
    numero?: string;
    situacao: "autorizada" | "rejeitada";
    motivo?: string;
    codigo?: string;
  }>;
}

export interface EventoResultado {
  tipo: string;
  chaveAcesso: string;
  sequencia: number;
  dataEvento: string;
  situacao: "registrado" | "rejeitado";
  motivo?: string;
}

/**
 * Parseia resposta de emissão individual (NFS-e autorizada)
 */
export function parseNfseResponse(xml: string): NfseAutorizada {
  const parsed = parser.parse(xml);

  // Navigate to the NFS-e root (may be nested in retEnvDPS or retConsNFSe)
  const nfse = findNode(parsed, "NFSe") || findNode(parsed, "compNfse")?.NFSe || parsed;
  const infNfse = nfse.infNFSe || nfse;

  const chave = infNfse["@_chNFSe"] || infNfse.chNFSe || extractChave(parsed);
  const emit = infNfse.emit || infNfse.prest || {};
  const dest = infNfse.dest || infNfse.toma || {};
  const det = infNfse.det || infNfse.serv || {};
  const valores = infNfse.valores || infNfse.total || {};

  return {
    chaveAcesso: String(chave),
    numero: String(infNfse.nNFSe || infNfse.nDPS || ""),
    serie: String(infNfse.serie || ""),
    dataEmissao: String(infNfse.dhEmi || infNfse.dhProc || ""),
    competencia: String(infNfse.dCompet || ""),
    prestador: {
      cnpj: String(emit.CNPJ || ""),
      inscricaoMunicipal: emit.IM ? String(emit.IM) : undefined,
      razaoSocial: emit.xNome ? String(emit.xNome) : undefined,
    },
    tomador: dest.CNPJ || dest.CPF
      ? {
          cpfCnpj: String(dest.CNPJ || dest.CPF || ""),
          razaoSocial: dest.xNome ? String(dest.xNome) : undefined,
        }
      : undefined,
    servico: {
      codigoTribNac: String(det.cTribNac || det.cServ?.cTribNac || ""),
      descricao: String(det.xDescServ || det.cServ?.xDescServ || ""),
    },
    valores: {
      valorServicos: Number(valores.vServ || valores.vServPrest?.vServ || 0),
      baseCalculo: Number(valores.vCalcDR || 0),
      aliquotaIss: valores.trib?.tribMun?.pAliq ? Number(valores.trib.tribMun.pAliq) : undefined,
      valorIss: valores.trib?.tribMun?.vTribMun ? Number(valores.trib.tribMun.vTribMun) : undefined,
      valorLiquido: Number(valores.vLiq || valores.vServ || 0),
      issRetido: valores.trib?.ISSSt === "1" || valores.trib?.ISSSt === 1,
    },
    status: "autorizada",
    xmlOriginal: xml,
  };
}

/**
 * Parseia resultado de consulta de lote
 */
export function parseLoteResponse(xml: string): LoteResultado {
  const parsed = parser.parse(xml);
  const ret = findNode(parsed, "retConsLote") || parsed;

  const situacaoMap: Record<string, LoteResultado["situacao"]> = {
    "1": "em_processamento",
    "2": "processado",
    "3": "erro",
  };

  const notas: LoteResultado["notas"] = [];
  const items = ret.retNFSe || ret.compNfse;
  if (items) {
    const arr = Array.isArray(items) ? items : [items];
    for (const item of arr) {
      notas.push({
        chaveAcesso: item.chNFSe ? String(item.chNFSe) : undefined,
        numero: item.nNFSe ? String(item.nNFSe) : undefined,
        situacao: item.cStat === "100" ? "autorizada" : "rejeitada",
        motivo: item.xMotivo ? String(item.xMotivo) : undefined,
        codigo: item.cStat ? String(item.cStat) : undefined,
      });
    }
  }

  return {
    protocolo: String(ret.nRec || ret.protocolo || ""),
    situacao: situacaoMap[String(ret.cSit)] || "em_processamento",
    notas,
  };
}

/**
 * Parseia resultado de evento (cancelamento/substituição)
 */
export function parseEventoResponse(xml: string): EventoResultado {
  const parsed = parser.parse(xml);
  const ret = findNode(parsed, "retEvento") || findNode(parsed, "retPedRegEvento") || parsed;
  const infRet = ret.infEvento || ret.infPedReg || ret;

  return {
    tipo: String(infRet.tpEvento || ""),
    chaveAcesso: String(infRet.chNFSe || ""),
    sequencia: Number(infRet.nSeqEvento || 1),
    dataEvento: String(infRet.dhRegEvento || infRet.dhEvento || ""),
    situacao: String(infRet.cStat) === "135" || String(infRet.cStat) === "155"
      ? "registrado"
      : "rejeitado",
    motivo: infRet.xMotivo ? String(infRet.xMotivo) : undefined,
  };
}

/**
 * Parseia resposta da API de DFe (distribuição por NSU)
 */
export function parseDfeResponse(xml: string): {
  ultimoNsu: string;
  maxNsu: string;
  documentos: Array<{ nsu: string; tipo: string; xml: string }>;
} {
  const parsed = parser.parse(xml);
  const ret = findNode(parsed, "retDistDFeInt") || parsed;

  const docs: Array<{ nsu: string; tipo: string; xml: string }> = [];
  const lote = ret.loteDistDFeInt?.docZip || ret.docZip;
  if (lote) {
    const arr = Array.isArray(lote) ? lote : [lote];
    for (const doc of arr) {
      docs.push({
        nsu: String(doc["@_NSU"] || ""),
        tipo: String(doc["@_schema"] || "nfse"),
        xml: String(doc["#text"] || doc),
      });
    }
  }

  return {
    ultimoNsu: String(ret.ultNSU || "0"),
    maxNsu: String(ret.maxNSU || "0"),
    documentos: docs,
  };
}

// ── Helpers ──

function findNode(obj: Record<string, unknown>, key: string): Record<string, unknown> | null {
  if (key in obj) return obj[key] as Record<string, unknown>;
  for (const k in obj) {
    if (typeof obj[k] === "object" && obj[k] !== null) {
      const found = findNode(obj[k] as Record<string, unknown>, key);
      if (found) return found;
    }
  }
  return null;
}

function extractChave(parsed: Record<string, unknown>): string {
  // Try to find chNFSe anywhere in the response tree
  const node = findNode(parsed, "chNFSe");
  if (node) return String(node);

  // Try protNFSe
  const prot = findNode(parsed, "protNFSe");
  if (prot && prot.chNFSe) return String(prot.chNFSe);

  return "";
}
