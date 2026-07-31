/**
 * Cliente REST da Conta Azul (API v2). OAuth2 Cognito: o refresh_token de longa
 * duração troca por access_token curto, com cache em memória e renovação
 * automática. O refresh_token PODE rotacionar a cada uso — quando vier um novo,
 * avisamos no stderr para o operador atualizar o env/secrets.
 *
 * Envs: CONTAAZUL_CLIENT_ID, CONTAAZUL_CLIENT_SECRET, CONTAAZUL_REFRESH_TOKEN.
 */

const BASE = process.env.CONTAAZUL_API_URL ?? "https://api-v2.contaazul.com";
const AUTH_URL = process.env.CONTAAZUL_AUTH_URL ?? "https://auth.contaazul.com/oauth2/token";

let cached: { accessToken: string; expiresAt: number } | null = null;
let refreshToken = process.env.CONTAAZUL_REFRESH_TOKEN ?? "";

async function authenticate(): Promise<string> {
  const clientId = process.env.CONTAAZUL_CLIENT_ID;
  const clientSecret = process.env.CONTAAZUL_CLIENT_SECRET;
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "CONTAAZUL_CLIENT_ID, CONTAAZUL_CLIENT_SECRET e CONTAAZUL_REFRESH_TOKEN são obrigatórios (portal developers.contaazul.com).",
    );
  }
  if (cached && cached.expiresAt > Date.now()) return cached.accessToken;

  const res = await fetch(AUTH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }).toString(),
  });
  if (!res.ok) {
    throw new Error(`Falha na autenticação Conta Azul (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as { access_token: string; expires_in?: number; refresh_token?: string };
  if (data.refresh_token && data.refresh_token !== refreshToken) {
    refreshToken = data.refresh_token;
    console.error("[mcp-contaazul] refresh_token ROTACIONOU — atualize CONTAAZUL_REFRESH_TOKEN no secrets.");
  }
  const validadeMs = Math.max(60, (data.expires_in ?? 3600) - 120) * 1000;
  cached = { accessToken: data.access_token, expiresAt: Date.now() + validadeMs };
  return data.access_token;
}

export async function caRequest(method: string, path: string, body?: unknown): Promise<unknown> {
  const token = await authenticate();
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  if (!res.ok) {
    throw new Error(`Conta Azul ${method} ${path} → ${res.status}: ${JSON.stringify(json)}`);
  }
  return json;
}

export function qs(params: Record<string, string | number | boolean | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== "");
  if (entries.length === 0) return "";
  return "?" + entries.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join("&");
}
