/**
 * Tools de emissão: nfse_emitir, nfse_emitir_lote
 */

import type { AdnHttpClient } from "../auth/http-client.js";
import type { CertManager } from "../auth/cert-manager.js";
import { MAX_LOTE_SIZE } from "../config.js";
import { buildDpsXml, signDpsXml, buildIdDps, type DpsInput } from "../xml/dps-builder.js";
import { parseNfseResponse } from "../xml/nfse-parser.js";
import { NfseValidationError } from "../errors/nfse-errors.js";
import { emissionCache } from "../cache/idempotency-cache.js";

type EmitirResult = {
  chaveAcesso: string;
  numero: string;
  serie: string;
  dataEmissao: string;
  valorServicos: number;
  valorIss: number;
  xmlAutorizado: string;
  idempotente?: boolean;
};

/**
 * Valida série condicional: se competência >= 2026-01, série DEVE ser numérica.
 * Antes de 2026-01, apenas aviso.
 */
function validarSerieCondicional(
  serieDps: string,
  competencia: string,
  errors: Array<{ field: string; message: string }>,
): void {
  if (!serieDps) return;

  const isNumeric = /^\d+$/.test(serieDps);
  if (!isNumeric) {
    // Competência >= 2026-01: erro hard
    if (competencia >= "2026-01") {
      errors.push({
        field: "serieDps",
        message: `Série "${serieDps}" é alfanumérica. A partir de jan/2026, a série da DPS deve ser exclusivamente numérica (Resolução CGNFS-e nº 3/2025).`,
      });
    }
    // Antes de 2026-01: ainda aceita mas o ADN pode rejeitar
  }
}

export async function nfseEmitir(
  client: AdnHttpClient,
  certManager: CertManager,
  params: DpsInput,
): Promise<EmitirResult> {
  // Validate required fields
  const errors: Array<{ field: string; message: string }> = [];
  if (!params.cnpjPrestador || params.cnpjPrestador.length !== 14) {
    errors.push({ field: "cnpjPrestador", message: "CNPJ deve ter 14 dígitos" });
  }
  if (!params.competencia || !/^\d{4}-\d{2}$/.test(params.competencia)) {
    errors.push({ field: "competencia", message: "Formato deve ser YYYY-MM" });
  }
  if (!params.servico?.codigoTribNac) {
    errors.push({ field: "servico.codigoTribNac", message: "Código de tributação nacional é obrigatório" });
  }
  if (!params.valores?.valorServicos || params.valores.valorServicos <= 0) {
    errors.push({ field: "valores.valorServicos", message: "Valor dos serviços deve ser positivo" });
  }
  if (!params.serieDps) {
    errors.push({ field: "serieDps", message: "Série da DPS é obrigatória" });
  }
  if (!params.numeroDps) {
    errors.push({ field: "numeroDps", message: "Número da DPS é obrigatório" });
  }

  // Série condicional (hard error se >= 2026-01)
  if (params.serieDps && params.competencia) {
    validarSerieCondicional(params.serieDps, params.competencia, errors);
  }

  if (errors.length > 0) throw new NfseValidationError(errors);

  // Verify certificate matches prestador CNPJ
  const certInfo = certManager.getCertInfo();
  if (certInfo.cnpj && certInfo.cnpj !== params.cnpjPrestador) {
    throw new NfseValidationError([{
      field: "cnpjPrestador",
      message: `CNPJ do certificado (${certInfo.cnpj}) difere do prestador (${params.cnpjPrestador})`,
    }]);
  }

  // Idempotency check: if this idDps was already emitted, return cached result
  const idDps = buildIdDps(params);
  const cached = emissionCache.get(idDps);
  if (cached) {
    console.error(`[nfse-mcp] Idempotência: idDps ${idDps} já emitido, retornando resultado do cache`);
    return { ...(cached as EmitirResult), idempotente: true };
  }

  // Build and sign XML
  const xml = buildDpsXml(params);
  const signedXml = signDpsXml(xml, certManager.getCredentials());

  // Send to ADN
  const response = await client.postXml("/sefin/v1/DPS", signedXml);
  const nfse = parseNfseResponse(response.body);

  const result: EmitirResult = {
    chaveAcesso: nfse.chaveAcesso,
    numero: nfse.numero,
    serie: nfse.serie,
    dataEmissao: nfse.dataEmissao,
    valorServicos: nfse.valores.valorServicos,
    valorIss: nfse.valores.valorIss || 0,
    xmlAutorizado: response.body,
  };

  // Cache successful emission
  emissionCache.set(idDps, result);

  return result;
}

export async function nfseEmitirLote(
  client: AdnHttpClient,
  certManager: CertManager,
  cnpjPrestador: string,
  lote: DpsInput[],
): Promise<{
  protocolo: string;
  totalEnviado: number;
  ambiente: string;
}> {
  if (lote.length === 0) {
    throw new NfseValidationError([{ field: "lote", message: "Lote não pode estar vazio" }]);
  }
  if (lote.length > MAX_LOTE_SIZE) {
    throw new NfseValidationError([{
      field: "lote",
      message: `Lote excede limite de ${MAX_LOTE_SIZE} DPS (enviado: ${lote.length})`,
    }]);
  }

  // Build and sign each DPS
  const signedDpsList: string[] = [];
  for (const dps of lote) {
    dps.cnpjPrestador = cnpjPrestador;
    const xml = buildDpsXml(dps);
    signedDpsList.push(signDpsXml(xml, certManager.getCredentials()));
  }

  // Wrap in lote envelope
  const loteXml = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<enviarLoteDPS xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.00">`,
    `<idLote>${Date.now()}</idLote>`,
    ...signedDpsList.map((xml) => `<DPS>${xml}</DPS>`),
    `</enviarLoteDPS>`,
  ].join("");

  const response = await client.postXml("/sefin/v1/DPS/lote", loteXml);

  // Parse protocol number from response
  const protMatch = response.body.match(/<nRec>(\d+)<\/nRec>/);
  const protocolo = protMatch?.[1] || "";

  return {
    protocolo,
    totalEnviado: lote.length,
    ambiente: process.env.NFSE_AMBIENTE || "homologacao",
  };
}
