/**
 * Tools de eventos: nfse_cancelar, nfse_substituir
 */

import type { AdnHttpClient } from "../auth/http-client.js";
import type { CertManager } from "../auth/cert-manager.js";
import { buildCancelamentoXml, signDpsXml, buildDpsXml, type DpsInput } from "../xml/dps-builder.js";
import { parseEventoResponse, parseNfseResponse } from "../xml/nfse-parser.js";
import { NfseValidationError } from "../errors/nfse-errors.js";
import { CHAVE_ACESSO_LENGTH, PRAZO_CANCELAMENTO_DIAS } from "../config.js";

const MOTIVOS_CANCELAMENTO = ["ERRO_EMISSAO", "SERVICO_NAO_PRESTADO", "OUTRO"];

export async function nfseCancelar(
  client: AdnHttpClient,
  certManager: CertManager,
  params: {
    chaveAcesso: string;
    motivo: string;
    descricaoMotivo?: string;
  },
): Promise<{
  chaveAcesso: string;
  situacao: string;
  dataEvento: string;
  motivo: string;
}> {
  const errors: Array<{ field: string; message: string }> = [];

  if (!params.chaveAcesso || params.chaveAcesso.length !== CHAVE_ACESSO_LENGTH) {
    errors.push({ field: "chaveAcesso", message: `Chave de acesso deve ter ${CHAVE_ACESSO_LENGTH} caracteres` });
  }
  if (!MOTIVOS_CANCELAMENTO.includes(params.motivo)) {
    errors.push({ field: "motivo", message: `Motivo inválido. Permitidos: ${MOTIVOS_CANCELAMENTO.join(", ")}` });
  }
  if (errors.length > 0) throw new NfseValidationError(errors);

  // Build and sign cancellation event
  const xml = buildCancelamentoXml(params.chaveAcesso, params.motivo, params.descricaoMotivo);
  const signedXml = signDpsXml(xml, certManager.getCredentials());

  const response = await client.postXml("/sefin/v1/NFSe/eventos", signedXml);
  const evento = parseEventoResponse(response.body);

  return {
    chaveAcesso: evento.chaveAcesso,
    situacao: evento.situacao,
    dataEvento: evento.dataEvento,
    motivo: evento.motivo || params.motivo,
  };
}

export async function nfseSubstituir(
  client: AdnHttpClient,
  certManager: CertManager,
  params: {
    chaveAcessoOriginal: string;
    motivoSubstituicao?: string;
    novaDps: DpsInput;
  },
): Promise<{
  chaveAcessoOriginal: string;
  chaveAcessoNova: string;
  numero: string;
  situacao: string;
  dataEvento: string;
}> {
  const errors: Array<{ field: string; message: string }> = [];

  if (!params.chaveAcessoOriginal || params.chaveAcessoOriginal.length !== CHAVE_ACESSO_LENGTH) {
    errors.push({ field: "chaveAcessoOriginal", message: `Chave de acesso deve ter ${CHAVE_ACESSO_LENGTH} caracteres` });
  }
  if (!params.novaDps) {
    errors.push({ field: "novaDps", message: "Nova DPS é obrigatória para substituição" });
  }
  if (errors.length > 0) throw new NfseValidationError(errors);

  // 1. Build the substitution event XML
  const dpsXml = buildDpsXml(params.novaDps);
  const signedDps = signDpsXml(dpsXml, certManager.getCredentials());

  // Wrap in substitution envelope
  const substXml = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<pedSubstNFSe xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.00">`,
    `<chNFSeSubs>${params.chaveAcessoOriginal}</chNFSeSubs>`,
    params.motivoSubstituicao ? `<xMotivo>${params.motivoSubstituicao}</xMotivo>` : "",
    signedDps,
    `</pedSubstNFSe>`,
  ].join("");

  const response = await client.postXml("/sefin/v1/NFSe/substituicao", substXml);
  const nfseNova = parseNfseResponse(response.body);

  return {
    chaveAcessoOriginal: params.chaveAcessoOriginal,
    chaveAcessoNova: nfseNova.chaveAcesso,
    numero: nfseNova.numero,
    situacao: "substituida",
    dataEvento: nfseNova.dataEmissao,
  };
}
