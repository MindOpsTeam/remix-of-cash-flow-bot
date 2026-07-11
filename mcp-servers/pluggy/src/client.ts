/**
 * Cliente REST da Pluggy. Auth por API Key derivada de CLIENT_ID/CLIENT_SECRET,
 * com cache em memória (validade ~2h). Base configurável por env.
 */

const BASE = process.env.PLUGGY_API_URL ?? "https://api.pluggy.ai";

let cachedKey: { apiKey: string; expiresAt: number } | null = null;

async function authenticate(): Promise<string> {
  const clientId = process.env.PLUGGY_CLIENT_ID;
  const clientSecret = process.env.PLUGGY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET são obrigatórios (crie em dashboard.pluggy.ai → API Keys).",
    );
  }
  if (cachedKey && cachedKey.expiresAt > Date.now()) return cachedKey.apiKey;

  const res = await fetch(`${BASE}/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId, clientSecret }),
  });
  if (!res.ok) {
    throw new Error(`Falha na autenticação Pluggy (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as { apiKey: string };
  // Cache por 90 min (token vale ~2h)
  cachedKey = { apiKey: data.apiKey, expiresAt: Date.now() + 90 * 60 * 1000 };
  return data.apiKey;
}

export async function pluggyRequest(
  method: string,
  path: string,
  body?: unknown,
): Promise<unknown> {
  const apiKey = await authenticate();
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "X-API-KEY": apiKey,
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
    throw new Error(`Pluggy ${method} ${path} → ${res.status}: ${JSON.stringify(json)}`);
  }
  return json;
}

export function qs(params: Record<string, string | number | boolean | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== "");
  if (entries.length === 0) return "";
  return "?" + entries.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join("&");
}
