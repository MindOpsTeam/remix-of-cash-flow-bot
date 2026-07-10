/**
 * Agente de Cobrança — varre cobranças Asaas vencidas/a vencer e cria ações
 * pendentes em agent_actions com mensagem rascunhada por IA. NUNCA envia nada
 * sozinho: humano aprova na UI (/agents) ou pelo WhatsApp.
 *
 * POST /agent-collections
 *  - Cron: header X-Cron-Secret (varre todas as empresas com config Asaas ativa)
 *  - On-demand: Bearer JWT + { company_id } (varre só a empresa do usuário)
 */

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";
import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";
import { authenticate, assertMembership, jsonResp } from "../_shared/auth.ts";

const DIAS_ANTECEDENCIA = 3;

interface PaymentRow {
  id: string;
  company_id: string;
  asaas_id: string;
  customer_id: string | null;
  status: string;
  value: number;
  description: string | null;
  due_date: string;
  invoice_url: string | null;
  payment_link: string | null;
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

async function draftMessage(
  lovableApiKey: string | undefined,
  companyName: string,
  p: PaymentRow,
  overdueDays: number,
): Promise<string> {
  const contexto = overdueDays > 0
    ? `vencida há ${overdueDays} dia(s)`
    : `vence em ${-overdueDays} dia(s)`;
  const fallback =
    `Olá! Aqui é da ${companyName}. Identificamos que a cobrança de ` +
    `R$ ${Number(p.value).toFixed(2).replace(".", ",")} (${p.description ?? "serviços"}) está ${contexto}. ` +
    `${p.invoice_url || p.payment_link ? `Link para pagamento: ${p.invoice_url ?? p.payment_link}. ` : ""}` +
    `Qualquer dúvida estamos à disposição!`;

  if (!lovableApiKey) return fallback;
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${lovableApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content:
              "Você redige mensagens curtas de cobrança para WhatsApp em pt-BR. Tom cordial e profissional, " +
              "sem ameaças, no máximo 3 frases. Inclua valor e link de pagamento quando fornecidos. " +
              "Responda APENAS com o texto da mensagem.",
          },
          {
            role: "user",
            content:
              `Empresa: ${companyName}. Cobrança: R$ ${Number(p.value).toFixed(2)} ` +
              `(${p.description ?? "serviços"}), ${contexto}. ` +
              `Link: ${p.invoice_url ?? p.payment_link ?? "não disponível"}.`,
          },
        ],
        max_tokens: 200,
      }),
    });
    if (!res.ok) return fallback;
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content?.trim();
    return text || fallback;
  } catch {
    return fallback;
  }
}

async function scanCompany(
  supabase: SupabaseClient,
  lovableApiKey: string | undefined,
  companyId: string,
): Promise<{ created: number; skipped: number }> {
  const { data: company } = await supabase
    .from("companies")
    .select("name")
    .eq("id", companyId)
    .single();
  const companyName = company?.name ?? "sua empresa";

  const today = new Date();
  const horizon = new Date(today.getTime() + DIAS_ANTECEDENCIA * 24 * 60 * 60 * 1000);

  const { data: payments, error } = await supabase
    .from("company_asaas_payments")
    .select("id, company_id, asaas_id, customer_id, status, value, description, due_date, invoice_url, payment_link")
    .eq("company_id", companyId)
    .in("status", ["PENDING", "OVERDUE"])
    .lte("due_date", horizon.toISOString().split("T")[0])
    .order("due_date", { ascending: true })
    .limit(50);
  if (error) throw error;

  let created = 0;
  let skipped = 0;

  for (const p of (payments ?? []) as PaymentRow[]) {
    const overdueDays = daysBetween(today, new Date(`${p.due_date}T00:00:00`));
    const dedupeKey = `collections:${p.asaas_id}:${p.due_date}`;

    // Já existe ação pendente para esta cobrança?
    const { data: existing } = await supabase
      .from("agent_actions")
      .select("id")
      .eq("company_id", companyId)
      .eq("dedupe_key", dedupeKey)
      .eq("status", "pending")
      .maybeSingle();
    if (existing) {
      skipped++;
      continue;
    }

    const message = await draftMessage(lovableApiKey, companyName, p, overdueDays);
    const isOverdue = overdueDays > 0;

    const { error: insErr } = await supabase.from("agent_actions").insert({
      company_id: companyId,
      agent: "collections",
      action_type: isOverdue ? "cobranca_vencida" : "cobranca_a_vencer",
      title: isOverdue
        ? `Cobrar R$ ${Number(p.value).toFixed(2)} — vencida há ${overdueDays}d`
        : `Lembrete R$ ${Number(p.value).toFixed(2)} — vence em ${-overdueDays}d`,
      description: p.description,
      suggested_message: message,
      payload: { asaas_id: p.asaas_id, payment_row_id: p.id, customer_id: p.customer_id, overdue_days: overdueDays },
      amount: p.value,
      due_date: p.due_date,
      dedupe_key: dedupeKey,
    });
    if (insErr) {
      // corrida com o índice único parcial → outro worker criou; segue
      skipped++;
    } else {
      created++;
    }
  }

  return { created, skipped };
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const preflight = corsPreflightResponse(req);
  if (preflight) return preflight;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
  const service = createClient(supabaseUrl, serviceKey);

  // Via cron: varre todas as empresas com Asaas configurado
  const cronSecret = Deno.env.get("CRON_SECRET");
  const providedCron = req.headers.get("x-cron-secret");
  if (cronSecret && providedCron === cronSecret) {
    try {
      const { data: configs } = await service
        .from("company_asaas_config")
        .select("company_id");
      const results: Record<string, { created: number; skipped: number }> = {};
      for (const cfg of configs ?? []) {
        results[cfg.company_id] = await scanCompany(service, lovableApiKey, cfg.company_id);
      }
      return new Response(JSON.stringify({ ok: true, results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (err) {
      console.error("[agent-collections] cron error", err);
      return new Response(JSON.stringify({ error: String(err) }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  // On-demand: usuário autenticado da empresa
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const { user } = auth;

  try {
    const body = await req.json().catch(() => ({}));
    const companyId = body.company_id as string | undefined;
    if (!companyId) return jsonResp({ error: "company_id é obrigatório" }, 400, corsHeaders);

    const forbidden = await assertMembership(auth.supabase, user.id, companyId, corsHeaders);
    if (forbidden) return forbidden;

    const result = await scanCompany(service, lovableApiKey, companyId);
    return jsonResp({ ok: true, ...result }, 200, corsHeaders);
  } catch (err) {
    console.error("[agent-collections] error", err);
    return jsonResp({ error: String(err) }, 500, corsHeaders);
  }
});
