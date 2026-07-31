import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";
import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const preflight = corsPreflightResponse(req);
  if (preflight) return preflight;

  // Função de cron — só pode ser chamada com CRON_SECRET.
  // Pattern: header `X-Cron-Secret` ou `Authorization: Bearer <secret>`.
  // O secret deve ser configurado via lovable_create_secrets antes do agendamento.
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (!cronSecret) {
    console.error("[smart-alerts] CRON_SECRET not configured");
    return new Response(JSON.stringify({ error: "Cron secret not configured" }), {
      status: 503,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const provided =
    req.headers.get("x-cron-secret") ||
    req.headers.get("X-Cron-Secret") ||
    (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (provided !== cronSecret) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    const evolutionUrl = Deno.env.get("EVOLUTION_API_URL");
    const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");
    const supabase = createClient(supabaseUrl, serviceKey);

    // Get all active WhatsApp configs
    const { data: configs } = await supabase
      .from("whatsapp_configs")
      .select("*, companies(name)")
      .eq("active", true);

    if (!configs || configs.length === 0) {
      return new Response(JSON.stringify({ ok: true, message: "No active configs" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const alerts: string[] = [];

    for (const config of configs) {
      const companyId = config.company_id;
      const companyName = (config.companies as any)?.name || "Empresa";

      const now = new Date();
      const curStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
      const curEnd = now.toISOString().split("T")[0];
      const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split("T")[0];
      const prevEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split("T")[0];

      const [curRes, prevRes] = await Promise.all([
        supabase.from("transactions").select("amount, type, description, chart_of_accounts(name)").eq("company_id", companyId).eq("status", "confirmed").gte("date", curStart).lte("date", curEnd),
        supabase.from("transactions").select("amount, type, chart_of_accounts(name)").eq("company_id", companyId).eq("status", "confirmed").gte("date", prevStart).lte("date", prevEnd),
      ]);

      const cur = curRes.data || [];
      const prev = prevRes.data || [];
      const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

      const curExpense = cur.filter((t: any) => t.type === "expense").reduce((s: number, t: any) => s + Number(t.amount), 0);
      const prevExpense = prev.filter((t: any) => t.type === "expense").reduce((s: number, t: any) => s + Number(t.amount), 0);
      const curRevenue = cur.filter((t: any) => t.type === "revenue").reduce((s: number, t: any) => s + Number(t.amount), 0);
      const prevRevenue = prev.filter((t: any) => t.type === "revenue").reduce((s: number, t: any) => s + Number(t.amount), 0);

      const alertMessages: string[] = [];

      // Alert: expenses grew over 30%
      if (prevExpense > 0 && curExpense > prevExpense * 1.3) {
        const pct = (((curExpense - prevExpense) / prevExpense) * 100).toFixed(0);
        alertMessages.push(`📉 *Despesas subiram ${pct}%* este mês (${fmt(curExpense)} vs ${fmt(prevExpense)} no mês anterior).`);
      }

      // Alert: revenue dropped over 20%
      if (prevRevenue > 0 && curRevenue < prevRevenue * 0.8) {
        const pct = (((prevRevenue - curRevenue) / prevRevenue) * 100).toFixed(0);
        alertMessages.push(`⚠️ *Receita caiu ${pct}%* (${fmt(curRevenue)} vs ${fmt(prevRevenue)} no mês anterior).`);
      }

      // Alert: operating at a loss
      if (curRevenue > 0 && curExpense > curRevenue) {
        alertMessages.push(`🔴 *Atenção: operando com prejuízo!* Despesas ${fmt(curExpense)} > Receitas ${fmt(curRevenue)}.`);
      }

      // Alert: large single expense (>30% of revenue)
      const bigExpenses = cur.filter((t: any) => t.type === "expense" && Number(t.amount) > curRevenue * 0.3 && curRevenue > 0);
      for (const be of bigExpenses) {
        alertMessages.push(`💸 *Gasto expressivo:* ${fmt(Number(be.amount))} — "${be.description}" (${(Number(be.amount) / curRevenue * 100).toFixed(0)}% da receita).`);
      }

      if (alertMessages.length > 0 && evolutionUrl && evolutionKey) {
        // Find admin phone (get from last inbound message)
        const { data: lastMsg } = await supabase
          .from("whatsapp_messages")
          .select("phone_number")
          .eq("config_id", config.id)
          .eq("direction", "inbound")
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (lastMsg) {
          const header = `🤖 *Alertas Financeiros — ${companyName}*\n_${now.toLocaleDateString("pt-BR")}_\n\n`;
          const footer = `\n\n_Enviado automaticamente pelo CFO Digital._`;
          const fullMessage = header + alertMessages.join("\n\n") + footer;

          const remoteJid = lastMsg.phone_number.includes("@") ? lastMsg.phone_number : `${lastMsg.phone_number}@s.whatsapp.net`;

          // Duas tentativas com backoff: a Evolution cai com frequência e uma
          // falha transitória não pode engolir o alerta do dia.
          let sent = false;
          for (const espera of [0, 1500]) {
            if (espera > 0) await new Promise((r) => setTimeout(r, espera));
            try {
              const resp = await fetch(`${evolutionUrl}/message/sendText/${config.instance_name}`, {
                method: "POST",
                headers: { "Content-Type": "application/json", apikey: evolutionKey },
                body: JSON.stringify({ number: remoteJid, text: fullMessage }),
              });
              if (resp.ok) { sent = true; break; }
              console.error(`smart-alerts: Evolution ${resp.status} for ${companyName}`);
            } catch (e) {
              console.error("Failed to send alert:", e);
            }
          }
          if (sent) alerts.push(`Sent ${alertMessages.length} alerts to ${companyName}`);
          else {
            await supabase.from("notifications").insert({
              company_id: companyId,
              titulo: "Alertas do dia não chegaram no WhatsApp",
              corpo: "A Evolution não respondeu ao envio dos alertas financeiros. Reconecte a instância.",
              categoria: "sistema",
              link: "/whatsapp",
              dedupe_key: `whatsapp_falhou:smart-alerts:${config.id}`,
            });
          }
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, alerts }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("smart-alerts error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
