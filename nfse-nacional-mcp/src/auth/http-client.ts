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

export class AdnHttpClient {
  private agent: https.Agent;

  constructor(
    private baseUrl: string,
    private certManager: CertManager,
  ) {
    this.agent = certManager.createHttpsAgent();
  }

  async request(options: AdnRequestOptions): Promise<AdnResponse> {
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
