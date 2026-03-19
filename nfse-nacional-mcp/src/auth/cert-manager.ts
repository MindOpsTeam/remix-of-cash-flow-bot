/**
 * Gerenciamento de certificados digitais ICP-Brasil (A1)
 *
 * O ADN NFS-e Nacional exige autenticação via mTLS com certificado digital.
 * Este módulo carrega o .pfx (PKCS#12), extrai chave privada e certificado,
 * e cria o agente HTTPS para mTLS.
 */

import * as fs from "node:fs";
import * as https from "node:https";
import * as tls from "node:tls";
import forge from "node-forge";
import { NfseCertificateError } from "../errors/nfse-errors.js";

export interface CertificateInfo {
  subject: string;
  issuer: string;
  serialNumber: string;
  notBefore: Date;
  notAfter: Date;
  cnpj: string | null;
  cpf: string | null;
  razaoSocial: string | null;
  daysUntilExpiry: number;
}

export interface TlsCredentials {
  cert: string; // PEM (client cert + chain)
  key: string; // PEM
}

export class CertManager {
  private credentials: TlsCredentials | null = null;
  private info: CertificateInfo | null = null;

  constructor(
    private certPath: string,
    private certPassword: string,
  ) {}

  /**
   * Carrega e parseia o certificado .pfx (PKCS#12)
   */
  async load(): Promise<void> {
    if (!fs.existsSync(this.certPath)) {
      throw new NfseCertificateError(`Arquivo de certificado não encontrado: ${this.certPath}`);
    }

    const pfxBuffer = fs.readFileSync(this.certPath);
    const pfxBase64 = pfxBuffer.toString("binary");

    let p12: forge.pkcs12.Pkcs12Pfx;
    try {
      const pfxAsn1 = forge.asn1.fromDer(pfxBase64);
      p12 = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, this.certPassword);
    } catch (err) {
      throw new NfseCertificateError(
        `Falha ao abrir certificado .pfx. Verifique o arquivo e a senha. Detalhe: ${err instanceof Error ? err.message : err}`,
      );
    }

    // Extract private key
    const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
    const keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag];
    if (!keyBag || keyBag.length === 0 || !keyBag[0].key) {
      throw new NfseCertificateError("Certificado .pfx não contém chave privada");
    }
    const privateKey = keyBag[0].key;

    // Extract certificate
    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
    const certBag = certBags[forge.pki.oids.certBag];
    if (!certBag || certBag.length === 0 || !certBag[0].cert) {
      throw new NfseCertificateError("Certificado .pfx não contém certificado X.509");
    }
    const cert = certBag[0].cert;

    // Convert to PEM
    const certPem = forge.pki.certificateToPem(cert);
    const keyPem = forge.pki.privateKeyToPem(privateKey);

    // Build chain (intermediate + root CAs from .pfx)
    // These are appended to `cert` so the server receives the full client chain.
    // They must NOT go in `ca`, which controls server-cert verification.
    const chainPems: string[] = [];
    if (certBag.length > 1) {
      for (let i = 1; i < certBag.length; i++) {
        if (certBag[i].cert) {
          chainPems.push(forge.pki.certificateToPem(certBag[i].cert!));
        }
      }
    }

    this.credentials = {
      cert: chainPems.length > 0 ? certPem + "\n" + chainPems.join("\n") : certPem,
      key: keyPem,
    };

    // Parse certificate info
    this.info = this.parseCertInfo(cert);
  }

  /**
   * Extrai informações do certificado (CNPJ, razão social, validade)
   */
  private parseCertInfo(cert: forge.pki.Certificate): CertificateInfo {
    const now = new Date();
    const notAfter = cert.validity.notAfter;
    const daysUntilExpiry = Math.floor((notAfter.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    // Extract CNPJ/CPF from Subject Alternative Name or CN
    const cn = cert.subject.getField("CN")?.value || "";
    let cnpj: string | null = null;
    let cpf: string | null = null;
    let razaoSocial: string | null = null;

    // CN format for ICP-Brasil: "RAZAO SOCIAL:12345678000190"
    const cnMatch = cn.match(/^(.+?):(\d{14})$/);
    if (cnMatch) {
      razaoSocial = cnMatch[1].trim();
      cnpj = cnMatch[2];
    } else {
      const cpfMatch = cn.match(/^(.+?):(\d{11})$/);
      if (cpfMatch) {
        razaoSocial = cpfMatch[1].trim();
        cpf = cpfMatch[2];
      }
    }

    // Also check OID 2.16.76.1.3.3 (CNPJ) in SAN
    try {
      const sanExt = cert.getExtension("subjectAltName");
      if (sanExt && typeof sanExt === "object" && "altNames" in sanExt) {
        const altNames = (sanExt as { altNames: Array<{ type: number; value: string }> }).altNames;
        for (const an of altNames) {
          if (an.type === 0 && an.value) {
            // OtherName with OID for CNPJ
            const cnpjMatch = an.value.match(/\d{14}/);
            if (cnpjMatch) cnpj = cnpjMatch[0];
          }
        }
      }
    } catch {
      // SAN parsing is best-effort
    }

    return {
      subject: cn,
      issuer: cert.issuer.getField("CN")?.value || "",
      serialNumber: cert.serialNumber,
      notBefore: cert.validity.notBefore,
      notAfter,
      cnpj,
      cpf,
      razaoSocial,
      daysUntilExpiry,
    };
  }

  /**
   * Retorna informações do certificado
   */
  getCertInfo(): CertificateInfo {
    if (!this.info) throw new NfseCertificateError("Certificado não carregado. Chame load() primeiro.");
    return this.info;
  }

  /**
   * Verifica se o certificado está expirado ou próximo do vencimento
   */
  checkExpiry(): { valid: boolean; daysLeft: number; expiresAt: Date; warnings: string[] } {
    const info = this.getCertInfo();
    const warnings: string[] = [];

    if (info.daysUntilExpiry <= 0) {
      warnings.push("CERTIFICADO EXPIRADO! Emissão de NFS-e bloqueada.");
    } else if (info.daysUntilExpiry <= 7) {
      warnings.push(`URGENTE: Certificado expira em ${info.daysUntilExpiry} dia(s)!`);
    } else if (info.daysUntilExpiry <= 15) {
      warnings.push(`ATENÇÃO: Certificado expira em ${info.daysUntilExpiry} dias.`);
    } else if (info.daysUntilExpiry <= 30) {
      warnings.push(`Certificado expira em ${info.daysUntilExpiry} dias. Providencie renovação.`);
    }

    return {
      valid: info.daysUntilExpiry > 0,
      daysLeft: info.daysUntilExpiry,
      expiresAt: info.notAfter,
      warnings,
    };
  }

  /**
   * Cria agente HTTPS com mTLS para chamadas ao ADN
   */
  createHttpsAgent(): https.Agent {
    if (!this.credentials) {
      throw new NfseCertificateError("Certificado não carregado. Chame load() primeiro.");
    }

    return new https.Agent({
      cert: this.credentials.cert,
      key: this.credentials.key,
      rejectUnauthorized: true,
      minVersion: "TLSv1.2",
    });
  }

  /**
   * Cria opções TLS para uso com fetch/undici
   */
  getTlsOptions(): tls.SecureContextOptions {
    if (!this.credentials) {
      throw new NfseCertificateError("Certificado não carregado. Chame load() primeiro.");
    }

    return {
      cert: this.credentials.cert,
      key: this.credentials.key,
    };
  }

  /**
   * Retorna as credenciais PEM para uso direto
   */
  getCredentials(): TlsCredentials {
    if (!this.credentials) {
      throw new NfseCertificateError("Certificado não carregado. Chame load() primeiro.");
    }
    return { ...this.credentials };
  }
}
