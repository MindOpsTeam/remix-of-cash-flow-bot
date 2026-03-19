/**
 * Tools de eventos: nfse_cancelar, nfse_substituir
 */

import type { AdnHttpClient } from "../auth/http-client.js";
import type { CertManager } from "../auth/cert-manager.js";
import { buildCancelamentoXml, signDpsXml, buildDpsXml, type DpsInput } from "../xml/dps-builder.js";
import { NfseValidationError, NfseError } from "../errors/nfse-errors.js";
import { CHAVE_ACESSO_LENGTH } from "../config.js";

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
  statusProcessamento: string;
  dataHoraProcessamento: string;
  alertas: Array<{ codigo: string; descricao: string }>;
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

  // Send via POST /DFe
  const dfeResponse = await client.postDfe([signedXml]);
  const doc = dfeResponse.Lote?.[0];

  if (!doc) {
    throw new NfseError("ADN_EMPTY", "ADN retornou lote vazio para evento de cancelamento");
  }

  if (doc.Erros && doc.Erros.length > 0) {
    const erroMsg = doc.Erros.map((e) => `[${e.Codigo}] ${e.Descricao}${e.Complemento ? ` — ${e.Complemento}` : ""}`).join("; ");
    throw new NfseError("ADN_REJEICAO", `Cancelamento rejeitado: ${erroMsg}`);
  }

  return {
    chaveAcesso: doc.ChaveAcesso || params.chaveAcesso,
    statusProcessamento: doc.StatusProcessamento || "",
    dataHoraProcessamento: dfeResponse.DataHoraProcessamento,
    alertas: (doc.Alertas || []).map((a) => ({ codigo: a.Codigo, descricao: a.Descricao })),
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
  statusProcessamento: string;
  dataHoraProcessamento: string;
}> {
  const errors: Array<{ field: string; message: string }> = [];

  if (!params.chaveAcessoOriginal || params.chaveAcessoOriginal.length !== CHAVE_ACESSO_LENGTH) {
    errors.push({ field: "chaveAcessoOriginal", message: `Chave de acesso deve ter ${CHAVE_ACESSO_LENGTH} caracteres` });
  }
  if (!params.novaDps) {
    errors.push({ field: "novaDps", message: "Nova DPS é obrigatória para substituição" });
  }
  if (errors.length > 0) throw new NfseValidationError(errors);

  // Build the substitution event XML
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

  const signedSubst = signDpsXml(substXml, certManager.getCredentials());

  // Send via POST /DFe
  const dfeResponse = await client.postDfe([signedSubst]);
  const doc = dfeResponse.Lote?.[0];

  if (!doc) {
    throw new NfseError("ADN_EMPTY", "ADN retornou lote vazio para substituição");
  }

  if (doc.Erros && doc.Erros.length > 0) {
    const erroMsg = doc.Erros.map((e) => `[${e.Codigo}] ${e.Descricao}${e.Complemento ? ` — ${e.Complemento}` : ""}`).join("; ");
    throw new NfseError("ADN_REJEICAO", `Substituição rejeitada: ${erroMsg}`);
  }

  return {
    chaveAcessoOriginal: params.chaveAcessoOriginal,
    chaveAcessoNova: doc.ChaveAcesso || "",
    statusProcessamento: doc.StatusProcessamento || "",
    dataHoraProcessamento: dfeResponse.DataHoraProcessamento,
  };
}
