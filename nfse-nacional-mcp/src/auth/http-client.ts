/**
 * HTTP client com mTLS para chamadas ao ADN NFS-e Nacional
 *
 * Encapsula o fetch com certificado digital e tratamento de erros.
 */

import * as https from "node:https";
import type { CertManager } from "./cert-manager.js";
import { parseAdnError, NfseError } from "../errors/nfse-errors.js";

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

export class AdnHttpClient {
  private agent: https.Agent;

  constructor(
    private baseUrl: string,
    private certManager: CertManager,
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
}
