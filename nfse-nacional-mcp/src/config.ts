/**
 * Configuração da API NFS-e Nacional (ADN)
 *
 * Documentação oficial:
 * - Portal: https://www.gov.br/nfse/pt-br
 * - ADN Produção: https://adn.nfse.gov.br
 * - ADN Homologação: https://adn.producaorestrita.nfse.gov.br
 */

export type Ambiente = "producao" | "homologacao";

export interface NfseConfig {
  ambiente: Ambiente;
  certPath: string;
  certPassword: string;
  certStorage: "file" | "vault" | "supabase";
}

/**
 * URLs do ecossistema NFS-e Nacional:
 * - SEFIN: recebe DPS para emissão de NFS-e (POST /SefinNacional/nfse)
 * - ADN: distribuição de NFS-e autorizadas e DANFSE (GET /contribuintes/DFe, GET /danfse/v1)
 */
const SEFIN_URLS: Record<Ambiente, string> = {
  producao: "https://sefin.nfse.gov.br",
  homologacao: "https://sefin.producaorestrita.nfse.gov.br",
};

const ADN_URLS: Record<Ambiente, string> = {
  producao: "https://adn.nfse.gov.br",
  homologacao: "https://adn.producaorestrita.nfse.gov.br",
};

export function getSefinUrl(ambiente: Ambiente): string {
  return SEFIN_URLS[ambiente];
}

export function getAdnUrl(ambiente: Ambiente): string {
  return ADN_URLS[ambiente];
}

/** @deprecated Use getSefinUrl or getAdnUrl */
export function getBaseUrl(ambiente: Ambiente): string {
  return ADN_URLS[ambiente];
}

export function loadConfig(): NfseConfig {
  const ambiente = (process.env.NFSE_AMBIENTE || "homologacao") as Ambiente;
  if (ambiente !== "producao" && ambiente !== "homologacao") {
    throw new Error(`NFSE_AMBIENTE inválido: ${ambiente}. Use "producao" ou "homologacao".`);
  }

  const certPath = process.env.NFSE_CERT_PATH;
  if (!certPath) {
    throw new Error("NFSE_CERT_PATH é obrigatório. Aponte para o arquivo .pfx do certificado A1.");
  }

  const certPassword = process.env.NFSE_CERT_PASSWORD;
  if (!certPassword) {
    throw new Error("NFSE_CERT_PASSWORD é obrigatório.");
  }

  const certStorage = (process.env.NFSE_CERT_STORAGE || "file") as NfseConfig["certStorage"];

  return { ambiente, certPath, certPassword, certStorage };
}

/** Prazo máximo para cancelamento/substituição de NFS-e */
export const PRAZO_CANCELAMENTO_DIAS = 35;

/** Tamanho máximo de lote para emissão assíncrona */
export const MAX_LOTE_SIZE = 50;

/** Tamanho da chave de acesso da NFS-e */
export const CHAVE_ACESSO_LENGTH = 50;

/** Versão do layout da DPS */
export const DPS_VERSAO = "1.00";

/** Namespaces XML oficiais */
export const XML_NAMESPACES = {
  nfse: "http://www.sped.fazenda.gov.br/nfse",
  ds: "http://www.w3.org/2000/09/xmldsig#",
} as const;
