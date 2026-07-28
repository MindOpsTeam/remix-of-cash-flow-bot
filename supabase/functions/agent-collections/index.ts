/**
 * Agente de Cobrança.
 *
 * Monta ações pendentes em `agent_actions` com a mensagem rascunhada por IA.
 * NUNCA envia nada sozinho: quem aprova é o humano, na tela /agents.
 *
 * Por que este arquivo foi reescrito: ele lia SOMENTE `company_asaas_payments`,
 * tabela com zero linhas em produção, e a varredura por cron só passava por
 * empresas com Asaas configurado. Para quem não usa Asaas, que é quase todo
 * mundo, o agente era mudo POR CONSTRUÇÃO. `agent_actions` tinha zero linhas e
 * não havia bug de tela nenhum: ele nunca teve o que cobrar.
 *
 * Agora a fonte principal é `receivables`, que é onde o contas a receber do
 * produto vive, e o Asaas entra como fonte adicional para quem o usa.
 *
 * Divisão de trabalho, igual ao resto da casa:
 *   - QUANDO falar é decisão determinística, da régua da empresa
 *     (`momentoDaCobranca`). O modelo não escolhe dia nem valor.
 *   - O QUE escrever é do modelo, com o tom que a empresa configurou.
 *   - Sem chave de IA, a mensagem cai num texto de reserva e o agente continua
 *     funcionando. Cobrança não pode depender de modelo estar de pé.
 *
 * POST /agent-collections
 *  - Cron: header X-Cron-Secret (varre todas as empresas com o agente ligado)
 *  - Sob demanda: Bearer JWT + { company_id }
 */

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";
import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";
import { authenticate, assertMembership, jsonResp } from "../_shared/auth.ts";
import { lerRegras, momentoDaCobranca, type RegraCobranca } from "../_shared/agentes.ts";
import { chamarModelo, registrarUso } from "../_shared/ia.ts";

/** Um vencimento a cobrar, já normalizado, venha de onde vier. */
interface Cobranca {
  chave: string;
  descricao: string;
  valor: number;
  vencimento: string;
  contatoNome: string | null;
  contatoWhatsapp: string | null;
  linkPagamento: string | null;
  origem: "receivable" | "asaas";
  refId: string;
}

const TOM_INSTRUCAO: Record<RegraCobranca["tom"], string> = {
  cordial: "Cordial e próximo, sem ser íntimo. Uma pitada de gentileza.",
  direto: "Direto e objetivo. Sem rodeio, sem desculpa, sem emoji.",
  formal: "Formal e institucional. Trate por senhor ou senhora, sem gíria.",
};

function diasEntre(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / 86_400_000);
}

function brl(v: number): string {
  return `R$ ${Number(v).toFixed(2).replace(".", ",")}`;
}

function textoDeReserva(
  empresa: string,
  c: Cobranca,
  estagio: "lembrete" | "vencendo" | "atraso",
  diasAtraso: number,
): string {
  const situacao =
    estagio === "atraso"
      ? `está em aberto há ${diasAtraso} dia(s)`
      : estagio === "vencendo"
        ? "vence hoje"
        : "vence em breve";
  const link = c.linkPagamento ? ` Link para pagamento: ${c.linkPagamento}.` : "";
  return (
    `Olá! Aqui é da ${empresa}. A cobrança de ${brl(c.valor)} referente a ` +
    `${c.descricao} ${situacao}.${link} Qualquer dúvida, estamos à disposição.`
  );
}

/**
 * Escreve a mensagem. O modelo recebe os números prontos e só redige em volta:
 * ele nunca calcula valor, dia nem juros.
 */
async function redigir(
  apiKey: string | undefined,
  supabase: SupabaseClient,
  companyId: string,
  empresa: string,
  c: Cobranca,
  estagio: "lembrete" | "vencendo" | "atraso",
  diasAtraso: number,
  regra: RegraCobranca,
): Promise<string> {
  const reserva = textoDeReserva(empresa, c, estagio, diasAtraso);
  if (!apiKey) return reserva;

  const situacao =
    estagio === "atraso"
      ? `em aberto há ${diasAtraso} dia(s)`
      : estagio === "vencendo"
        ? "vencendo hoje"
        : `vencendo em ${diasEntre(new Date(`${c.vencimento}T00:00:00`), new Date())} dia(s)`;

  const r = await chamarModelo<{ mensagem: string }>(
    apiKey,
    [
      {
        role: "system",
        content:
          `Você redige mensagens curtas de cobrança para WhatsApp, em português do Brasil, ` +
          `em nome da empresa ${empresa}. Tom: ${TOM_INSTRUCAO[regra.tom]} ` +
          `Máximo 4 linhas. Use EXATAMENTE os valores e prazos informados, nunca invente número, ` +
          `não calcule juros nem multa, não ameace. ` +
          (regra.assinatura ? `Assine como "${regra.assinatura}".` : `Assine como ${empresa}.`),
      },
      {
        role: "user",
        content:
          `Cliente: ${c.contatoNome ?? "cliente"}\n` +
          `Referente a: ${c.descricao}\n` +
          `Valor: ${brl(c.valor)}\n` +
          `Situação: ${situacao}\n` +
          (c.linkPagamento ? `Link de pagamento: ${c.linkPagamento}\n` : ""),
      },
    ],
    {
      modelo: "google/gemini-2.5-flash-lite",
      maxTokens: 900,
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["mensagem"],
        properties: { mensagem: { type: "string" } },
      },
    },
  );

  await registrarUso(supabase, companyId, "agent-collections", r);
  const texto = r.dados?.mensagem?.trim();
  return texto && texto.length > 20 ? texto : reserva;
}

async function coletarCobrancas(
  supabase: SupabaseClient,
  companyId: string,
): Promise<Cobranca[]> {
  const [recRes, asaasRes] = await Promise.all([
    supabase
      .from("receivables")
      .select("id, description, amount, due_date, contact_id, boleto_url, pix_url, contacts(name, whatsapp, phone)")
      .eq("company_id", companyId)
      .in("status", ["a_receber", "vencido"]),
    supabase
      .from("company_asaas_payments")
      .select("id, asaas_id, customer_id, value, description, due_date, invoice_url, payment_link")
      .eq("company_id", companyId)
      .in("status", ["PENDING", "OVERDUE"]),
  ]);

  const cobrancas: Cobranca[] = [];

  for (const r of (recRes.data ?? []) as Array<Record<string, unknown>>) {
    const contato = (r.contacts ?? null) as { name?: string; whatsapp?: string; phone?: string } | null;
    cobrancas.push({
      chave: `collections:receivable:${r.id}`,
      descricao: String(r.description ?? "cobrança"),
      valor: Number(r.amount ?? 0),
      vencimento: String(r.due_date),
      contatoNome: contato?.name ?? null,
      // O conselho apontou que contact_whatsapp nunca era preenchido e a tela
      // montava um link wa.me vazio. A origem do telefone é o contato ligado ao
      // recebível, e agora ela é lida de verdade.
      contatoWhatsapp: contato?.whatsapp ?? contato?.phone ?? null,
      linkPagamento: (r.boleto_url as string) ?? (r.pix_url as string) ?? null,
      origem: "receivable",
      refId: String(r.id),
    });
  }

  for (const p of (asaasRes.data ?? []) as Array<Record<string, unknown>>) {
    cobrancas.push({
      chave: `collections:asaas:${p.asaas_id}:${p.due_date}`,
      descricao: String(p.description ?? "serviços"),
      valor: Number(p.value ?? 0),
      vencimento: String(p.due_date),
      contatoNome: null,
      contatoWhatsapp: null,
      linkPagamento: (p.invoice_url as string) ?? (p.payment_link as string) ?? null,
      origem: "asaas",
      refId: String(p.id),
    });
  }

  return cobrancas;
}

async function varrerEmpresa(
  supabase: SupabaseClient,
  apiKey: string | undefined,
  companyId: string,
): Promise<{ criadas: number; ja_existiam: number; fora_da_regua: number; desligado?: boolean }> {
  const regras = await lerRegras(() =>
    supabase.from("agent_rules").select("agent, ativo, config").eq("company_id", companyId));
  if (!regras.ativo.collections) {
    return { criadas: 0, ja_existiam: 0, fora_da_regua: 0, desligado: true };
  }

  const { data: empresa } = await supabase
    .from("companies").select("name").eq("id", companyId).maybeSingle();
  const nomeEmpresa = (empresa?.name as string) ?? "sua empresa";

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  let criadas = 0;
  let jaExistiam = 0;
  let foraDaRegua = 0;

  for (const c of await coletarCobrancas(supabase, companyId)) {
    if (c.valor < regras.cobranca.valor_minimo) { foraDaRegua++; continue; }

    const diasAteVencer = diasEntre(new Date(`${c.vencimento}T00:00:00`), hoje);
    const momento = momentoDaCobranca(diasAteVencer, regras.cobranca);
    if (!momento) { foraDaRegua++; continue; }

    // A chave inclui o estágio: lembrete, vencimento e cada marco de atraso são
    // conversas diferentes sobre o mesmo título, e o cliente deve ver as três.
    const dedupeKey = `${c.chave}:${momento.estagio}:${momento.diasAtraso}`;
    const { data: existente } = await supabase
      .from("agent_actions").select("id").eq("company_id", companyId).eq("dedupe_key", dedupeKey).maybeSingle();
    if (existente) { jaExistiam++; continue; }

    const mensagem = await redigir(
      apiKey, supabase, companyId, nomeEmpresa, c, momento.estagio, momento.diasAtraso, regras.cobranca,
    );

    const titulo =
      momento.estagio === "atraso"
        ? `Cobrar ${brl(c.valor)} em atraso há ${momento.diasAtraso} dia(s)`
        : momento.estagio === "vencendo"
          ? `Cobrança de ${brl(c.valor)} vence hoje`
          : `Lembrar vencimento de ${brl(c.valor)} em ${regras.cobranca.dias_antes} dia(s)`;

    const { error } = await supabase.from("agent_actions").insert({
      company_id: companyId,
      agent: "collections",
      action_type: momento.estagio === "atraso" ? "cobranca_atraso" : "cobranca_lembrete",
      title: titulo,
      description: `${c.contatoNome ?? "Cliente"} — ${c.descricao}`,
      suggested_message: mensagem,
      amount: c.valor,
      due_date: c.vencimento,
      contact_name: c.contatoNome,
      contact_whatsapp: c.contatoWhatsapp,
      status: "pending",
      dedupe_key: dedupeKey,
      payload: {
        origem: c.origem,
        ref_id: c.refId,
        estagio: momento.estagio,
        dias_atraso: momento.diasAtraso,
      },
    });

    if (error) jaExistiam++; else criadas++;
  }

  return { criadas, ja_existiam: jaExistiam, fora_da_regua: foraDaRegua };
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const preflight = corsPreflightResponse(req);
  if (preflight) return preflight;

  const service = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const apiKey = Deno.env.get("LOVABLE_API_KEY");

  const cronSecret = Deno.env.get("CRON_SECRET");
  if (cronSecret && req.headers.get("x-cron-secret") === cronSecret) {
    try {
      // Antes a varredura passava só por empresas com Asaas configurado, o que
      // sozinho já garantia zero ação para quase todo mundo. Agora passa por
      // quem tem recebível em aberto, que é a condição que importa.
      const { data: comReceber } = await service
        .from("receivables").select("company_id").in("status", ["a_receber", "vencido"]);
      const { data: comAsaas } = await service
        .from("company_asaas_config").select("company_id");

      const empresas = [...new Set([
        ...(comReceber ?? []).map((r: { company_id: string }) => r.company_id),
        ...(comAsaas ?? []).map((r: { company_id: string }) => r.company_id),
      ])];

      const resultados: Record<string, unknown> = {};
      for (const id of empresas) resultados[id] = await varrerEmpresa(service, apiKey, id);

      return new Response(JSON.stringify({ ok: true, empresas: empresas.length, resultados }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (err) {
      console.error("[agent-collections] cron error", err);
      return new Response(JSON.stringify({ error: String(err) }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;

  try {
    const body = await req.json().catch(() => ({}));
    const companyId = (body as { company_id?: string }).company_id;
    if (!companyId) return jsonResp({ error: "company_id é obrigatório" }, 400, corsHeaders);

    const forbidden = await assertMembership(auth.supabase, auth.user.id, companyId, corsHeaders);
    if (forbidden) return forbidden;

    return jsonResp({ ok: true, ...(await varrerEmpresa(service, apiKey, companyId)) }, 200, corsHeaders);
  } catch (err) {
    console.error("[agent-collections] error", err);
    return jsonResp({ error: String(err) }, 500, corsHeaders);
  }
});
