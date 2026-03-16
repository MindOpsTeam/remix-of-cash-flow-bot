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

const BASE_URLS: Record<Ambiente, string> = {
  producao: "https://adn.nfse.gov.br",
  homologacao: "https://adn.producaorestrita.nfse.gov.br",
};

/**
 * Paths das APIs disponíveis no ADN
 * Cada API tem seu próprio path base dentro do ADN
 */
const API_PATHS = {
  /** API SEFIN — emissão de DPS, eventos, consulta por chave */
  sefin: "/sefin/v1",
  /** API de DFe — distribuição de documentos por NSU */
  dfe: "/DFe",
  /** API de Contribuintes — parâmetros fiscais do contribuinte */
  contribuintes: "/contribuintes",
  /** API CNC — Cadastro Nacional de Contribuintes */
  cnc: "/cnc",
  /** API de Parametrização — parâmetros municipais */
  parametrizacao: "/parametrizacao",
  /** API DANFSE — geração de PDF */
  danfse: "/danfse",
} as const;

export function getBaseUrl(ambiente: Ambiente): string {
  return BASE_URLS[ambiente];
}

export function getApiUrl(ambiente: Ambiente, api: keyof typeof API_PATHS): string {
  return `${BASE_URLS[ambiente]}${API_PATHS[api]}`;
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
