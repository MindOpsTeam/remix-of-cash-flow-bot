/**
 * inter-banking — Supabase Edge Function
 *
 * Proxy seguro para a API do Banco Inter (OAuth2 + mTLS).
 * Requer certificado PEM + chave PEM armazenados em `inter_config`.
 *
 * Actions:
 *   test       — testa conexão OAuth2 + mTLS
 *   balance    — retorna saldo atual
 *   statement  — retorna extrato de um período (max 90 dias)
 *   sync       — sincroniza extrato → tabela `transactions`
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const INTER_PROD = "https://cdpj.partners.bancointer.com.br";
const INTER_SANDBOX = "https://cdpj-sandbox.partners.uatinter.co";

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
  tipoOperacao: string; // D = debit/despesa, C = credit/receita
  valor: number;
  titulo: string;
  descricao: string;
}

// ---------- Inter API helpers ----------

function baseUrl(env: string) {
  return env === "sandbox" ? INTER_SANDBOX : INTER_PROD;
}

/** Cria cliente HTTP com mTLS usando certificado e chave PEM */
function makeTLSClient(certPem: string, keyPem: string) {
  // Deno.createHttpClient com mTLS — requer Deno 1.30+
  return (Deno as unknown as {
    createHttpClient: (opts: { certChain: string; privateKey: string }) => unknown;
  }).createHttpClient({
    certChain: certPem,
    privateKey: keyPem,
  });
}

/** Obtém token OAuth2 via client_credentials + mTLS */
async function getToken(
  config: InterConfig,
  scope: string,
): Promise<string> {
  const client = makeTLSClient(config.cert_pem, config.key_pem);
  const params = new URLSearchParams({
    client_id: config.client_id,
    client_secret: config.client_secret,
    grant_type: "client_credentials",
    scope,
  });

  const res = await fetch(`${baseUrl(config.environment)}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
    // @ts-ignore — Deno-specific fetch option
    client,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OAuth2 falhou (${res.status}): ${err}`);
  }

  const data = await res.json();
  // @ts-ignore
  client.close?.();
  return data.access_token as string;
}

/** Cabeçalhos comuns para chamadas autenticadas */
function authHeaders(token: string, accountNumber?: string | null) {
  const h: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  if (accountNumber) h["x-conta-corrente"] = accountNumber;
  return h;
}

/** GET saldo */
async function fetchBalance(config: InterConfig, token: string) {
  const client = makeTLSClient(config.cert_pem, config.key_pem);
  const today = new Date().toISOString().slice(0, 10);
  const res = await fetch(
    `${baseUrl(config.environment)}/banking/v2/saldo?dataSaldo=${today}`,
    {
      headers: authHeaders(token, config.account_number),
      // @ts-ignore
      client,
    },
  );
  // @ts-ignore
  client.close?.();
  if (!res.ok) throw new Error(`Saldo falhou (${res.status}): ${await res.text()}`);
  return await res.json();
}

/** GET extrato básico (max 90 dias) */
async function fetchStatement(
  config: InterConfig,
  token: string,
  startDate: string,
  endDate: string,
): Promise<InterTransaction[]> {
  const client = makeTLSClient(config.cert_pem, config.key_pem);
  const url = `${baseUrl(config.environment)}/banking/v2/extrato?dataInicio=${startDate}&dataFim=${endDate}`;
  const res = await fetch(url, {
    headers: authHeaders(token, config.account_number),
    // @ts-ignore
    client,
  });
  // @ts-ignore
  client.close?.();
  if (!res.ok) throw new Error(`Extrato falhou (${res.status}): ${await res.text()}`);
  const data = await res.json();
  return (data.transacoes ?? []) as InterTransaction[];
}

// ---------- Main handler ----------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  try {
    // Auth — JWT do usuário
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autenticado" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Verifica usuário via JWT
    const { data: { user }, error: userErr } = await createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    ).auth.getUser();

    if (userErr || !user) return json({ error: "Não autenticado" }, 401);

    const body = await req.json();
    const { action, company_id, start_date, end_date } = body;

    if (!company_id) return json({ error: "company_id obrigatório" }, 400);

    // Carrega configuração Inter da empresa
    const { data: cfg, error: cfgErr } = await supabase
      .from("inter_config")
      .select("*")
      .eq("company_id", company_id)
      .single();

    if (cfgErr || !cfg) return json({ error: "Integração Inter não configurada" }, 404);
    if (!cfg.active) return json({ error: "Integração Inter desativada" }, 400);

    const config = cfg as InterConfig;

    // ---- ACTION: test ----
    if (action === "test") {
      const token = await getToken(config, "extrato.read");
      const balance = await fetchBalance(config, token);
      return json({ ok: true, disponivel: balance.disponivel });
    }

    // ---- ACTION: balance ----
    if (action === "balance") {
      const token = await getToken(config, "extrato.read");
      const balance = await fetchBalance(config, token);

      // Persiste último saldo
      await supabase
        .from("inter_config")
        .update({ last_balance: balance.disponivel, last_balance_at: new Date().toISOString() })
        .eq("id", config.id);

      return json(balance);
    }

    // ---- ACTION: statement ----
    if (action === "statement") {
      if (!start_date || !end_date) return json({ error: "start_date e end_date obrigatórios" }, 400);
      const token = await getToken(config, "extrato.read");
      const transactions = await fetchStatement(config, token, start_date, end_date);
      return json({ transactions });
    }

    // ---- ACTION: sync ----
    if (action === "sync") {
      if (!start_date || !end_date) return json({ error: "start_date e end_date obrigatórios" }, 400);

      const token = await getToken(config, "extrato.read");
      const interTxs = await fetchStatement(config, token, start_date, end_date);

      if (interTxs.length === 0) {
        await supabase.from("inter_config").update({ last_sync_at: new Date().toISOString() }).eq("id", config.id);
        return json({ synced: 0, skipped: 0 });
      }

      // Mapeia Inter → transactions locais
      const rows = interTxs.map((tx) => ({
        company_id,
        user_id: user.id,
        bank_account_id: config.bank_account_id ?? null,
        date: tx.dataEntrada,
        amount: tx.valor,
        description: [tx.titulo, tx.descricao].filter(Boolean).join(" — "),
        type: tx.tipoOperacao === "C" ? "income" : "expense",
        payment_method: tx.tipoTransacao ?? null,
        status: "completed",
        source: "inter",
        external_id: tx.cpmf || `${tx.dataEntrada}_${tx.valor}_${tx.tipoTransacao}_${tx.tipoOperacao}`,
      }));

      // Upsert por (company_id, source, external_id)
      const { data: inserted, error: insertErr } = await supabase
        .from("transactions")
        .upsert(rows, {
          onConflict: "company_id,source,external_id",
          ignoreDuplicates: true,
        })
        .select("id");

      if (insertErr) throw new Error(`Sync falhou: ${insertErr.message}`);

      // Atualiza last_sync_at
      await supabase.from("inter_config")
        .update({ last_sync_at: new Date().toISOString() })
        .eq("id", config.id);

      return json({
        synced: inserted?.length ?? 0,
        total: rows.length,
        skipped: rows.length - (inserted?.length ?? 0),
      });
    }

    return json({ error: `Ação desconhecida: ${action}` }, 400);

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: message }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}
