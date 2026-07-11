/**
 * Cliente REST da Belvo. Auth por HTTP Basic (secretId:secretPassword) em toda
 * chamada. Base: sandbox por padrão; produção via BELVO_ENV=production ou
 * BELVO_API_URL explícito.
 */

function baseUrl(): string {
  if (process.env.BELVO_API_URL) return process.env.BELVO_API_URL.replace(/\/$/, "");
  const env = (process.env.BELVO_ENV ?? "sandbox").toLowerCase();
  return env === "production" ? "https://api.belvo.com" : "https://sandbox.belvo.com";
}

function authHeader(): string {
  const id = process.env.BELVO_SECRET_ID;
  const pw = process.env.BELVO_SECRET_PASSWORD;
  if (!id || !pw) {
    throw new Error(
      "BELVO_SECRET_ID e BELVO_SECRET_PASSWORD são obrigatórios (crie em dashboard.belvo.com).",
    );
  }
  return "Basic " + Buffer.from(`${id}:${pw}`).toString("base64");
}

export async function belvoRequest(
  method: string,
  path: string,
  body?: unknown,
): Promise<unknown> {
  const res = await fetch(`${baseUrl()}${path}`, {
    method,
    headers: {
      Authorization: authHeader(),
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
    throw new Error(`Belvo ${method} ${path} → ${res.status}: ${JSON.stringify(json)}`);
  }
  return json;
}

export function qs(params: Record<string, string | number | boolean | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== "");
  if (entries.length === 0) return "";
  return "?" + entries.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join("&");
}
