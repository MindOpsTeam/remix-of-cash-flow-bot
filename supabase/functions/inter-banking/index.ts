/**
 * inter-banking — Supabase Edge Function
 *
 * Proxy seguro para a API do Banco Inter com mTLS.
 *
 * ABORDAGEM: Deno.connectTls (API estável, funciona em Deno Deploy)
 *   - Deno.createHttpClient → requer --unstable-net, BLOQUEADO em Deno Deploy
 *   - node:https com cert/key → incerto em Deno Deploy
 *   - Deno.connectTls → estável desde Deno 1.11, funciona em Deno Deploy ✅
 *
 * Referência: https://developers.inter.co/docs/
 *
 * Actions: test | balance | statement | sync
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const INTER_PROD_HOST    = "cdpj.partners.bancointer.com.br";
const INTER_SANDBOX_HOST = "cdpj-sandbox.partners.uatinter.co";

// ---------- Types ----------

interface InterConfig {
  id: string;
  company_id: string;
  bank_account_id: string | null;
  client_id: string;
  client_secret: string;
  cert_pem: string;
  key_pem: string;
  account_number: string | null;
  environment: string;
}

interface InterTransaction {
  cpmf: string;
  dataEntrada: string;
  tipoTransacao: string;
  tipoOperacao: string; // "D"=debit, "C"=credit
  valor: number;
  titulo: string;
  descricao: string;
}

// ---------- PEM normalization ----------

/**
 * Normaliza conteúdo PEM: garante headers corretos, line-breaks Unix e
 * quebra o body em linhas de 64 chars (padrão RFC 7468).
 */
function normalizePem(raw: string, type: "CERTIFICATE" | "PRIVATE KEY"): string {
  if (!raw || !raw.trim()) throw new Error(`PEM de ${type} está vazio`);

  let content = raw.trim();

  // Remove headers/footers existentes (inclusive variantes com espaços extras)
  content = content
    .replace(/-----\s*BEGIN\s+[A-Z\s]+-----/g, "")
    .replace(/-----\s*END\s+[A-Z\s]+-----/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");

  // Remove tudo que não é base64
  const b64 = content.replace(/[^A-Za-z0-9+/=]/g, "");
  if (b64.length < 10) throw new Error(`No certificates found in ${type} data — conteúdo base64 insuficiente`);

  // Reconstrói com quebras de 64 chars
  const lines: string[] = [];
  for (let i = 0; i < b64.length; i += 64) {
    lines.push(b64.slice(i, i + 64));
  }

  return `-----BEGIN ${type}-----\n${lines.join("\n")}\n-----END ${type}-----\n`;
}

// ---------- Raw HTTPS over Deno.connectTls (mTLS) ----------

/**
 * Faz uma requisição HTTPS com certificado cliente via Deno.connectTls.
 * API estável — funciona em Deno Deploy sem flags adicionais.
 */
async function tlsRequest(
  hostname: string,
  method: string,
  path: string,
  certPem: string,
  keyPem: string,
  reqHeaders: Record<string, string>,
  body?: string,
): Promise<{ status: number; data: string }> {
  const conn = await Deno.connectTls({
    hostname,
    port: 443,
    cert: certPem,       // certificado cliente (mTLS)
    key: keyPem,         // chave privada do certificado
  });

  try {
    const enc = new TextEncoder();
    const bodyBuf = body ? enc.encode(body) : undefined;

    const headers: Record<string, string> = {
      Host: hostname,
      Connection: "close",
      ...reqHeaders,
    };
    if (bodyBuf) headers["Content-Length"] = String(bodyBuf.byteLength);

    const headerBlock = Object.entries(headers).map(([k, v]) => `${k}: ${v}`).join("\r\n");
    const head = `${method} ${path} HTTP/1.1\r\n${headerBlock}\r\n\r\n`;

    await conn.write(enc.encode(head));
    if (bodyBuf) await conn.write(bodyBuf);

    // Lê resposta até a conexão fechar (Connection: close garante isso)
    const parts: Uint8Array[] = [];
    const buf = new Uint8Array(8192);
    let n: number | null;
    while ((n = await conn.read(buf)) !== null) {
      parts.push(buf.slice(0, n));
    }

    // Concatena chunks
    const total = parts.reduce((s, p) => s + p.length, 0);
    const full = new Uint8Array(total);
    let off = 0;
    for (const p of parts) { full.set(p, off); off += p.length; }

    const raw = new TextDecoder().decode(full);

    // Divide cabeçalhos e corpo
    const sep = raw.indexOf("\r\n\r\n");
    if (sep === -1) throw new Error(`Resposta HTTP inválida: ${raw.slice(0, 200)}`);

    const respHeaders = raw.slice(0, sep);
    let respBody   = raw.slice(sep + 4);

    // Status
    const statusMatch = respHeaders.match(/^HTTP\/[\d.]+\s+(\d+)/);
    const status = statusMatch ? parseInt(statusMatch[1]) : 0;

    // Decodifica chunked transfer encoding se necessário
    if (/Transfer-Encoding:\s*chunked/i.test(respHeaders)) {
      respBody = decodeChunked(respBody);
    }

    return { status, data: respBody.trim() };
  } finally {
    try { conn.close(); } catch { /* ignore */ }
  }
}

/** Decodifica HTTP chunked transfer encoding */
function decodeChunked(encoded: string): string {
  let result = "";
  let pos = 0;
  while (pos < encoded.length) {
    const lineEnd = encoded.indexOf("\r\n", pos);
    if (lineEnd === -1) break;
    const chunkSize = parseInt(encoded.slice(pos, lineEnd), 16);
    if (isNaN(chunkSize) || chunkSize === 0) break;
    pos = lineEnd + 2;
    result += encoded.slice(pos, pos + chunkSize);
    pos += chunkSize + 2; // pula CRLF após chunk
  }
  return result;
}

// ---------- Inter API helpers ----------

function interHost(environment: string) {
  return environment === "sandbox" ? INTER_SANDBOX_HOST : INTER_PROD_HOST;
}

/** GET OAuth2 token via client_credentials + mTLS */
async function getToken(config: InterConfig, scope: string): Promise<string> {
  const params = new URLSearchParams({
    client_id: config.client_id,
    client_secret: config.client_secret,
    grant_type: "client_credentials",
    scope,
  });
  const body = params.toString();

  const res = await tlsRequest(
    interHost(config.environment),
    "POST",
    "/oauth/v2/token",
    config.cert_pem,
    config.key_pem,
    { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  );

  if (res.status !== 200) {
    throw new Error(`OAuth2 falhou (${res.status}): ${res.data}`);
  }

  const json = JSON.parse(res.data) as { access_token: string };
  return json.access_token;
}

function apiHeaders(token: string, accountNumber?: string | null): Record<string, string> {
  const h: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  if (accountNumber) h["x-conta-corrente"] = accountNumber;
  return h;
}

/** GET /banking/v2/saldo */
async function fetchBalance(config: InterConfig, token: string): Promise<Record<string, unknown>> {
  const today = new Date().toISOString().slice(0, 10);
  const res = await tlsRequest(
    interHost(config.environment),
    "GET",
    `/banking/v2/saldo?dataSaldo=${today}`,
    config.cert_pem,
    config.key_pem,
    apiHeaders(token, config.account_number),
  );
  if (res.status !== 200) throw new Error(`Saldo falhou (${res.status}): ${res.data}`);
  return JSON.parse(res.data) as Record<string, unknown>;
}

/** GET /banking/v2/extrato — max 90 dias */
async function fetchStatement(
  config: InterConfig,
  token: string,
  startDate: string,
  endDate: string,
): Promise<InterTransaction[]> {
  const res = await tlsRequest(
    interHost(config.environment),
    "GET",
    `/banking/v2/extrato?dataInicio=${startDate}&dataFim=${endDate}`,
    config.cert_pem,
    config.key_pem,
    apiHeaders(token, config.account_number),
  );
  if (res.status !== 200) throw new Error(`Extrato falhou (${res.status}): ${res.data}`);
  const data = JSON.parse(res.data) as { transacoes?: InterTransaction[] };
  return data.transacoes ?? [];
}

// ---------- Main handler ----------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResp({ error: "Não autenticado" }, 401);

    // Supabase service role (lê/escreve sem RLS)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Verifica JWT do usuário
    const { data: { user }, error: userErr } = await createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    ).auth.getUser();

    if (userErr || !user) return jsonResp({ error: "Não autenticado" }, 401);

    const body = await req.json();
    const { action, company_id, start_date, end_date } = body;
    if (!company_id) return jsonResp({ error: "company_id obrigatório" }, 400);

    // Membership check — sem isso qualquer user autenticado lia saldo/extrato
    // Inter de qualquer empresa cujo UUID conhecesse.
    const { data: membership } = await supabase
      .from("company_members")
      .select("company_id")
      .eq("company_id", company_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!membership) return jsonResp({ error: "Forbidden" }, 403);

    // Carrega config Inter da empresa
    const { data: cfg, error: cfgErr } = await supabase
      .from("inter_config")
      .select("*")
      .eq("company_id", company_id)
      .single();

    if (cfgErr || !cfg) return jsonResp({ error: "Integração Inter não configurada" }, 404);
    if (!cfg.active) return jsonResp({ error: "Integração Inter desativada" }, 400);
    const config = cfg as InterConfig;

    // Normaliza PEMs antes de qualquer uso
    try {
      config.cert_pem = normalizePem(config.cert_pem, "CERTIFICATE");
      config.key_pem = normalizePem(config.key_pem, "PRIVATE KEY");
    } catch (pemErr) {
      const msg = pemErr instanceof Error ? pemErr.message : String(pemErr);
      console.error("[inter-banking]", msg);
      return jsonResp({ error: msg }, 400);
    }

    // ---- test ----
    if (action === "test") {
      const token = await getToken(config, "extrato.read");
      const balance = await fetchBalance(config, token);
      return jsonResp({ ok: true, disponivel: balance.disponivel });
    }

    // ---- balance ----
    if (action === "balance") {
      const token = await getToken(config, "extrato.read");
      const balance = await fetchBalance(config, token);
      await supabase.from("inter_config").update({
        last_balance: balance.disponivel,
        last_balance_at: new Date().toISOString(),
      }).eq("id", config.id);
      return jsonResp(balance);
    }

    // ---- statement ----
    if (action === "statement") {
      if (!start_date || !end_date) return jsonResp({ error: "start_date e end_date obrigatórios" }, 400);
      const token = await getToken(config, "extrato.read");
      const transactions = await fetchStatement(config, token, start_date, end_date);
      return jsonResp({ transactions });
    }

    // ---- sync ----
    if (action === "sync") {
      if (!start_date || !end_date) return jsonResp({ error: "start_date e end_date obrigatórios" }, 400);

      const token = await getToken(config, "extrato.read");
      const interTxs = await fetchStatement(config, token, start_date, end_date);

      if (interTxs.length === 0) {
        await supabase.from("inter_config").update({ last_sync_at: new Date().toISOString() }).eq("id", config.id);
        return jsonResp({ synced: 0, skipped: 0, total: 0 });
      }

      // Reconcile each Inter transaction via reconcile-transactions function
      let synced = 0;
      let reconciled = 0;
      let skipped = 0;

      for (const tx of interTxs) {
        const externalId = tx.cpmf || `${tx.dataEntrada}|${tx.valor}|${tx.tipoTransacao}|${tx.tipoOperacao}`;
        const description = [tx.titulo, tx.descricao].filter(Boolean).join(" — ").trim() || "Transação Inter";

        const { data: result, error: recErr } = await supabase.functions.invoke("reconcile-transactions", {
          headers: { Authorization: authHeader },
          body: {
            action: "reconcile_pj",
            company_id,
            amount: tx.valor,
            date: tx.dataEntrada,
            type: tx.tipoOperacao === "C" ? "revenue" : "expense",
            description,
            source: "inter",
            external_id: externalId,
            bank_account_id: config.bank_account_id ?? null,
            payment_method: tx.tipoTransacao ?? null,
          },
        });

        if (recErr) {
          console.error("Reconcile error:", recErr);
          continue;
        }

        if (result?.action === "inserted") synced++;
        else if (result?.action === "reconciled") reconciled++;
        else if (result?.action === "skipped") skipped++;
      }

      await supabase.from("inter_config")
        .update({ last_sync_at: new Date().toISOString() })
        .eq("id", config.id);

      return jsonResp({ synced, reconciled, skipped, total: interTxs.length });
    }

    return jsonResp({ error: `Ação desconhecida: ${action}` }, 400);

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[inter-banking]", message);
    return jsonResp({ error: message }, 500);
  }
});

function jsonResp(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}
