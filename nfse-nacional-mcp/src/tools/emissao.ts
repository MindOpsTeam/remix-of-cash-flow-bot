/**
 * Tools de emissão: nfse_emitir, nfse_emitir_lote
 */

import type { AdnHttpClient } from "../auth/http-client.js";
import type { CertManager } from "../auth/cert-manager.js";
import { MAX_LOTE_SIZE } from "../config.js";
import { buildDpsXml, signDpsXml, buildIdDps, type DpsInput } from "../xml/dps-builder.js";
import { NfseValidationError } from "../errors/nfse-errors.js";
import { emissionCache } from "../cache/idempotency-cache.js";

type EmitirResult = {
  idDPS: string;
  chaveAcesso: string;
  dataHoraProcessamento: string;
  valorServicos: number;
  ambiente: string;
  alertas: Array<{ codigo: string; descricao: string }>;
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

  // Send to SEFIN Nacional (POST /SefinNacional/nfse)
  const sefinResponse = await client.postSefin(signedXml);

  const result: EmitirResult = {
    idDPS: sefinResponse.idDPS,
    chaveAcesso: sefinResponse.chaveAcesso || "",
    dataHoraProcessamento: sefinResponse.dataHoraProcessamento,
    valorServicos: params.valores.valorServicos,
    ambiente: sefinResponse.tipoAmbiente === 1 ? "producao" : "homologacao",
    alertas: (sefinResponse.alertas || []).map((a) => ({ codigo: a.Codigo, descricao: a.Descricao })),
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
  totalEnviado: number;
  ambiente: string;
  dataHoraProcessamento: string;
  resultados: Array<{
    idDPS: string;
    chaveAcesso: string;
    dataHoraProcessamento: string;
    alertas: Array<{ codigo: string; descricao: string }>;
    erros: Array<{ codigo: string; descricao: string }>;
  }>;
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

  // SEFIN accepts one DPS at a time — send each individually
  const resultados: Array<{
    idDPS: string;
    chaveAcesso: string;
    dataHoraProcessamento: string;
    alertas: Array<{ codigo: string; descricao: string }>;
    erros: Array<{ codigo: string; descricao: string }>;
  }> = [];

  for (const dps of lote) {
    dps.cnpjPrestador = cnpjPrestador;
    const xml = buildDpsXml(dps);
    const signedXml = signDpsXml(xml, certManager.getCredentials());

    try {
      const resp = await client.postSefin(signedXml);
      resultados.push({
        idDPS: resp.idDPS,
        chaveAcesso: resp.chaveAcesso || "",
        dataHoraProcessamento: resp.dataHoraProcessamento,
        alertas: (resp.alertas || []).map((a) => ({ codigo: a.Codigo, descricao: a.Descricao })),
        erros: [],
      });
    } catch (err) {
      resultados.push({
        idDPS: buildIdDps(dps),
        chaveAcesso: "",
        dataHoraProcessamento: new Date().toISOString(),
        alertas: [],
        erros: [{ codigo: "EMISSAO_FALHOU", descricao: err instanceof Error ? err.message : String(err) }],
      });
    }
  }

  return {
    totalEnviado: lote.length,
    ambiente: process.env.NFSE_AMBIENTE || "homologacao",
    dataHoraProcessamento: new Date().toISOString(),
    resultados,
  };
}

