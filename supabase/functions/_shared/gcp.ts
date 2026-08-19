// Token OAuth de service account GCP, assinado com WebCrypto. Zero dependências.
//
// A credencial vive no cofre, por empresa:
//   integracao:gcp:<company_id>:service_account   (o JSON inteiro da conta de serviço)
//   integracao:gcp:<company_id>:project_id        (opcional; vence o project_id do JSON)
//
// Serve ao motor de previsão TimesFM no BigQuery. Sem a credencial, o forecast
// continua funcionando pelo modelo de linguagem: esta é uma melhoria opcional,
// não um pré-requisito.
// deno-lint-ignore-file no-explicit-any
/* eslint-disable @typescript-eslint/no-explicit-any */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";

import { segredoDaIntegracao } from "./segredos.ts";

export class GcpNaoConfigurado extends Error {
  constructor() {
    super(
      "Google Cloud não configurado. Informe a chave da conta de serviço em Configurações > Motor de previsão.",
    );
  }
}

interface TokenCache {
  token: string;
  projectId: string;
  expiraEm: number; // epoch ms
}

// isolates do Deno reutilizam o módulo entre invocações: o cache corta latência
// e chamadas ao endpoint de token. Por empresa, porque cada uma tem a sua conta.
const cache = new Map<string, TokenCache>();

function b64url(data: Uint8Array | string): string {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemParaDer(pem: string): Uint8Array {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * Troca um service account JSON (cru) por um access token GCP. Sem cache —
 * usado pelo getGcpAccessToken (Vault) e pelo teste de conexão do onboarding
 * (creds digitadas, antes de salvar).
 */
export async function gcpAccessTokenFromCreds(
  saJson: string,
  projectIdOverride?: string | null,
): Promise<{ token: string; projectId: string; expiresIn: number }> {
  let sa: { client_email: string; private_key: string; project_id?: string };
  try {
    sa = JSON.parse(saJson);
  } catch {
    throw new Error("o service account não é um JSON válido");
  }
  if (!sa.client_email || !sa.private_key) {
    throw new Error("service account sem client_email/private_key");
  }
  const projectId = (projectIdOverride || undefined) ?? sa.project_id;
  if (!projectId) throw new Error("project_id GCP não encontrado");

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemParaDer(sa.private_key) as unknown as ArrayBuffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const iat = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/bigquery",
      aud: "https://oauth2.googleapis.com/token",
      iat,
      exp: iat + 3600,
    }),
  );
  const assinatura = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(`${header}.${claims}`),
  );
  const jwt = `${header}.${claims}.${b64url(new Uint8Array(assinatura))}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) {
    throw new Error(`GCP token falhou (${res.status}): ${await res.text()}`);
  }
  const { access_token, expires_in } = await res.json();
  return { token: access_token, projectId, expiresIn: Number(expires_in ?? 3600) };
}

/**
 * Token a partir da credencial guardada no cofre desta empresa.
 * Lança GcpNaoConfigurado quando a empresa não configurou: quem chama decide
 * se cai no motor de reserva ou devolve 503.
 */
export async function getGcpAccessToken(
  svc: SupabaseClient,
  companyId: string,
): Promise<{ token: string; projectId: string }> {
  const emCache = cache.get(companyId);
  if (emCache && Date.now() < emCache.expiraEm) {
    return { token: emCache.token, projectId: emCache.projectId };
  }

  const saJson = await segredoDaIntegracao(svc, companyId, "gcp", "service_account");
  if (!saJson) throw new GcpNaoConfigurado();

  const projOverride = await segredoDaIntegracao(svc, companyId, "gcp", "project_id");

  const { token, projectId, expiresIn } = await gcpAccessTokenFromCreds(saJson, projOverride);

  // renova um minuto antes de expirar, para não estourar no meio de uma consulta
  cache.set(companyId, { token, projectId, expiraEm: Date.now() + (expiresIn - 60) * 1000 });
  return { token, projectId };
}

/** Executa uma consulta no BigQuery e devolve as linhas cruas. */
export async function bigQueryConsulta(
  token: string,
  projectId: string,
  sql: string,
): Promise<Array<{ f: Array<{ v: unknown }> }>> {
  const res = await fetch(
    `https://bigquery.googleapis.com/bigquery/v2/projects/${projectId}/queries`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      // useLegacySql precisa ser explícito: sem ele o BigQuery recusa a sintaxe padrão
      body: JSON.stringify({ query: sql, useLegacySql: false, timeoutMs: 55_000 }),
    },
  );
  if (!res.ok) {
    throw new Error(`BigQuery recusou a consulta (${res.status}): ${(await res.text()).slice(0, 300)}`);
  }
  const json = await res.json();
  return (json.rows ?? []) as Array<{ f: Array<{ v: unknown }> }>;
}
