/**
 * Mapeamento de códigos de rejeição do ADN NFS-e Nacional
 * Referência: Manual de Integração da NFS-e Nacional
 */

export class NfseError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: string,
  ) {
    super(`[${code}] ${message}`);
    this.name = "NfseError";
  }
}

export class NfseValidationError extends NfseError {
  constructor(
    public readonly errors: Array<{ field: string; message: string }>,
  ) {
    super(
      "VALIDATION",
      `Validação falhou: ${errors.map((e) => `${e.field}: ${e.message}`).join("; ")}`,
    );
    this.name = "NfseValidationError";
  }
}

export class NfseCertificateError extends NfseError {
  constructor(message: string) {
    super("CERT_ERROR", message);
    this.name = "NfseCertificateError";
  }
}

export class NfseRejeicaoError extends NfseError {
  constructor(code: string, message: string) {
    super(code, message);
    this.name = "NfseRejeicaoError";
  }
}

/**
 * Códigos de rejeição mais comuns do ADN
 */
export const REJEICOES: Record<string, string> = {
  // Certificado
  "201": "Certificado digital não é de pessoa jurídica",
  "202": "Certificado digital expirado",
  "203": "Certificado digital revogado",
  "204": "Certificado digital não é ICP-Brasil",

  // DPS / NFS-e
  "301": "DPS com erro de assinatura digital",
  "302": "DPS com CNPJ do prestador diferente do certificado",
  "303": "Número da DPS já utilizado",
  "304": "Série da DPS inválida",
  "305": "Data de competência inválida",
  "306": "Código de tributação nacional inválido",
  "307": "Valor de serviço menor ou igual a zero",
  "308": "Alíquota de ISS fora da faixa permitida",
  "309": "Município do prestador não aderente ao ADN",
  "310": "Tomador com CPF/CNPJ inválido",
  "311": "Tomador sem endereço completo",
  "312": "Série alfanumérica rejeitada (a partir de jan/2026, usar série numérica)",

  // Cancelamento
  "401": "NFS-e não encontrada com a chave de acesso informada",
  "402": "NFS-e já cancelada",
  "403": "Prazo para cancelamento expirado (máximo 35 dias)",
  "404": "NFS-e já substituída — não pode ser cancelada",
  "405": "Certificado não pertence ao prestador da NFS-e",

  // Substituição
  "501": "NFS-e original não encontrada",
  "502": "NFS-e original já cancelada",
  "503": "NFS-e original já substituída",

  // Lote
  "601": "Lote excede limite de 50 DPS",
  "602": "Lote com DPS duplicadas",
  "603": "Protocolo de lote não encontrado",

  // Consulta
  "701": "Chave de acesso com formato inválido",
  "702": "Certificado não autorizado para consultar esta NFS-e",
  "703": "NSU inválido ou fora de sequência",
};

export function getRejeicaoMessage(code: string): string {
  return REJEICOES[code] || `Rejeição desconhecida (código: ${code})`;
}

export function parseAdnError(responseBody: string | Record<string, unknown>): NfseError {
  try {
    const body = typeof responseBody === "string" ? JSON.parse(responseBody) : responseBody;
    const code = String(body.cStat || body.codigo || body.code || "UNKNOWN");
    const msg = String(body.xMotivo || body.mensagem || body.message || "Erro desconhecido");
    return new NfseRejeicaoError(code, REJEICOES[code] || msg);
  } catch {
    return new NfseError("PARSE_ERROR", "Erro ao interpretar resposta do ADN", String(responseBody));
  }
}
