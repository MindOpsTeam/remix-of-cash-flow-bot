/**
 * contaazul-import — traz dados do Conta Azul para o FinanceAI.
 *
 * POST { action: "test", company_id }
 * POST { action: "import-cadastros", company_id }   → pessoas + produtos + serviços
 * POST { action: "import-financeiro", company_id }  → contas a receber/pagar em aberto
 *
 * Credenciais por empresa no Vault (get_contaazul_credentials). O import passa
 * SEMPRE pelos mapeadores de _shared/contaazul-map.ts (os mesmos testados no
 * vitest) e faz upsert por external_id — rodar duas vezes não duplica nada.
 * Nada aqui toca transactions: recebível/conta a pagar não entram no DRE até
 * o fluxo normal do produto (baixa, conciliação) acontecer.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";
import { authenticate, assertMembership, assertCanWrite, jsonResp } from "../_shared/auth.ts";
import {
  mapPessoa,
  mapProduto,
  mapServico,
  mapContaReceber,
  mapContaPagar,
  mapearLote,
} from "../_shared/contaazul-map.ts";

// deno-lint-ignore no-explicit-any
type Service = any;

const BASE = Deno.env.get("CONTAAZUL_API_URL") ?? "https://api-v2.contaazul.com";
const AUTH_URL = Deno.env.get("CONTAAZUL_AUTH_URL") ?? "https://auth.contaazul.com/oauth2/token";

interface Credenciais {
  client_id: string;
  client_secret: string;
  refresh_token: string;
}

async function credenciaisDaEmpresa(service: Service, companyId: string): Promise<Credenciais | null> {
  const { data } = await service.rpc("get_contaazul_credentials", { p_company_id: companyId });
  if (!data) return null;
  try {
    return JSON.parse(data) as Credenciais;
  } catch {
    return null;
  }
}

async function accessToken(service: Service, companyId: string, cred: Credenciais): Promise<string> {
  const res = await fetch(AUTH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${btoa(`${cred.client_id}:${cred.client_secret}`)}`,
    },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: cred.refresh_token }).toString(),
  });
  if (!res.ok) throw new Error(`Autenticação Conta Azul falhou (${res.status}): ${await res.text()}`);
  const data = (await res.json()) as { access_token: string; refresh_token?: string };
  if (data.refresh_token && data.refresh_token !== cred.refresh_token) {
    // Cognito pode rotacionar o refresh; sem persistir, a próxima chamada morre.
    await service.rpc("rotate_contaazul_refresh_token", {
      p_company_id: companyId,
      p_refresh_token: data.refresh_token,
    });
  }
  return data.access_token;
}

async function caGet(token: string, path: string): Promise<unknown> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  const text = await res.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  if (!res.ok) throw new Error(`Conta Azul GET ${path} → ${res.status}: ${JSON.stringify(json)}`);
  return json;
}

/** A API pagina; varre até acabar ou bater o teto (guarda de custo). */
async function caGetTodos(token: string, path: string, teto = 1000): Promise<unknown[]> {
  const itens: unknown[] = [];
  for (let pagina = 1; itens.length < teto; pagina++) {
    const sep = path.includes("?") ? "&" : "?";
    const corpo = await caGet(token, `${path}${sep}pagina=${pagina}&tamanho_pagina=100`);
    const lista = Array.isArray(corpo)
      ? corpo
      : Array.isArray((corpo as { itens?: unknown[] })?.itens)
        ? (corpo as { itens: unknown[] }).itens
        : Array.isArray((corpo as { items?: unknown[] })?.items)
          ? (corpo as { items: unknown[] }).items
          : [];
    itens.push(...lista);
    if (lista.length < 100) break;
  }
  return itens.slice(0, teto);
}

Deno.serve(async (req) => {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const { user, supabase, corsHeaders } = auth;

  const service = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action as string;
    const companyId = body.company_id as string | undefined;
    if (!companyId) return jsonResp({ error: "company_id é obrigatório" }, 400, corsHeaders);
    const forbidden = await assertMembership(supabase, user.id, companyId, corsHeaders);
    if (forbidden) return forbidden;
    const readonly = await assertCanWrite(supabase, user.id, companyId, corsHeaders);
    if (readonly) return readonly;

    // Entitlement do plano vale na edge, não só na tela.
    const { data: plano } = await service.rpc("plano_da_empresa", { p_company_id: companyId });
    if (plano && plano.contaazul === false) {
      return jsonResp({ error: "PLAN_NOT_INCLUDED", detalhe: `O plano ${plano.nome} não inclui a importação Conta Azul.` }, 402, corsHeaders);
    }

    const cred = await credenciaisDaEmpresa(service, companyId);
    if (!cred) return jsonResp({ error: "CONTAAZUL_NOT_CONFIGURED" }, 409, corsHeaders);
    const token = await accessToken(service, companyId, cred);

    if (action === "test") {
      await caGet(token, "/v1/pessoas?pagina=1&tamanho_pagina=1");
      return jsonResp({ ok: true }, 200, corsHeaders);
    }

    if (action === "import-cadastros") {
      const [pessoasRaw, produtosRaw, servicosRaw] = await Promise.all([
        caGetTodos(token, "/v1/pessoas"),
        caGetTodos(token, "/v1/produtos"),
        caGetTodos(token, "/v1/servicos").catch(() => []),
      ]);

      const pessoas = mapearLote(pessoasRaw, mapPessoa);
      const produtos = mapearLote(produtosRaw, mapProduto);
      const servicos = mapearLote(servicosRaw, mapServico);

      let contatosGravados = 0;
      for (const p of pessoas.validos) {
        const { error } = await service.from("contacts").upsert(
          {
            company_id: companyId,
            external_id: p.external_id,
            name: p.name,
            document: p.document,
            email: p.email,
            phone: p.phone,
            type: p.type,
            person_type: (p.document ?? "").length > 11 ? "pj" : "pf",
            active: true,
          },
          { onConflict: "company_id,external_id" },
        );
        if (!error) contatosGravados += 1;
      }

      let produtosGravados = 0;
      for (const pr of [...produtos.validos, ...servicos.validos]) {
        const { error } = await service.from("products").upsert(
          {
            company_id: companyId,
            external_id: pr.external_id,
            name: pr.name,
            sku: pr.sku,
            sell_price: pr.sell_price,
            cost_price: pr.cost_price,
            type: pr.type,
            active: true,
          },
          { onConflict: "company_id,external_id" },
        );
        if (!error) produtosGravados += 1;
      }

      const resultado = {
        contatos: { gravados: contatosGravados, pulados: pessoas.resumo.pulados },
        produtos: { gravados: produtosGravados, pulados: produtos.resumo.pulados + servicos.resumo.pulados },
      };
      await service
        .from("contaazul_config")
        .update({ last_import_at: new Date().toISOString(), last_import_result: resultado })
        .eq("company_id", companyId);
      return jsonResp({ ok: true, ...resultado }, 200, corsHeaders);
    }

    if (action === "import-financeiro") {
      const hoje = new Date().toISOString().slice(0, 10);
      const umAnoAtras = new Date(Date.now() - 365 * 86_400_000).toISOString().slice(0, 10);
      const [receberRaw, pagarRaw] = await Promise.all([
        caGetTodos(token, `/v1/financeiro/eventos-financeiros/contas-a-receber/buscar?data_vencimento_de=${umAnoAtras}`).catch(() => []),
        caGetTodos(token, `/v1/financeiro/eventos-financeiros/contas-a-pagar/buscar?data_vencimento_de=${umAnoAtras}`).catch(() => []),
      ]);

      const receber = mapearLote(receberRaw, mapContaReceber);
      const pagar = mapearLote(pagarRaw, mapContaPagar);

      let recebiveisGravados = 0;
      for (const r of receber.validos) {
        // Só o EM ABERTO entra: histórico recebido importado sem lançamento
        // correspondente distorceria a leitura de aging sem alimentar o DRE.
        if (r.status !== "a_receber") continue;
        const { error } = await service.from("receivables").upsert(
          {
            company_id: companyId,
            external_id: r.external_id,
            description: r.description,
            amount: r.amount,
            due_date: r.due_date,
            status: "a_receber",
            source: "contaazul",
          },
          { onConflict: "company_id,external_id" },
        );
        if (!error) recebiveisGravados += 1;
      }

      let contasGravadas = 0;
      for (const b of pagar.validos) {
        if (b.status !== "pendente") continue;
        const { error } = await service.from("bills_payable").upsert(
          {
            company_id: companyId,
            external_id: b.external_id,
            fornecedor: b.fornecedor,
            descricao: b.descricao,
            valor: b.valor,
            vencimento: b.vencimento,
            status: "pendente",
            source: "contaazul",
          },
          { onConflict: "company_id,external_id" },
        );
        if (!error) contasGravadas += 1;
      }

      const resultado = {
        recebiveis: { gravados: recebiveisGravados, pulados: receber.resumo.pulados },
        contas_a_pagar: { gravadas: contasGravadas, pulados: pagar.resumo.pulados },
        hoje,
      };
      await service
        .from("contaazul_config")
        .update({ last_import_at: new Date().toISOString(), last_import_result: resultado })
        .eq("company_id", companyId);
      return jsonResp({ ok: true, ...resultado }, 200, corsHeaders);
    }

    return jsonResp({ error: `Ação inválida: ${action}` }, 400, corsHeaders);
  } catch (err) {
    console.error("[contaazul-import] error", err);
    return jsonResp({ error: String(err) }, 500, corsHeaders);
  }
});
