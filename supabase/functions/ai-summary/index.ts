import { corsPreflightResponse } from "../_shared/cors.ts";
import { authenticate, assertMembership, jsonResp } from "../_shared/auth.ts";
import { parseJsonBody, validate, validateRequired, validateUUID } from "../_shared/validate.ts";

Deno.serve(async (req) => {
  const preflight = corsPreflightResponse(req);
  if (preflight) return preflight;

  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const { user, supabase, corsHeaders } = auth;

  try {
    const parsed = await parseJsonBody(req);
    if ("error" in parsed) {
      return jsonResp({ error: parsed.error }, 400, corsHeaders);
    }
    const { company_id } = parsed.data;

    const validationError = validate(
      validateRequired(parsed.data, ["company_id"]),
      validateUUID(company_id, "company_id"),
    );
    if (validationError) {
      return jsonResp({ error: validationError }, 400, corsHeaders);
    }

    const forbidden = await assertMembership(supabase, user.id, company_id as string, corsHeaders);
    if (forbidden) return forbidden;

    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) {
      return jsonResp({ error: "AI not configured" }, 500, corsHeaders);
    }

    const now = new Date();
    const curStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
    const curEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
    const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split("T")[0];
    const prevEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split("T")[0];

    const [curRes, prevRes, companyRes] = await Promise.all([
      supabase.from("transactions")
        .select("amount, type, description, date, chart_of_accounts(name, code), cost_centers(name)")
        .eq("company_id", company_id).eq("status", "confirmed")
        .gte("date", curStart).lte("date", curEnd),
      supabase.from("transactions")
        .select("amount, type, description, chart_of_accounts(name, code), cost_centers(name)")
        .eq("company_id", company_id).eq("status", "confirmed")
        .gte("date", prevStart).lte("date", prevEnd),
      supabase.from("companies").select("name").eq("id", company_id).single(),
    ]);

    const cur = curRes.data || [];
    const prev = prevRes.data || [];
    const companyName = companyRes.data?.name || "Empresa";

    const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

    const curRevenue = cur.filter((t: any) => t.type === "revenue").reduce((s: number, t: any) => s + Number(t.amount), 0);
    const curExpense = cur.filter((t: any) => t.type === "expense").reduce((s: number, t: any) => s + Number(t.amount), 0);
    const prevRevenue = prev.filter((t: any) => t.type === "revenue").reduce((s: number, t: any) => s + Number(t.amount), 0);
    const prevExpense = prev.filter((t: any) => t.type === "expense").reduce((s: number, t: any) => s + Number(t.amount), 0);

    // Group expenses by account
    const expByAccount: Record<string, number> = {};
    const revByAccount: Record<string, number> = {};
    const expByCostCenter: Record<string, number> = {};

    for (const t of cur) {
      const accountName = (t as any).chart_of_accounts?.name || "Sem classificação";
      const ccName = (t as any).cost_centers?.name || "Sem centro";
      const amount = Number(t.amount);
      if (t.type === "expense") {
        expByAccount[accountName] = (expByAccount[accountName] || 0) + amount;
        expByCostCenter[ccName] = (expByCostCenter[ccName] || 0) + amount;
      } else {
        revByAccount[accountName] = (revByAccount[accountName] || 0) + amount;
      }
    }

    const expBreakdown = Object.entries(expByAccount).map(([n, v]) => `  • ${n}: ${fmt(v)}`).join("\n");
    const revBreakdown = Object.entries(revByAccount).map(([n, v]) => `  • ${n}: ${fmt(v)}`).join("\n");
    const ccBreakdown = Object.entries(expByCostCenter).map(([n, v]) => `  • ${n}: ${fmt(v)}`).join("\n");

    const monthName = now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    const prevMonthName = new Date(now.getFullYear(), now.getMonth() - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

    const prompt = `Gere um resumo executivo mensal profissional para a empresa "${companyName}".

## Dados de ${monthName}:
📈 Receita: ${fmt(curRevenue)}
${revBreakdown || "  Nenhuma receita"}
📉 Despesas: ${fmt(curExpense)}
${expBreakdown || "  Nenhuma despesa"}
💰 Resultado: ${fmt(curRevenue - curExpense)}
📊 Margem: ${curRevenue > 0 ? ((curRevenue - curExpense) / curRevenue * 100).toFixed(1) : "0"}%

## Despesas por centro de custo:
${ccBreakdown || "  Sem dados"}

## Dados de ${prevMonthName} (comparação):
📈 Receita: ${fmt(prevRevenue)}
📉 Despesas: ${fmt(prevExpense)}
💰 Resultado: ${fmt(prevRevenue - prevExpense)}

## Principais transações do mês:
${cur.slice(0, 15).map((t: any) => `${t.date} | ${t.type === "revenue" ? "📈" : "📉"} ${fmt(Number(t.amount))} | ${t.description}`).join("\n")}

Gere o resumo executivo em markdown com:
1. **Visão Geral** - Resumo em 2-3 frases do mês
2. **Destaques Positivos** - O que foi bom (com números)
3. **Pontos de Atenção** - O que precisa melhorar (com números)
4. **Comparativo Mensal** - Variações vs mês anterior com percentuais
5. **Recomendações** - 3-5 ações práticas e específicas
6. **Nota do CFO** - Uma frase de fechamento motivacional

Use emojis, seja direto e profissional. Em português brasileiro.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableApiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Você é um CFO experiente que gera relatórios executivos claros e acionáveis. Responda em markdown formatado." },
          { role: "user", content: prompt },
        ],
        stream: true,
        temperature: 0.4,
      }),
    });

    if (!response.ok) {
      console.error("AI summary error:", response.status, await response.text());
      return jsonResp({ error: "AI summary failed" }, 500, corsHeaders);
    }

    // Stream SSE — preserva o body original
    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("Summary error:", error);
    return jsonResp({ error: "Internal server error" }, 500, corsHeaders);
  }
});
