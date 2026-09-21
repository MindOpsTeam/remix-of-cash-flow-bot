/**
 * API pública v1 (read-only) — autenticação por chave de API da empresa.
 *
 * Header: X-API-Key: cfk_<64 hex>
 * Rotas (GET):
 *   /public-api/v1/ping
 *   /public-api/v1/transactions?from=YYYY-MM-DD&to=YYYY-MM-DD&limit=100
 *   /public-api/v1/margin            (v_company_margin — mensal consolidável)
 *   /public-api/v1/invoices?limit=100
 *   /public-api/v1/bills?status=a_vencer|vencido|pago
 *
 * Respostas seguem o envelope { success, data, error }.
 * Doc completa: docs/PUBLIC-API.md no repositório.
 *
 * Hardening 29/08/2026:
 * - `scopes` era lido da chave e ignorado: qualquer chave válida abria todas as
 *   rotas. Agora cada rota exige o escopo dela.
 * - Teto de 120 requisições por minuto por chave, e 30/min por origem enquanto
 *   a chave nem foi reconhecida (senão o teto por chave não protege contra quem
 *   está justamente tentando adivinhar uma).
 * - `from`/`to` passavam crus para o filtro; agora só passam no formato de data.
 * - CORS deixou de ser `*`: chave de API é credencial de servidor, e liberar
 *   leitura para qualquer página fazia do navegador um caminho de uso.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";
import { checarLimite, origemDaChamada } from "../_shared/limite.ts";
import {
  caminhoDaRota,
  dataValida,
  ESCOPO_DA_ROTA,
  limiteDaBusca,
  STATUS_DE_CONTA,
  temEscopo,
} from "../_shared/api-publica.ts";

const MAX_LIMIT = 500;

/** Teto por chave reconhecida: BI e planilha puxam em rajada, gente não. */
const TETO_POR_CHAVE = 120;
/** Teto por origem antes de reconhecer a chave — este é o freio do chute. */
const TETO_POR_ORIGEM = 30;
const JANELA_SEGUNDOS = 60;

/**
 * CORS fechado de propósito.
 *
 * A chave `cfk_` é credencial de servidor: a doc manda usar curl, e a tela de
 * chaves só monta o exemplo — nenhuma parte do app chama esta função do
 * navegador. Sem `Access-Control-Allow-Origin`, uma página de terceiro não lê a
 * resposta mesmo que tenha a chave.
 */
const CORS_FECHADO: Record<string, string> = {
  Vary: "Origin",
};

function json(body: unknown, status: number, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_FECHADO, ...extra, "Content-Type": "application/json" },
  });
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  // Sem preflight: navegador não é cliente desta função.
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_FECHADO });
  }

  if (req.method !== "GET") {
    return json({ success: false, data: null, error: "Somente GET na v1" }, 405);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Freio de chute: conta ANTES de saber se a chave existe. Sem isto, o teto
  // por chave protegeria só quem já acertou a chave.
  const porOrigem = await checarLimite(
    supabase,
    `public-api:origem:${origemDaChamada(req)}`,
    TETO_POR_ORIGEM,
    JANELA_SEGUNDOS,
  );
  if (porOrigem.excedeu) return porOrigem.resposta(CORS_FECHADO);

  const apiKey = req.headers.get("x-api-key") ?? "";
  if (!apiKey.startsWith("cfk_")) {
    return json({ success: false, data: null, error: "X-API-Key ausente ou inválida" }, 401);
  }

  const keyHash = await sha256Hex(apiKey);
  const { data: keyRow } = await supabase
    .from("api_keys")
    .select("id, company_id, scopes, revoked_at")
    .eq("key_hash", keyHash)
    .maybeSingle();

  if (!keyRow || keyRow.revoked_at) {
    return json({ success: false, data: null, error: "Chave inválida ou revogada" }, 401);
  }

  const porChave = await checarLimite(
    supabase,
    `public-api:chave:${keyRow.id}`,
    TETO_POR_CHAVE,
    JANELA_SEGUNDOS,
  );
  if (porChave.excedeu) return porChave.resposta(CORS_FECHADO);

  const cabecalhoTeto = {
    "X-RateLimit-Limit": String(TETO_POR_CHAVE),
    "X-RateLimit-Remaining": String(Math.max(0, TETO_POR_CHAVE - porChave.contador)),
  };

  // Telemetria de uso (best-effort)
  supabase
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", keyRow.id)
    .then(() => {});

  const companyId = keyRow.company_id as string;
  const url = new URL(req.url);
  // Path após o nome da função: /public-api/v1/<recurso>
  const path = caminhoDaRota(url.pathname);
  const limit = limiteDaBusca(url.searchParams.get("limit"), MAX_LIMIT);

  const escopoExigido = ESCOPO_DA_ROTA[path];
  if (!escopoExigido) {
    return json({ success: false, data: null, error: `Rota desconhecida: ${path}` }, 404, cabecalhoTeto);
  }
  if (!temEscopo(keyRow.scopes, escopoExigido)) {
    return json(
      {
        success: false,
        data: null,
        error: `Esta chave não tem o escopo "${escopoExigido}". Crie outra em Configurações → API pública.`,
      },
      403,
      cabecalhoTeto,
    );
  }

  try {
    if (path === "/v1/ping") {
      return json({ success: true, data: { pong: true, company_id: companyId }, error: null }, 200, cabecalhoTeto);
    }

    if (path === "/v1/transactions") {
      const from = dataValida(url.searchParams.get("from"));
      const to = dataValida(url.searchParams.get("to"));
      if (url.searchParams.get("from") && !from) {
        return json({ success: false, data: null, error: "from deve ser YYYY-MM-DD" }, 400, cabecalhoTeto);
      }
      if (url.searchParams.get("to") && !to) {
        return json({ success: false, data: null, error: "to deve ser YYYY-MM-DD" }, 400, cabecalhoTeto);
      }

      let q = supabase
        .from("transactions")
        .select("id, date, description, amount, type, status, payment_method, project, is_intercompany, created_at")
        .eq("company_id", companyId)
        .order("date", { ascending: false })
        .limit(limit);
      if (from) q = q.gte("date", from);
      if (to) q = q.lte("date", to);
      const { data, error } = await q;
      if (error) throw error;
      return json({ success: true, data, error: null }, 200, cabecalhoTeto);
    }

    /*
     * A PONTE COM O PROVA: a receita CONCILIADA do período.
     *
     * Contrato em `docs/CONTRATO-RECEITA.md`, copiado íntegro nos três
     * repositórios da casa. O Prova mede quanto o cliente gastou em anúncio e
     * não sabe quanto entrou; aqui está o que entrou de verdade.
     *
     * **Só o que foi RECEBIDO.** `status` pago e `type` revenue. O Prova já
     * tem "aprovado" pelo gateway e "ganho" pelo CRM — o que ele não tem, e
     * por isso vem buscar aqui, é a liquidação. Mandar receita prevista faria
     * o produto contar duas vezes o mesmo dinheiro em estágios diferentes.
     *
     * **Centavos inteiros.** `amount` é numeric com decimal. Já produziu, em
     * outro produto da casa, faturamento cem vezes maior — e ninguém percebe
     * por semanas, porque o número continua parecendo um número.
     *
     * **A data é a da LIQUIDAÇÃO**, não a da emissão: `reconciled_at` quando
     * existe, `date` quando não. O Prova casa venda com anúncio por janela, e
     * uma nota emitida em agosto e paga em setembro pertence a setembro.
     */
    if (path === "/v1/prova/identidade") {
      const { data } = await supabase
        .from("companies")
        .select("name")
        .eq("id", companyId)
        .maybeSingle();
      return json(
        { success: true, data: { conta: data?.name ?? null, produto: "erp" }, error: null },
        200,
        cabecalhoTeto,
      );
    }

    if (path === "/v1/prova/receita") {
      const de = dataValida(url.searchParams.get("de")) ?? dataValida(url.searchParams.get("from"));
      const ate = dataValida(url.searchParams.get("ate")) ?? dataValida(url.searchParams.get("to"));

      let q = supabase
        .from("transactions")
        .select("id, date, description, amount, type, status, reconciled_at, external_id, project")
        .eq("company_id", companyId)
        .eq("type", "revenue")
        .order("date", { ascending: false })
        .limit(limit);
      if (de) q = q.gte("date", de);
      if (ate) q = q.lte("date", ate);
      const { data, error } = await q;
      if (error) throw error;

      const eventos = (data ?? [])
        // Conciliado é o que o Prova vem buscar. Previsto ele já tem por
        // outro caminho, e somar os dois contaria o mesmo dinheiro duas vezes.
        .filter((l) => l.reconciled_at !== null || l.status === "pago" || l.status === "confirmed")
        .map((l) => {
          const n = typeof l.amount === "string" ? Number(l.amount) : l.amount;
          const centavos =
            typeof n === "number" && Number.isFinite(n) ? Math.round(n * 100) : null;
          const quando = (l.reconciled_at ?? l.date ?? "").slice(0, 10);
          return {
            origem: "erp",
            externalId: l.external_id ?? l.id,
            quando,
            // Ausência é OMITIDA, nunca zero: lançamento sem valor derrubaria
            // o ticket médio do cliente no Prova sem nada ter acontecido.
            ...(centavos === null ? {} : { valorCentavos: centavos }),
            moeda: "BRL",
            conciliado: true,
            titulo: l.description ?? null,
          };
        });

      return json({ success: true, data: { eventos }, error: null }, 200, cabecalhoTeto);
    }

    if (path === "/v1/margin") {
      const { data, error } = await supabase
        .from("v_company_margin")
        .select("month, receita, custos, despesas")
        .eq("company_id", companyId)
        .order("month", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return json({ success: true, data, error: null }, 200, cabecalhoTeto);
    }

    if (path === "/v1/invoices") {
      const { data, error } = await supabase
        .from("invoices")
        .select("id, number, series, type, status, total, issue_date, cbs_valor, ibs_valor, created_at")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return json({ success: true, data, error: null }, 200, cabecalhoTeto);
    }

    if (path === "/v1/bills") {
      let q = supabase
        .from("bills_payable")
        .select("id, fornecedor, descricao, valor, vencimento, status, approval_status, created_at")
        .eq("company_id", companyId)
        .order("vencimento", { ascending: true })
        .limit(limit);
      const status = url.searchParams.get("status");
      if (status) {
        if (!STATUS_DE_CONTA.includes(status)) {
          return json(
            { success: false, data: null, error: "status deve ser a_vencer, vencido ou pago" },
            400,
            cabecalhoTeto,
          );
        }
        q = q.eq("status", status);
      }
      const { data, error } = await q;
      if (error) throw error;
      return json({ success: true, data, error: null }, 200, cabecalhoTeto);
    }

    return json({ success: false, data: null, error: `Rota desconhecida: ${path}` }, 404, cabecalhoTeto);
  } catch (err) {
    console.error("[public-api] error", err);
    return json({ success: false, data: null, error: "Erro interno" }, 500, cabecalhoTeto);
  }
});
