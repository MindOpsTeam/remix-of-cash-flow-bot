/**
 * inter-banking — Supabase Edge Function
 *
 * Proxy seguro para a API do Banco Inter (OAuth2 + mTLS).
 *
 * IMPORTANTE: Deno.createHttpClient NÃO funciona em Deno Deploy (Supabase).
 * Solução: usar `node:https` com suporte nativo a certificado cliente (cert + key).
 *
 * Referência: https://developers.inter.co/docs/
 *
 * Actions:
 *   test      — testa conexão OAuth2 + mTLS e retorna saldo
 *   balance   — retorna e persiste saldo atual
 *   statement — retorna extrato de um período (raw)
 *   sync      — sincroniza extrato → tabela `transactions`
 */

// @ts-types="npm:@types/node"
import https from "node:https";
import { Buffer } from "node:buffer";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
  cert_pem: string;    // PEM certificate chain
  key_pem: string;     // PEM private key (no passphrase)
  account_number: string | null;
  environment: string; // "production" | "sandbox"
}

interface InterTransaction {
  cpmf: string;
  dataEntrada: string;
  tipoTransacao: string;
  tipoOperacao: string; // "D" = débito/despesa, "C" = crédito/receita
  valor: number;
  titulo: string;
  descricao: string;
}

// ---------- node:https mTLS helper ----------

/**
 * Faz uma requisição HTTPS com certificado cliente (mTLS).
 * Suportado em Deno Deploy via node:https.
 */
function mTLSRequest(
  hostname: string,
  method: string,
  path: string,
  cert: string,
  key: string,
  headers: Record<string, string | number>,
  body?: string,
): Promise<{ status: number; json: () => unknown }> {
  return new Promise((resolve, reject) => {
    const bodyBuf = body ? Buffer.from(body, "utf-8") : undefined;

    const req = https.request(
      {
        hostname,
        port: 443,
        path,
        method,
        cert,
        key,
        headers: {
          ...headers,
          ...(bodyBuf ? { "Content-Length": bodyBuf.length } : {}),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf-8");
          resolve({
            status: res.statusCode ?? 0,
            json: () => JSON.parse(text),
          });
        });
      },
    );

    req.on("error", reject);
    if (bodyBuf) req.write(bodyBuf);
    req.end();
  });
}

// ---------- Inter API helpers ----------

function host(environment: string) {
  return environment === "sandbox" ? INTER_SANDBOX_HOST : INTER_PROD_HOST;
}

/** OAuth2 client_credentials com mTLS */
async function getToken(config: InterConfig, scope: string): Promise<string> {
  const params = new URLSearchParams({
    client_id: config.client_id,
    client_secret: config.client_secret,
    grant_type: "client_credentials",
    scope,
  });
  const body = params.toString();

  const res = await mTLSRequest(
    host(config.environment),
    "POST",
    "/oauth/v2/token",
    config.cert_pem,
    config.key_pem,
    { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  );

  if (res.status !== 200) {
    throw new Error(`OAuth2 falhou (${res.status}): ${JSON.stringify(res.json())}`);
  }

  const data = res.json() as { access_token: string };
  return data.access_token;
}

/** Cabeçalhos comuns para chamadas autenticadas */
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
  const res = await mTLSRequest(
    host(config.environment),
    "GET",
    `/banking/v2/saldo?dataSaldo=${today}`,
    config.cert_pem,
    config.key_pem,
    apiHeaders(token, config.account_number),
  );
  if (res.status !== 200) throw new Error(`Saldo falhou (${res.status}): ${JSON.stringify(res.json())}`);
  return res.json() as Record<string, unknown>;
}

/** GET /banking/v2/extrato */
async function fetchStatement(
  config: InterConfig,
  token: string,
  startDate: string,
  endDate: string,
): Promise<InterTransaction[]> {
  const res = await mTLSRequest(
    host(config.environment),
    "GET",
    `/banking/v2/extrato?dataInicio=${startDate}&dataFim=${endDate}`,
    config.cert_pem,
    config.key_pem,
    apiHeaders(token, config.account_number),
  );
  if (res.status !== 200) throw new Error(`Extrato falhou (${res.status}): ${JSON.stringify(res.json())}`);
  const data = res.json() as { transacoes?: InterTransaction[] };
  return data.transacoes ?? [];
}

// ---------- Main ----------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResp({ error: "Não autenticado" }, 401);

    // Supabase service-role client (para ler/escrever sem RLS)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Verifica o JWT do usuário
    const { data: { user }, error: userErr } = await createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    ).auth.getUser();

    if (userErr || !user) return jsonResp({ error: "Não autenticado" }, 401);

    const body = await req.json();
    const { action, company_id, start_date, end_date } = body;
    if (!company_id) return jsonResp({ error: "company_id obrigatório" }, 400);

    // Carrega configuração Inter
    const { data: cfg, error: cfgErr } = await supabase
      .from("inter_config")
      .select("*")
      .eq("company_id", company_id)
      .single();

    if (cfgErr || !cfg) return jsonResp({ error: "Integração Inter não configurada" }, 404);
    if (!cfg.active) return jsonResp({ error: "Integração Inter desativada" }, 400);
    const config = cfg as InterConfig;

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

      // Mapeia Inter → nossa tabela transactions
      const rows = interTxs.map((tx) => ({
        company_id,
        user_id: user.id,
        bank_account_id: config.bank_account_id ?? null,
        date: tx.dataEntrada,
        amount: tx.valor,
        description: [tx.titulo, tx.descricao].filter(Boolean).join(" — ").trim() || "Transação Inter",
        type: tx.tipoOperacao === "C" ? "income" : "expense",
        payment_method: tx.tipoTransacao ?? null,
        status: "completed",
        source: "inter",
        // cpmf é o ID único da transação Inter; fallback para hash composto
        external_id: tx.cpmf || `${tx.dataEntrada}|${tx.valor}|${tx.tipoTransacao}|${tx.tipoOperacao}`,
      }));

      // Upsert — ignora duplicatas por (company_id, source, external_id)
      const { data: inserted, error: insertErr } = await supabase
        .from("transactions")
        .upsert(rows, { onConflict: "company_id,source,external_id", ignoreDuplicates: true })
        .select("id");

      if (insertErr) throw new Error(`Sync falhou: ${insertErr.message}`);

      await supabase.from("inter_config")
        .update({ last_sync_at: new Date().toISOString() })
        .eq("id", config.id);

      const synced = inserted?.length ?? 0;
      return jsonResp({ synced, total: rows.length, skipped: rows.length - synced });
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
