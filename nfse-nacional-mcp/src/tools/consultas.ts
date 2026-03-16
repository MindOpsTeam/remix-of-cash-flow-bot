/**
 * Tools de consulta: nfse_consultar_chave, nfse_consultar_dfe, nfse_consultar_lote
 */

import type { AdnHttpClient } from "../auth/http-client.js";
import { parseNfseResponse, parseDfeResponse, parseLoteResponse } from "../xml/nfse-parser.js";
import { NfseValidationError } from "../errors/nfse-errors.js";
import { CHAVE_ACESSO_LENGTH } from "../config.js";

export async function nfseConsultarChave(
  client: AdnHttpClient,
  params: {
    chaveAcesso: string;
    formato?: "xml" | "json";
  },
): Promise<{
  chaveAcesso: string;
  numero: string;
  serie: string;
  dataEmissao: string;
  prestador: { cnpj: string; razaoSocial?: string };
  tomador?: { cpfCnpj: string; razaoSocial?: string };
  servico: { codigoTribNac: string; descricao: string };
  valores: {
    valorServicos: number;
    baseCalculo: number;
    aliquotaIss?: number;
    valorIss?: number;
    valorLiquido: number;
    issRetido: boolean;
  };
  status: string;
}> {
  if (!params.chaveAcesso || params.chaveAcesso.length !== CHAVE_ACESSO_LENGTH) {
    throw new NfseValidationError([{
      field: "chaveAcesso",
      message: `Chave de acesso deve ter ${CHAVE_ACESSO_LENGTH} caracteres`,
    }]);
  }

  const response = await client.postXml(
    "/sefin/v1/NFSe/chave",
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<consNFSe xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.00">` +
    `<chNFSe>${params.chaveAcesso}</chNFSe>` +
    `</consNFSe>`,
  );

  const nfse = parseNfseResponse(response.body);

  return {
    chaveAcesso: nfse.chaveAcesso,
    numero: nfse.numero,
    serie: nfse.serie,
    dataEmissao: nfse.dataEmissao,
    prestador: nfse.prestador,
    tomador: nfse.tomador,
    servico: nfse.servico,
    valores: nfse.valores,
    status: nfse.status,
  };
}

export async function nfseConsultarDfe(
  client: AdnHttpClient,
  params: {
    cnpj: string;
    ultimoNsu: string;
    tipo?: "emitidas" | "recebidas" | "todas";
  },
): Promise<{
  ultimoNsu: string;
  maxNsu: string;
  totalDocumentos: number;
  documentos: Array<{
    nsu: string;
    tipo: string;
    resumo: string;
  }>;
}> {
  if (!params.cnpj || params.cnpj.length !== 14) {
    throw new NfseValidationError([{
      field: "cnpj", message: "CNPJ deve ter 14 dígitos",
    }]);
  }

  const tipoFiltro = params.tipo || "todas";
  const tpDist = tipoFiltro === "emitidas" ? "1" : tipoFiltro === "recebidas" ? "2" : "0";

  const response = await client.postXml(
    "/DFe",
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<distDFeInt xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.00">` +
    `<tpDist>${tpDist}</tpDist>` +
    `<CNPJ>${params.cnpj}</CNPJ>` +
    `<ultNSU>${params.ultimoNsu}</ultNSU>` +
    `</distDFeInt>`,
  );

  const parsed = parseDfeResponse(response.body);

  return {
    ultimoNsu: parsed.ultimoNsu,
    maxNsu: parsed.maxNsu,
    totalDocumentos: parsed.documentos.length,
    documentos: parsed.documentos.map((d) => ({
      nsu: d.nsu,
      tipo: d.tipo,
      resumo: `NSU ${d.nsu} — ${d.tipo} (${d.xml.length} bytes)`,
    })),
  };
}

export async function nfseConsultarLote(
  client: AdnHttpClient,
  params: {
    protocolo: string;
    cnpjPrestador: string;
  },
): Promise<{
  protocolo: string;
  situacao: string;
  totalNotas: number;
  notas: Array<{
    chaveAcesso?: string;
    numero?: string;
    situacao: string;
    motivo?: string;
  }>;
}> {
  if (!params.protocolo) {
    throw new NfseValidationError([{ field: "protocolo", message: "Protocolo é obrigatório" }]);
  }

  const response = await client.postXml(
    "/sefin/v1/DPS/lote/consulta",
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<consLote xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.00">` +
    `<nRec>${params.protocolo}</nRec>` +
    `<CNPJ>${params.cnpjPrestador}</CNPJ>` +
    `</consLote>`,
  );

  const lote = parseLoteResponse(response.body);

  return {
    protocolo: lote.protocolo,
    situacao: lote.situacao,
    totalNotas: lote.notas.length,
    notas: lote.notas,
  };
}
