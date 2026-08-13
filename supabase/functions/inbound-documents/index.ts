/**
 * inbound-documents — notas fiscais de ENTRADA (destinadas contra o CNPJ).
 *
 * Baixa as notas emitidas contra a empresa (NF-e via Focus, distribuição DF-e),
 * guarda em `inbound_documents` (idempotente por chave) e permite transformá-las
 * em contas a pagar (`bills_payable`). Fecha o lado das compras: destinadas →
 * conta a pagar → conciliação de débitos (edge reconcile-transactions).
 *
 * Segurança: JWT + membership (authenticate); escrita barra viewer (assertCanWrite).
 * O token da Focus fica no Vault (RPC get_focus_token), nunca no front.
 *
 * POST /inbound-documents { action, companyId, ... }
 *   action=sync_nfe   baixa as NF-e destinadas na Focus e faz upsert
 *   action=sync_nfse  NFS-e tomadas via Ambiente Nacional (ADN) — preparado (ver abaixo)
 *   action=to_bill    { inbound_document_id }  cria a conta a pagar
 *   action=ignore     { inbound_document_id }  marca como ignorada
 *
 * NFS-e tomadas (ADN): o Ambiente Nacional da NFS-e distribui os DF-e ao TOMADOR
 * pela API DFe, por NSU, autenticando com o certificado A1 — o mesmo do worker de
 * emissão, que já faz mTLS. Como a NFS-e não roda em edge (mTLS com A1), o puxão
 * passa pelo worker. Hoje a NFS-e tomada entra por Importar XML / OCR; o sync
 * automático via ADN é o próximo passo (slot `sync_nfse` já reservado).
 */

import { authenticate, assertCanWrite, jsonResp } from "../_shared/auth.ts";
import { corsPreflightResponse } from "../_shared/cors.ts";

const HOSTS = {
  homologacao: "https://homologacao.focusnfe.com.br/v2",
  producao: "https://api.focusnfe.com.br/v2",
} as const;

// Prazo padrão de vencimento quando a consulta resumida não traz duplicatas.
const VENCIMENTO_PADRAO_DIAS = 30;

async function callFocus(base: string, token: string, path: string, params?: Record<string, unknown>) {
  const url = new URL(base + (path.startsWith("/") ? path : `/${path}`));
  for (const [k, v] of Object.entries(params ?? {})) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  }
  const res = await fetch(url.toString(), {
    method: "GET",
    headers: { Authorization: "Basic " + btoa(`${token}:`), Accept: "application/json" },
  });
  const text = await res.text();
  let data: unknown = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text.slice(0, 2000); }
  return { ok: res.ok, status: res.status, data };
}

// Lê um campo tolerando os vários nomes que a Focus usa entre versões.
function pick(o: Record<string, unknown>, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = o[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v);
  }
  return null;
}

/** Converte número pt-BR ("1.234,56") ou já-numérico para float sem zerar (achado M5). */
function parseValorBR(s: string | null | undefined): number {
  if (s === null || s === undefined || s === "") return 0;
  let v = String(s).trim();
  if (v.includes(",")) v = v.replace(/\./g, "").replace(",", "."); // ponto é milhar
  return Number(v) || 0;
}

interface ParsedDoc {
  tipo: string;
  chave_acesso: string | null;
  numero: string | null;
  emitente_cnpj: string | null;
  emitente_nome: string | null;
  valor_total: number;
  data_emissao: string | null;
  nsu: string | null;
  manifestacao: string | null;
  xml_content: string; // JSON bruto da Focus, para auditoria/reprocesso
}

function parseNota(raw: unknown): ParsedDoc | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  // O resumo da Focus pode aninhar os dados sob nfe/nota/resumo. Achata para buscar.
  const nested = (o.nfe ?? o.nota ?? o.resumo ?? {}) as Record<string, unknown>;
  const flat: Record<string, unknown> = { ...nested, ...o };
  const emit = (flat.emitente ?? {}) as Record<string, unknown>;
  // Valor é o campo mais crítico (uma conta a pagar zerada é inútil): tenta muitos nomes.
  const valorStr = pick(flat, "valor_total", "valor_total_nota", "valor", "valor_liquido",
    "vnf", "vNF", "valor_nota", "valor_documento") ?? pick(emit, "valor_total");
  const data = pick(flat, "data_emissao", "dhEmi", "data", "data_autorizacao", "created_at");
  return {
    tipo: "nfe",
    chave_acesso: pick(flat, "chave_nfe", "chave", "chave_acesso", "chave_nota"),
    numero: pick(flat, "numero", "nnf", "nNF", "numero_nfe"),
    emitente_cnpj: pick(flat, "cnpj_emitente", "emitente_cnpj", "cnpj") ?? pick(emit, "cnpj"),
    emitente_nome: pick(flat, "nome_emitente", "razao_social_emitente", "razao_social_emit") ?? pick(emit, "nome", "razao_social", "nome_fantasia"),
    valor_total: parseValorBR(valorStr),
    data_emissao: data ? data.slice(0, 10) : null,
    nsu: pick(flat, "nsu", "ultimo_nsu", "NSU"),
    manifestacao: pick(flat, "status", "situacao_manifestacao", "manifestacao", "situacao"),
    xml_content: JSON.stringify(raw).slice(0, 20000),
  };
}

Deno.serve(async (req: Request) => {
  const pre = corsPreflightResponse(req);
  if (pre) return pre;

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return jsonResp({ error: "JSON inválido" }, 400, {}); }

  const companyId = String(body.companyId ?? "");
  if (!companyId) return jsonResp({ error: "companyId é obrigatório" }, 400, {});

  const auth = await authenticate(req, { requireCompany: companyId });
  if (auth instanceof Response) return auth;
  const { user, supabase, corsHeaders } = auth;

  const action = String(body.action ?? "");

  try {
    // ── sync_nfe: baixa as NF-e destinadas na Focus e faz upsert ──
    if (action === "sync_nfe") {
      const readonly = await assertCanWrite(supabase, user.id, companyId, corsHeaders);
      if (readonly) return readonly;

      const { data: cfg } = await supabase.from("focus_config").select("*").eq("company_id", companyId).maybeSingle();
      const ambiente = (cfg?.environment ?? "homologacao") as keyof typeof HOSTS;
      const base = HOSTS[ambiente] ?? HOSTS.homologacao;

      const { data: token, error: tokErr } = await supabase.rpc("get_focus_token", {
        p_company_id: companyId, p_environment: ambiente,
      });
      if (tokErr) return jsonResp({ error: `Falha ao ler o token: ${tokErr.message}` }, 500, corsHeaders);
      if (!token) return jsonResp({ error: "Token da Focus NFe não configurado. Configure em Integrações > Focus NFe." }, 400, corsHeaders);

      // Rota de notas recebidas (destinadas). Configurável para acompanhar mudanças da Focus.
      const path = String(body.path ?? "/nfes_recebidas");
      const call = await callFocus(base, String(token), path, (body.params as Record<string, unknown>) ?? {});
      if (!call.ok) {
        return jsonResp({ error: `Focus respondeu ${call.status}`, detalhe: call.data }, 502, corsHeaders);
      }
      const raw = call.data as unknown;
      const wrap = (raw ?? {}) as Record<string, unknown>;
      const lista = Array.isArray(raw)
        ? raw
        : ((wrap.nfes ?? wrap.notas ?? wrap.data ?? wrap.documentos ?? []) as unknown[]);
      const parsed = (Array.isArray(lista) ? lista : []).map(parseNota).filter((d): d is ParsedDoc => !!d && !!d.chave_acesso);

      // Idempotência: insere só chaves ainda não conhecidas.
      const { data: existentes } = await supabase.from("inbound_documents").select("chave_acesso").eq("company_id", companyId);
      const conhecidas = new Set((existentes ?? []).map((e: { chave_acesso: string | null }) => e.chave_acesso));
      const novos = parsed.filter((d) => !conhecidas.has(d.chave_acesso));
      if (novos.length) {
        const rows = novos.map((d) => ({ company_id: companyId, status: "pendente", ...d }));
        const { error: insErr } = await supabase.from("inbound_documents").insert(rows);
        if (insErr) return jsonResp({ error: `Falha ao salvar: ${insErr.message}` }, 500, corsHeaders);
      }
      return jsonResp({ ok: true, recebidas: parsed.length, novas: novos.length }, 200, corsHeaders);
    }

    // ── to_bill: transforma a nota de entrada em conta a pagar ──
    if (action === "to_bill") {
      const readonly = await assertCanWrite(supabase, user.id, companyId, corsHeaders);
      if (readonly) return readonly;

      const inboundId = String(body.inbound_document_id ?? "");
      if (!inboundId) return jsonResp({ error: "inbound_document_id é obrigatório" }, 400, corsHeaders);

      const { data: doc } = await supabase.from("inbound_documents").select("*").eq("id", inboundId).eq("company_id", companyId).maybeSingle();
      if (!doc) return jsonResp({ error: "Nota de entrada não encontrada" }, 404, corsHeaders);
      if (doc.bill_id) return jsonResp({ ok: true, already: true, bill_id: doc.bill_id }, 200, corsHeaders);

      // Fornecedor: reaproveita o contato pelo CNPJ, se já cadastrado.
      let contactId: string | null = null;
      if (doc.emitente_cnpj) {
        const { data: c } = await supabase.from("contacts").select("id").eq("company_id", companyId).eq("document", doc.emitente_cnpj).maybeSingle();
        contactId = c?.id ?? null;
      }

      const emissao = doc.data_emissao ? new Date(doc.data_emissao) : new Date();
      const vencPadrao = new Date(emissao.getTime() + VENCIMENTO_PADRAO_DIAS * 86400000).toISOString().slice(0, 10);
      const fornecedor = doc.emitente_nome ?? doc.emitente_cnpj ?? "Fornecedor";
      const descBase = `${String(doc.tipo).toUpperCase()} nº ${doc.numero ?? "?"}`;

      // Duplicatas do XML (quando importado): N contas a pagar nas datas reais.
      // Sem duplicatas: uma conta única em emissão+30 (comportamento anterior).
      const dups = Array.isArray(doc.duplicatas) ? (doc.duplicatas as Array<Record<string, unknown>>) : [];
      const parcelasValidas = dups
        .map((d) => ({ vencimento: (String(d.vencimento ?? "").slice(0, 10) || vencPadrao), valor: parseValorBR(String(d.valor ?? "")) }))
        .filter((d) => d.valor > 0);

      const rows = parcelasValidas.length > 0
        ? parcelasValidas.map((p, i) => ({
            company_id: companyId,
            fornecedor,
            descricao: `${descBase} — parcela ${i + 1}/${parcelasValidas.length}`,
            valor: p.valor,
            vencimento: p.vencimento,
            status: "a_vencer",
            source: "nota_fiscal",
            contact_id: contactId,
            external_id: `${doc.chave_acesso}-p${i + 1}`,
          }))
        : [{
            company_id: companyId,
            fornecedor,
            descricao: descBase,
            valor: doc.valor_total,
            vencimento: vencPadrao,
            status: "a_vencer",
            source: "nota_fiscal",
            contact_id: contactId,
            external_id: doc.chave_acesso,
          }];

      const { data: bills, error: billErr } = await supabase.from("bills_payable").insert(rows).select("id");
      if (billErr || !bills || bills.length === 0) return jsonResp({ error: `Falha ao criar conta a pagar: ${billErr?.message}` }, 500, corsHeaders);

      await supabase.from("inbound_documents").update({ bill_id: bills[0].id, status: "lancado", updated_at: new Date().toISOString() }).eq("id", doc.id);
      return jsonResp({ ok: true, bill_id: bills[0].id, parcelas: bills.length }, 200, corsHeaders);
    }

    // ── ignore: descarta a nota de entrada da lista de pendências ──
    if (action === "ignore") {
      const readonly = await assertCanWrite(supabase, user.id, companyId, corsHeaders);
      if (readonly) return readonly;
      const inboundId = String(body.inbound_document_id ?? "");
      if (!inboundId) return jsonResp({ error: "inbound_document_id é obrigatório" }, 400, corsHeaders);
      await supabase.from("inbound_documents").update({ status: "ignorado", updated_at: new Date().toISOString() }).eq("id", inboundId).eq("company_id", companyId);
      return jsonResp({ ok: true }, 200, corsHeaders);
    }

    // ── sync_nfse: NFS-e tomadas via ADN (Ambiente Nacional) — PREPARADO ──
    if (action === "sync_nfse") {
      return jsonResp({
        ok: false,
        preparado: true,
        mensagem: "A distribuição automática de NFS-e tomadas usa a API DFe do Ambiente Nacional (ADN), por NSU, com o certificado A1 do worker (mTLS). Enquanto essa via não é ligada, importe o XML da NFS-e ou use o leitor de documentos (OCR).",
      }, 200, corsHeaders);
    }

    return jsonResp({ error: `Ação desconhecida: ${action}` }, 400, corsHeaders);
  } catch (err) {
    return jsonResp({ error: err instanceof Error ? err.message : "Erro interno" }, 500, corsHeaders);
  }
});
