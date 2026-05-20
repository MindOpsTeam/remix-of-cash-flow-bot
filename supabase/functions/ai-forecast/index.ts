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

    // Load last 6 months of transactions
    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);
    const startDate = sixMonthsAgo.toISOString().split("T")[0];

    const { data: transactions } = await supabase
      .from("transactions")
      .select("date, amount, type, description, chart_of_accounts(name, code), cost_centers(name)")
      .eq("company_id", company_id)
      .eq("status", "confirmed")
      .gte("date", startDate)
      .order("date", { ascending: true });

    const txData = transactions || [];

    // Group by month
    const monthlyData: Record<string, { revenue: number; expense: number; details: string[] }> = {};
    const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

    for (const t of txData) {
      const key = t.date.slice(0, 7);
      if (!monthlyData[key]) monthlyData[key] = { revenue: 0, expense: 0, details: [] };
      const amount = Number(t.amount);
      if (t.type === "revenue") monthlyData[key].revenue += amount;
      else monthlyData[key].expense += amount;
      monthlyData[key].details.push(`${t.type === "revenue" ? "+" : "-"}R$${amount.toFixed(2)} ${t.description} (${(t as any).chart_of_accounts?.name || "sem conta"})`);
    }

    const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    const monthSummary = Object.entries(monthlyData)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, val]) => {
        const [y, m] = key.split("-");
        return `${monthNames[parseInt(m) - 1]}/${y}: Receita ${fmt(val.revenue)}, Despesa ${fmt(val.expense)}, Saldo ${fmt(val.revenue - val.expense)}`;
      })
      .join("\n");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableApiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Você é um analista financeiro especializado em previsão de fluxo de caixa.

Baseado nos dados históricos abaixo, gere uma previsão de fluxo de caixa para os próximos 3 meses.

Responda APENAS com JSON válido no formato:
{
  "forecast": [
    {"month": "Mar/26", "projected_revenue": 15000, "projected_expense": 8000, "confidence": "high"},
    {"month": "Abr/26", "projected_revenue": 16000, "projected_expense": 8500, "confidence": "medium"},
    {"month": "Mai/26", "projected_revenue": 17000, "projected_expense": 9000, "confidence": "low"}
  ],
  "insights": [
    "Insight 1 em português",
    "Insight 2 em português",
    "Insight 3 em português"
  ],
  "risk_level": "low|medium|high",
  "risk_explanation": "Explicação do nível de risco em português"
}

Use os dados reais para fazer projeções inteligentes. Se não houver dados suficientes, indique baixa confiança.`,
          },
          {
            role: "user",
            content: `Dados históricos (últimos 6 meses):\n${monthSummary || "Sem dados históricos disponíveis"}`,
          },
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      console.error("AI forecast error:", response.status, await response.text());
      return jsonResp({ error: "AI forecast failed" }, 500, corsHeaders);
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || "";

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return jsonResp({ error: "Invalid AI response" }, 500, corsHeaders);
    }

    const forecast = JSON.parse(jsonMatch[0]);

    const history = Object.entries(monthlyData)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, val]) => {
        const [y, m] = key.split("-");
        return {
          month: `${monthNames[parseInt(m) - 1]}/${y.slice(2)}`,
          revenue: val.revenue,
          expense: val.expense,
          projected: false,
        };
      });

    return jsonResp({ ...forecast, history }, 200, corsHeaders);
  } catch (error) {
    console.error("Forecast error:", error);
    return jsonResp({ error: "Internal server error" }, 500, corsHeaders);
  }
});
