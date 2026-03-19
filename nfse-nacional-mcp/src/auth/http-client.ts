/**
 * HTTP client com mTLS para chamadas ao ADN NFS-e Nacional
 *
 * Encapsula o fetch com certificado digital e tratamento de erros.
 */

import * as https from "node:https";
import * as zlib from "node:zlib";
import { promisify } from "node:util";
import type { CertManager } from "./cert-manager.js";
import { parseAdnError, NfseError } from "../errors/nfse-errors.js";

const gzip = promisify(zlib.gzip);

/**
 * Resposta do ADN POST /DFe (JSON)
 */
export interface DfeRecepcaoResponse {
  Lote: Array<{
    ChaveAcesso: string | null;
    NsuRecepcao: string | null;
    StatusProcessamento: string | null;
    Alertas: Array<{ Codigo: string; Descricao: string; Complemento?: string }> | null;
    Erros: Array<{ Codigo: string; Descricao: string; Complemento?: string }> | null;
  }>;
  TipoAmbiente: string;
  VersaoAplicativo: string | null;
  DataHoraProcessamento: string;
}

export interface AdnRequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  body?: string;
  contentType?: "application/xml" | "application/json";
  accept?: "application/xml" | "application/json" | "application/pdf";
  timeout?: number;
}

export interface AdnResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
  rawBuffer?: Buffer;
}

const RETRY_DELAYS = [1000, 3000, 9000]; // backoff: 1s, 3s, 9s

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Resposta do SEFIN Nacional (POST /SefinNacional/nfse)
 */
export interface SefinResponse {
  tipoAmbiente: number;
  versaoAplicativo: string;
  dataHoraProcessamento: string;
  idDPS: string;
  chaveAcesso?: string;
  numero?: string;
  serie?: string;
  erros?: Array<{ Codigo: string; Descricao: string; Complemento?: string }>;
  alertas?: Array<{ Codigo: string; Descricao: string; Complemento?: string }>;
}

export class AdnHttpClient {
  private agent: https.Agent;

  constructor(
    private baseUrl: string,
    private certManager: CertManager,
    private sefinUrl?: string,
  ) {
    this.agent = certManager.createHttpsAgent();
  }

  private async requestOnce(options: AdnRequestOptions): Promise<AdnResponse> {
    const url = `${this.baseUrl}${options.path}`;
    const method = options.method || "GET";
    const contentType = options.contentType || "application/xml";
    const accept = options.accept || "application/xml";
    const timeout = options.timeout || 30000;

    const headers: Record<string, string> = {
      Accept: accept,
      "User-Agent": "ERP-NFSE-MCP/1.0",
    };

    if (options.body) {
      headers["Content-Type"] = contentType;
    }

    return new Promise<AdnResponse>((resolve, reject) => {
      const urlObj = new URL(url);

      const req = https.request(
        {
          hostname: urlObj.hostname,
          port: urlObj.port || 443,
          path: urlObj.pathname + urlObj.search,
          method,
          headers,
          agent: this.agent,
          timeout,
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk: Buffer) => chunks.push(chunk));
          res.on("end", () => {
            const rawBuffer = Buffer.concat(chunks);
            const body = rawBuffer.toString("utf-8");
            const responseHeaders: Record<string, string> = {};
            for (const [key, value] of Object.entries(res.headers)) {
              if (value) responseHeaders[key] = Array.isArray(value) ? value.join(", ") : value;
            }

            resolve({
              status: res.statusCode || 0,
              headers: responseHeaders,
              body,
              rawBuffer: accept === "application/pdf" ? rawBuffer : undefined,
            });
          });
        },
      );

      req.on("error", (err) => {
        reject(new NfseError("CONNECTION", `Erro de conexão com ADN: ${err.message}`));
      });

      req.on("timeout", () => {
        req.destroy();
        reject(new NfseError("TIMEOUT", `Timeout de ${timeout}ms ao conectar com ADN`));
      });

      if (options.body) {
        req.write(options.body);
      }

      req.end();
    });
  }

  /**
   * Request with retry on 5xx errors (backoff: 1s, 3s, 9s).
   * 4xx errors fail immediately — they are business errors, not infra.
   */
  async request(options: AdnRequestOptions): Promise<AdnResponse> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
      try {
        const response = await this.requestOnce(options);

        // 4xx: fail immediately (business error)
        if (response.status >= 400 && response.status < 500) {
          return response;
        }

        // 5xx: retry with backoff
        if (response.status >= 500) {
          if (attempt < RETRY_DELAYS.length) {
            console.error(`[nfse-mcp] ADN retornou ${response.status}, retry ${attempt + 1}/${RETRY_DELAYS.length} em ${RETRY_DELAYS[attempt]}ms`);
            await sleep(RETRY_DELAYS[attempt]);
            continue;
          }
          return response; // last attempt, return as-is
        }

        return response; // 2xx/3xx: success
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        // Connection/timeout errors: retry
        if (attempt < RETRY_DELAYS.length) {
          console.error(`[nfse-mcp] Erro de conexão, retry ${attempt + 1}/${RETRY_DELAYS.length} em ${RETRY_DELAYS[attempt]}ms: ${lastError.message}`);
          await sleep(RETRY_DELAYS[attempt]);
          continue;
        }
        throw lastError;
      }
    }

    throw lastError || new NfseError("RETRY_EXHAUSTED", "Todas as tentativas falharam");
  }

  /**
   * POST XML com validação de resposta
   */
  async postXml(path: string, xml: string): Promise<AdnResponse> {
    const response = await this.request({
      method: "POST",
      path,
      body: xml,
      contentType: "application/xml",
      accept: "application/xml",
    });

    if (response.status >= 400) {
      throw parseAdnError(response.body);
    }

    return response;
  }

  /**
   * GET JSON com validação de resposta
   */
  async getJson(path: string): Promise<AdnResponse> {
    const response = await this.request({
      method: "GET",
      path,
      contentType: "application/json",
      accept: "application/json",
    });

    if (response.status >= 400) {
      throw parseAdnError(response.body);
    }

    return response;
  }

  /**
   * GET PDF (retorna Buffer)
   */
  async getPdf(path: string): Promise<Buffer> {
    const response = await this.request({
      method: "GET",
      path,
      accept: "application/pdf",
    });

    if (response.status >= 400) {
      throw parseAdnError(response.body);
    }

    return response.rawBuffer || Buffer.from(response.body, "binary");
  }

  /**
   * POST /SefinNacional/nfse — envia DPS assinada ao SEFIN Nacional para emissão de NFS-e.
   * O SEFIN aceita JSON com o XML compactado em GZip+Base64.
   */
  async postSefin(signedXml: string): Promise<SefinResponse> {
    if (!this.sefinUrl) {
      throw new NfseError("CONFIG", "URL do SEFIN não configurada");
    }

    const compressed = await gzip(Buffer.from(signedXml, "utf-8"));
    const b64 = compressed.toString("base64");
    const jsonBody = JSON.stringify({ dpsXmlGZipB64: b64 });

    // SEFIN has a different host, so we make a direct request
    const urlObj = new URL(`${this.sefinUrl}/SefinNacional/nfse`);

    const response = await new Promise<AdnResponse>((resolve, reject) => {
      const req = https.request(
        {
          hostname: urlObj.hostname,
          port: urlObj.port || 443,
          path: urlObj.pathname,
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            "User-Agent": "ERP-NFSE-MCP/1.0",
          },
          agent: this.agent,
          timeout: 30000,
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk: Buffer) => chunks.push(chunk));
          res.on("end", () => {
            const body = Buffer.concat(chunks).toString("utf-8");
            const headers: Record<string, string> = {};
            for (const [key, value] of Object.entries(res.headers)) {
              if (value) headers[key] = Array.isArray(value) ? value.join(", ") : value;
            }
            resolve({ status: res.statusCode || 0, headers, body });
          });
        },
      );
      req.on("error", (err) => reject(new NfseError("CONNECTION", `Erro de conexão com SEFIN: ${err.message}`)));
      req.on("timeout", () => { req.destroy(); reject(new NfseError("TIMEOUT", "Timeout ao conectar com SEFIN")); });
      req.write(jsonBody);
      req.end();
    });

    let parsed: SefinResponse;
    try {
      parsed = JSON.parse(response.body) as SefinResponse;
    } catch {
      throw new NfseError("PARSE_ERROR", "Resposta do SEFIN não é JSON válido", response.body);
    }

    // Check for errors in the response
    if (parsed.erros && parsed.erros.length > 0) {
      const erroMsg = parsed.erros.map((e) =>
        `[${e.Codigo}] ${e.Descricao}${e.Complemento ? ` — ${e.Complemento}` : ""}`
      ).join("; ");
      throw new NfseError("SEFIN_REJEICAO", erroMsg, JSON.stringify(parsed));
    }

    return parsed;
  }

  /**
   * POST /DFe — envia XMLs assinados ao ADN via formato GZip+Base64
   *
   * O ADN aceita um único endpoint POST /DFe com body JSON:
   * { "LoteXmlGZipB64": ["<xml gzipado em base64>", ...] }
   */
  async postDfe(xmlList: string[]): Promise<DfeRecepcaoResponse> {
    // Compress each XML with GZip and encode as Base64
    const loteGzipB64: string[] = [];
    for (const xml of xmlList) {
      const compressed = await gzip(Buffer.from(xml, "utf-8"));
      loteGzipB64.push(compressed.toString("base64"));
    }

    const jsonBody = JSON.stringify({ LoteXmlGZipB64: loteGzipB64 });

    const response = await this.request({
      method: "POST",
      path: "/DFe",
      body: jsonBody,
      contentType: "application/json",
      accept: "application/json",
    });

    if (response.status >= 400) {
      // Try to parse ADN error from JSON response
      try {
        const errorBody = JSON.parse(response.body);
        const details = errorBody.detail || errorBody.title || response.body;
        throw new NfseError("ADN_REJEICAO", `ADN rejeitou o documento: ${details}`, response.body);
      } catch (e) {
        if (e instanceof NfseError) throw e;
        throw parseAdnError(response.body);
      }
    }

    try {
      return JSON.parse(response.body) as DfeRecepcaoResponse;
    } catch {
      throw new NfseError("PARSE_ERROR", "Resposta do ADN não é JSON válido", response.body);
    }
  }
}
