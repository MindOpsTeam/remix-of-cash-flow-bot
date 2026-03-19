/**
 * Tools de consulta: nfse_consultar_chave, nfse_consultar_dfe, nfse_consultar_lote
 */

import type { AdnHttpClient } from "../auth/http-client.js";
import { NfseValidationError, NfseError } from "../errors/nfse-errors.js";
import { CHAVE_ACESSO_LENGTH } from "../config.js";

export async function nfseConsultarChave(
  client: AdnHttpClient,
  params: {
    chaveAcesso: string;
    formato?: "xml" | "json";
  },
): Promise<{
  chaveAcesso: string;
  disponivel: boolean;
  detalhes: string;
}> {
  if (!params.chaveAcesso || params.chaveAcesso.length !== CHAVE_ACESSO_LENGTH) {
    throw new NfseValidationError([{
      field: "chaveAcesso",
      message: `Chave de acesso deve ter ${CHAVE_ACESSO_LENGTH} caracteres`,
    }]);
  }

  // Use DANFSE endpoint to verify if the NFS-e exists (returns PDF if valid)
  const response = await client.request({
    method: "GET",
    path: `/danfse/v1?chave=${params.chaveAcesso}`,
    accept: "application/json",
  });

  if (response.status === 200) {
    return {
      chaveAcesso: params.chaveAcesso,
      disponivel: true,
      detalhes: "NFS-e encontrada. Use nfse_gerar_danfse para obter o PDF.",
    };
  }

  return {
    chaveAcesso: params.chaveAcesso,
    disponivel: false,
    detalhes: response.body || `Status ${response.status} — NFS-e não encontrada ou ainda em processamento`,
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
  resultados: Array<{
    chaveAcesso: string;
    nsuRecepcao: string;
    statusProcessamento: string;
  }>;
  totalDocumentos: number;
  dataHoraProcessamento: string;
}> {
  if (!params.cnpj || params.cnpj.length !== 14) {
    throw new NfseValidationError([{
      field: "cnpj", message: "CNPJ deve ter 14 dígitos",
    }]);
  }

  // DFe distribution also goes through POST /DFe but with a distribution XML
  const tipoFiltro = params.tipo || "todas";
  const tpDist = tipoFiltro === "emitidas" ? "1" : tipoFiltro === "recebidas" ? "2" : "0";

  const distXml = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<distDFeInt xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.00">`,
    `<tpDist>${tpDist}</tpDist>`,
    `<CNPJ>${params.cnpj}</CNPJ>`,
    `<ultNSU>${params.ultimoNsu}</ultNSU>`,
    `</distDFeInt>`,
  ].join("");

  const dfeResponse = await client.postDfe([distXml]);

  const resultados = (dfeResponse.Lote || []).map((doc) => ({
    chaveAcesso: doc.ChaveAcesso || "",
    nsuRecepcao: doc.NsuRecepcao || "",
    statusProcessamento: doc.StatusProcessamento || "",
  }));

  return {
    resultados,
    totalDocumentos: resultados.length,
    dataHoraProcessamento: dfeResponse.DataHoraProcessamento,
  };
}

export async function nfseConsultarLote(
  _client: AdnHttpClient,
  params: {
    protocolo: string;
    cnpjPrestador: string;
  },
): Promise<{
  protocolo: string;
  mensagem: string;
}> {
  if (!params.protocolo) {
    throw new NfseValidationError([{ field: "protocolo", message: "Protocolo é obrigatório" }]);
  }

  // The ADN processes documents synchronously via POST /DFe.
  // Lote consultation is not needed — results come in the emission response.
  return {
    protocolo: params.protocolo,
    mensagem: "O ADN processa documentos de forma síncrona via POST /DFe. " +
      "O resultado de cada documento é retornado imediatamente na resposta da emissão. " +
      "Use nfse_emitir ou nfse_emitir_lote e verifique o campo statusProcessamento.",
  };
}
