/**
 * Tools utilitárias: nfse_validar_dps, nfse_status_ambiente
 */

import type { AdnHttpClient } from "../auth/http-client.js";
import type { CertManager } from "../auth/cert-manager.js";
import { getAdnUrl, getSefinUrl, type Ambiente } from "../config.js";
import type { DpsInput } from "../xml/dps-builder.js";

/**
 * Valida uma DPS sem enviar ao ADN
 */
export function nfseValidarDps(
  certManager: CertManager,
  params: DpsInput,
): {
  valida: boolean;
  erros: Array<{ campo: string; mensagem: string }>;
  avisos: Array<{ campo: string; mensagem: string }>;
} {
  const erros: Array<{ campo: string; mensagem: string }> = [];
  const avisos: Array<{ campo: string; mensagem: string }> = [];

  // Required fields
  if (!params.cnpjPrestador || params.cnpjPrestador.length !== 14) {
    erros.push({ campo: "cnpjPrestador", mensagem: "CNPJ deve ter 14 dígitos numéricos" });
  } else if (!validarCnpj(params.cnpjPrestador)) {
    erros.push({ campo: "cnpjPrestador", mensagem: "CNPJ inválido (dígitos verificadores)" });
  }

  if (!params.competencia || !/^\d{4}-\d{2}$/.test(params.competencia)) {
    erros.push({ campo: "competencia", mensagem: "Formato deve ser YYYY-MM" });
  } else {
    const [year, month] = params.competencia.split("-").map(Number);
    if (month < 1 || month > 12) erros.push({ campo: "competencia", mensagem: "Mês inválido" });
    if (year < 2023 || year > 2030) avisos.push({ campo: "competencia", mensagem: "Ano fora do range esperado" });
  }

  if (!params.serieDps) {
    erros.push({ campo: "serieDps", mensagem: "Série é obrigatória" });
  } else if (!/^\d+$/.test(params.serieDps)) {
    // Condicional: >= 2026-01 é erro, antes é aviso
    if (params.competencia && params.competencia >= "2026-01") {
      erros.push({ campo: "serieDps", mensagem: `Série "${params.serieDps}" é alfanumérica. A partir de jan/2026, a série deve ser exclusivamente numérica (Resolução CGNFS-e nº 3/2025).` });
    } else {
      avisos.push({ campo: "serieDps", mensagem: "Série alfanumérica — será obrigatoriamente numérica a partir de jan/2026" });
    }
  }

  if (!params.numeroDps) {
    erros.push({ campo: "numeroDps", mensagem: "Número da DPS é obrigatório" });
  }

  // Serviço
  if (!params.servico?.codigoTribNac) {
    erros.push({ campo: "servico.codigoTribNac", mensagem: "Código de tributação nacional é obrigatório" });
  }
  if (!params.servico?.descricao) {
    erros.push({ campo: "servico.descricao", mensagem: "Descrição do serviço é obrigatória" });
  } else if (params.servico.descricao.length < 10) {
    avisos.push({ campo: "servico.descricao", mensagem: "Descrição muito curta (mínimo recomendado: 10 caracteres)" });
  }

  // Valores
  if (!params.valores?.valorServicos || params.valores.valorServicos <= 0) {
    erros.push({ campo: "valores.valorServicos", mensagem: "Valor dos serviços deve ser positivo" });
  }
  if (params.valores?.aliquotaIss != null && (params.valores.aliquotaIss < 0 || params.valores.aliquotaIss > 5)) {
    avisos.push({ campo: "valores.aliquotaIss", mensagem: `Alíquota de ${params.valores.aliquotaIss}% fora da faixa comum (0-5%)` });
  }
  if (params.valores?.deducoes && params.valores.deducoes >= params.valores.valorServicos) {
    erros.push({ campo: "valores.deducoes", mensagem: "Deduções não podem ser iguais ou maiores que o valor dos serviços" });
  }

  // Tomador
  if (params.tomador?.cpfCnpj) {
    const doc = params.tomador.cpfCnpj;
    if (doc.length === 14 && !validarCnpj(doc)) {
      erros.push({ campo: "tomador.cpfCnpj", mensagem: "CNPJ do tomador inválido" });
    } else if (doc.length === 11 && !validarCpf(doc)) {
      erros.push({ campo: "tomador.cpfCnpj", mensagem: "CPF do tomador inválido" });
    } else if (doc.length !== 11 && doc.length !== 14) {
      erros.push({ campo: "tomador.cpfCnpj", mensagem: "CPF/CNPJ deve ter 11 ou 14 dígitos" });
    }
  }

  // Certificate check
  const certInfo = certManager.getCertInfo();
  if (certInfo.cnpj && certInfo.cnpj !== params.cnpjPrestador) {
    erros.push({
      campo: "certificado",
      mensagem: `CNPJ do certificado (${certInfo.cnpj}) difere do prestador (${params.cnpjPrestador}). A assinatura será rejeitada.`,
    });
  }

  const expiry = certManager.checkExpiry();
  if (!expiry.valid) {
    erros.push({ campo: "certificado", mensagem: "Certificado digital expirado" });
  } else if (expiry.daysLeft <= 7) {
    avisos.push({ campo: "certificado", mensagem: `Certificado expira em ${expiry.daysLeft} dia(s)` });
  }

  return {
    valida: erros.length === 0,
    erros,
    avisos,
  };
}

/**
 * Verifica status do ambiente ADN e validade do certificado
 */
export async function nfseStatusAmbiente(
  client: AdnHttpClient,
  certManager: CertManager,
  ambiente: Ambiente,
): Promise<{
  ambiente: string;
  adnUrl: string;
  sefinUrl: string;
  adnDisponivel: boolean;
  latenciaMs?: number;
  certificado: {
    valido: boolean;
    diasRestantes: number;
    expiraEm: string;
    cnpj: string | null;
    razaoSocial: string | null;
    avisos: string[];
  };
}> {
  const adnUrl = getAdnUrl(ambiente);
  const sefinUrl = getSefinUrl(ambiente);
  const certExpiry = certManager.checkExpiry();
  const certInfo = certManager.getCertInfo();

  let adnDisponivel = false;
  let latenciaMs: number | undefined;

  // Test ADN connectivity via distribution endpoint (confirmed working)
  try {
    const start = Date.now();
    await client.request({ method: "GET", path: "/contribuintes/DFe/0", accept: "application/xml" });
    latenciaMs = Date.now() - start;
    adnDisponivel = true;
  } catch (err) {
    console.error("[nfse-mcp] Falha ao conectar com ADN:", err instanceof Error ? err.message : err);
  }

  return {
    ambiente,
    adnUrl,
    sefinUrl,
    adnDisponivel,
    latenciaMs,
    certificado: {
      valido: certExpiry.valid,
      diasRestantes: certExpiry.daysLeft,
      expiraEm: certExpiry.expiresAt.toISOString(),
      cnpj: certInfo.cnpj,
      razaoSocial: certInfo.razaoSocial,
      avisos: certExpiry.warnings,
    },
  };
}

// ── Validation Helpers ──

function validarCnpj(cnpj: string): boolean {
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;
  const calc = (digits: string, weights: number[]): number => {
    let sum = 0;
    for (let i = 0; i < weights.length; i++) sum += parseInt(digits[i]) * weights[i];
    const rem = sum % 11;
    return rem < 2 ? 0 : 11 - rem;
  };
  const d1 = calc(cnpj, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = calc(cnpj, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return parseInt(cnpj[12]) === d1 && parseInt(cnpj[13]) === d2;
}

function validarCpf(cpf: string): boolean {
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const calc = (len: number): number => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += parseInt(cpf[i]) * (len + 1 - i);
    const rem = sum % 11;
    return rem < 2 ? 0 : 11 - rem;
  };
  return parseInt(cpf[9]) === calc(9) && parseInt(cpf[10]) === calc(10);
}
