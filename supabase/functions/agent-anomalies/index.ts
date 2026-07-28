/**
 * Agente de Alertas — detecção de anomalias em lançamentos.
 *
 * Regra: lançamento da janela recente com valor acima de N vezes a média da
 * mesma conta contábil (ou do mesmo tipo, quando não há conta) no histórico
 * anterior, e acima de um piso em reais. Cria ação em agent_actions para
 * revisão humana.
 *
 * Os quatro números vinham fixos no código: 3 vezes, R$ 500, 7 dias, 90 dias.
 * Isso é palpite nosso valendo igual para 131 empresas, e "fora da curva" para
 * uma clínica não é o mesmo que para uma distribuidora. Agora vêm de
 * `agent_rules`, com esses mesmos valores como PADRÃO e não como lei.
 *
 * POST /agent-anomalies
 *  - Cron: header X-Cron-Secret (todas as empresas)
 *  - On-demand: Bearer JWT + { company_id }
 */

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";
import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";
import { authenticate, assertMembership, jsonResp } from "../_shared/auth.ts";
import { lerRegras } from "../_shared/agentes.ts";

interface TxRow {
  id: string;
  date: string;
  description: string | null;
  amount: number;
  type: string;
  account_id: string | null;
}

async function scanCompany(
  supabase: SupabaseClient,
  companyId: string,
): Promise<{ created: number; scanned: number; desligado?: boolean }> {
  const regras = await lerRegras(() =>
    supabase.from("agent_rules").select("agent, ativo, config").eq("company_id", companyId));
  if (!regras.ativo.anomalies) return { created: 0, scanned: 0, desligado: true };

  const { fator: FATOR_ANOMALIA, valor_minimo: VALOR_MINIMO,
          janela_dias: JANELA_DIAS, baseline_dias: BASELINE_DIAS } = regras.anomalia;

  const now = new Date();
  const windowStart = new Date(now.getTime() - JANELA_DIAS * 86400000).toISOString().split("T")[0];
  const baselineStart = new Date(now.getTime() - (JANELA_DIAS + BASELINE_DIAS) * 86400000)
    .toISOString()
    .split("T")[0];

  const { data: recent, error } = await supabase
    .from("transactions")
    .select("id, date, description, amount, type, account_id")
    .eq("company_id", companyId)
    .gte("date", windowStart)
    .gte("amount", VALOR_MINIMO)
    .limit(200);
  if (error) throw error;

  const { data: baseline, error: err2 } = await supabase
    .from("transactions")
    .select("amount, type, account_id")
    .eq("company_id", companyId)
    .gte("date", baselineStart)
    .lt("date", windowStart)
    .limit(5000);
  if (err2) throw err2;

  // Média por chave (conta contábil quando existe, senão tipo)
  const groups = new Map<string, { sum: number; n: number }>();
  for (const b of (baseline ?? []) as Pick<TxRow, "amount" | "type" | "account_id">[]) {
    const k = b.account_id ?? `type:${b.type}`;
    const g = groups.get(k) ?? { sum: 0, n: 0 };
    g.sum += Number(b.amount);
    g.n += 1;
    groups.set(k, g);
  }

  let created = 0;
  for (const tx of (recent ?? []) as TxRow[]) {
    const k = tx.account_id ?? `type:${tx.type}`;
    const g = groups.get(k);
    // Sem histórico suficiente não dá para dizer que é anomalia
    if (!g || g.n < 5) continue;
    const media = g.sum / g.n;
    if (Number(tx.amount) <= media * FATOR_ANOMALIA) continue;

    const dedupeKey = `anomaly:${tx.id}`;
    const { data: existing } = await supabase
      .from("agent_actions")
      .select("id")
      .eq("company_id", companyId)
      .eq("dedupe_key", dedupeKey)
      .maybeSingle();
    if (existing) continue;

    const vezes = (Number(tx.amount) / media).toFixed(1);
    const { error: insErr } = await supabase.from("agent_actions").insert({
      company_id: companyId,
      agent: "alerts",
      action_type: "anomalia_valor",
      title: `Lançamento ${vezes}× acima da média — R$ ${Number(tx.amount).toFixed(2)}`,
      description:
        `"${tx.description ?? "(sem descrição)"}" em ${tx.date} está ${vezes}× acima da média ` +
        `histórica (R$ ${media.toFixed(2)}) dos últimos ${BASELINE_DIAS} dias. Confirme se está correto.`,
      payload: { transaction_id: tx.id, media_90d: media, fator: Number(vezes) },
      amount: tx.amount,
      due_date: tx.date,
      dedupe_key: dedupeKey,
    });
    if (!insErr) created++;
  }

  return { created, scanned: (recent ?? []).length };
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const preflight = corsPreflightResponse(req);
  if (preflight) return preflight;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const service = createClient(supabaseUrl, serviceKey);

  const cronSecret = Deno.env.get("CRON_SECRET");
  const providedCron = req.headers.get("x-cron-secret");
  if (cronSecret && providedCron === cronSecret) {
    try {
      const { data: companies } = await service.from("companies").select("id");
      const results: Record<string, { created: number; scanned: number; desligado?: boolean }> = {};
      for (const c of companies ?? []) {
        try {
          results[c.id] = await scanCompany(service, c.id);
        } catch (err) {
          console.error(`[agent-anomalies] company ${c.id} failed`, err);
        }
      }
      return new Response(JSON.stringify({ ok: true, results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (err) {
      console.error("[agent-anomalies] cron error", err);
      return new Response(JSON.stringify({ error: String(err) }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

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
    console.error("[agent-anomalies] error", err);
    return jsonResp({ error: String(err) }, 500, corsHeaders);
  }
});
