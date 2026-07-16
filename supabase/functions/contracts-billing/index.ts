/**
 * Geração recorrente de Contas a Receber a partir de Contratos — rede de segurança
 * para contratos SEM assinatura Asaas (cobrança manual/agendada). Contratos com
 * assinatura Asaas têm a recorrência do próprio Asaas e são IGNORADOS aqui, para
 * nunca duplicar a cobrança.
 *
 * POST /contracts-billing
 *  - Cron: header X-Cron-Secret (varre todas as empresas)
 *  - On-demand: Bearer JWT + { company_id } (varre só a empresa do usuário)
 */

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";
import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";
import { authenticate, assertMembership, jsonResp } from "../_shared/auth.ts";

const MONTH_CYCLES = ["MONTHLY", "QUARTERLY", "SEMIANNUALLY", "YEARLY"];

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Próximo vencimento a partir de uma data, respeitando o ciclo e o dia de cobrança. */
function advanceDate(cycle: string, fromISO: string, billingDay: number): string {
  const [y, m, d] = fromISO.split("-").map(Number);
  const base = new Date(Date.UTC(y, m - 1, d));
  switch (cycle) {
    case "WEEKLY": base.setUTCDate(base.getUTCDate() + 7); break;
    case "BIWEEKLY": base.setUTCDate(base.getUTCDate() + 14); break;
    case "QUARTERLY": base.setUTCMonth(base.getUTCMonth() + 3); break;
    case "SEMIANNUALLY": base.setUTCMonth(base.getUTCMonth() + 6); break;
    case "YEARLY": base.setUTCMonth(base.getUTCMonth() + 12); break;
    default: base.setUTCMonth(base.getUTCMonth() + 1); break; // MONTHLY
  }
  if (MONTH_CYCLES.includes(cycle)) {
    base.setUTCDate(Math.min(Math.max(billingDay, 1), 28));
  }
  return base.toISOString().slice(0, 10);
}

interface ContractRow {
  id: string;
  contact_id: string | null;
  description: string;
  amount: number;
  cycle: string;
  billing_day: number;
  account_id: string | null;
  cost_center_id: string | null;
  next_due_date: string | null;
  end_date: string | null;
}

async function scanCompany(service: SupabaseClient, companyId: string): Promise<{ created: number; skipped: number }> {
  const today = todayISO();
  const { data: contracts } = await service
    .from("contracts")
    .select("id, contact_id, description, amount, cycle, billing_day, account_id, cost_center_id, next_due_date, end_date")
    .eq("company_id", companyId)
    .eq("status", "active")
    .is("asaas_subscription_id", null)
    .lte("next_due_date", today);

  let created = 0;
  let skipped = 0;

  for (const c of (contracts ?? []) as ContractRow[]) {
    let due = c.next_due_date;
    let guard = 0;
    // Catch-up de períodos vencidos, com teto p/ evitar loop descontrolado.
    while (due && due <= today && (!c.end_date || due <= c.end_date) && guard < 12) {
      const { data: exists } = await service
        .from("receivables")
        .select("id")
        .eq("company_id", companyId)
        .eq("contract_id", c.id)
        .eq("due_date", due)
        .maybeSingle();

      if (exists) {
        skipped++;
      } else {
        await service.from("receivables").insert({
          company_id: companyId,
          contact_id: c.contact_id,
          contract_id: c.id,
          description: c.description,
          amount: c.amount,
          due_date: due,
          status: "a_receber",
          source: "contrato",
          account_id: c.account_id,
          cost_center_id: c.cost_center_id,
        });
        created++;
      }
      due = advanceDate(c.cycle, due, c.billing_day);
      guard++;
    }

    const patch: Record<string, unknown> = { next_due_date: due };
    if (c.end_date && due && due > c.end_date) patch.status = "ended";
    await service.from("contracts").update(patch).eq("id", c.id);
  }

  return { created, skipped };
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const preflight = corsPreflightResponse(req);
  if (preflight) return preflight;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const service = createClient(supabaseUrl, serviceKey);

  // Via cron: varre todas as empresas
  const cronSecret = Deno.env.get("CRON_SECRET");
  const providedCron = req.headers.get("x-cron-secret");
  if (cronSecret && providedCron === cronSecret) {
    try {
      const { data: companies } = await service.from("companies").select("id");
      const results: Record<string, { created: number; skipped: number }> = {};
      for (const co of companies ?? []) {
        results[co.id] = await scanCompany(service, co.id);
      }
      return new Response(JSON.stringify({ ok: true, results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (err) {
      console.error("[contracts-billing] cron error", err);
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

    const result = await scanCompany(service, companyId);
    return jsonResp({ ok: true, ...result }, 200, corsHeaders);
  } catch (err) {
    console.error("[contracts-billing] error", err);
    return jsonResp({ error: String(err) }, 500, corsHeaders);
  }
});
