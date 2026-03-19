/**
 * Tool de documentos: nfse_gerar_danfse
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { AdnHttpClient } from "../auth/http-client.js";
import { NfseValidationError } from "../errors/nfse-errors.js";
import { CHAVE_ACESSO_LENGTH } from "../config.js";

export async function nfseGerarDanfse(
  client: AdnHttpClient,
  params: {
    chaveAcesso: string;
    retornarBase64?: boolean;
    salvarPath?: string;
  },
): Promise<{
  chaveAcesso: string;
  pdfBase64?: string;
  salvoEm?: string;
  tamanhoBytes: number;
}> {
  if (!params.chaveAcesso || params.chaveAcesso.length !== CHAVE_ACESSO_LENGTH) {
    throw new NfseValidationError([{
      field: "chaveAcesso",
      message: `Chave de acesso deve ter ${CHAVE_ACESSO_LENGTH} caracteres`,
    }]);
  }

  const pdfBuffer = await client.getPdf(`/danfse/v1?chave=${params.chaveAcesso}`);

  let salvoEm: string | undefined;
  if (params.salvarPath) {
    const dirPath = path.dirname(params.salvarPath);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    fs.writeFileSync(params.salvarPath, pdfBuffer);
    salvoEm = params.salvarPath;
  }

  return {
    chaveAcesso: params.chaveAcesso,
    pdfBase64: params.retornarBase64 !== false ? pdfBuffer.toString("base64") : undefined,
    salvoEm,
    tamanhoBytes: pdfBuffer.length,
  };
}
