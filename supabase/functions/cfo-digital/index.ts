import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";
import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";
import { parseJsonBody, validate, validateRequired, validateString, validateUUID } from "../_shared/validate.ts";

const EXTRA_HEADERS = "x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version";

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req, EXTRA_HEADERS);
  const preflight = corsPreflightResponse(req, EXTRA_HEADERS);
  if (preflight) return preflight;

  try {
    const parsed = await parseJsonBody(req);
    if ("error" in parsed) {
      return new Response(JSON.stringify({ error: parsed.error }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { question, company_id } = parsed.data;

    const validationError = validate(
      validateRequired(parsed.data, ["company_id"]),
      validateUUID(company_id, "company_id"),
      question != null ? validateString(question, "question", 5000) : null,
    );
    if (validationError) {
      return new Response(JSON.stringify({ error: validationError }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch all financial data for the company
    const [transactionsRes, accountsRes, costCentersRes, bankAccountsRes] = await Promise.all([
      supabase
        .from("transactions")
        .select("*, chart_of_accounts(name, code, type), cost_centers(name, category)")
        .eq("company_id", company_id)
        .order("date", { ascending: false })
        .limit(1000),
      supabase
        .from("chart_of_accounts")
        .select("*")
        .eq("company_id", company_id),
      supabase
        .from("cost_centers")
        .select("*")
        .eq("company_id", company_id),
      supabase
        .from("bank_accounts")
        .select("*")
        .eq("company_id", company_id),
    ]);

    const transactions = transactionsRes.data || [];
    const accounts = accountsRes.data || [];
    const costCenters = costCentersRes.data || [];
    const bankAccounts = bankAccountsRes.data || [];

    // Build financial summary
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const thisMonthTx = transactions.filter((t) => {
      const d = new Date(t.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const lastMonthTx = transactions.filter((t) => {
      const d = new Date(t.date);
      const lm = currentMonth === 0 ? 11 : currentMonth - 1;
      const ly = currentMonth === 0 ? currentYear - 1 : currentYear;
      return d.getMonth() === lm && d.getFullYear() === ly;
    });

    const sumByType = (txs: any[], type: string) =>
      txs.filter((t) => t.type === type).reduce((s, t) => s + Number(t.amount), 0);

    const currentRevenue = sumByType(thisMonthTx, "revenue");
    const currentExpenses = sumByType(thisMonthTx, "expense");
    const lastRevenue = sumByType(lastMonthTx, "revenue");
    const lastExpenses = sumByType(lastMonthTx, "expense");

    const totalRevenue = sumByType(transactions, "revenue");
    const totalExpenses = sumByType(transactions, "expense");

    // Cost center breakdown
    const costCenterBreakdown = costCenters.map((cc) => {
      const ccTx = thisMonthTx.filter((t) => t.cost_center_id === cc.id);
      const total = ccTx.reduce((s, t) => s + Number(t.amount), 0);
      return { name: cc.name, total, percentage: currentRevenue > 0 ? ((total / currentRevenue) * 100).toFixed(1) : "0" };
    });

    // Monthly trends (last 6 months)
    const monthlyTrends: { month: string; revenue: number; expenses: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const m = new Date(currentYear, currentMonth - i, 1);
      const mTx = transactions.filter((t) => {
        const d = new Date(t.date);
        return d.getMonth() === m.getMonth() && d.getFullYear() === m.getFullYear();
      });
      monthlyTrends.push({
        month: m.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
        revenue: sumByType(mTx, "revenue"),
        expenses: sumByType(mTx, "expense"),
      });
    }

    const financialContext = `
## DADOS FINANCEIROS DA EMPRESA

### Resumo Mês Atual
- Receitas: R$ ${currentRevenue.toFixed(2)}
- Despesas: R$ ${currentExpenses.toFixed(2)}
- Resultado: R$ ${(currentRevenue - currentExpenses).toFixed(2)}
- Margem: ${currentRevenue > 0 ? (((currentRevenue - currentExpenses) / currentRevenue) * 100).toFixed(1) : "0"}%

### Mês Anterior
- Receitas: R$ ${lastRevenue.toFixed(2)}
- Despesas: R$ ${lastExpenses.toFixed(2)}
- Resultado: R$ ${(lastRevenue - lastExpenses).toFixed(2)}

### Variação Mensal
- Receita: ${lastRevenue > 0 ? (((currentRevenue - lastRevenue) / lastRevenue) * 100).toFixed(1) : "N/A"}%
- Despesa: ${lastExpenses > 0 ? (((currentExpenses - lastExpenses) / lastExpenses) * 100).toFixed(1) : "N/A"}%

### Acumulado Total
- Total Receitas: R$ ${totalRevenue.toFixed(2)}
- Total Despesas: R$ ${totalExpenses.toFixed(2)}
- Resultado: R$ ${(totalRevenue - totalExpenses).toFixed(2)}

### Breakdown por Centro de Custo (mês atual)
${costCenterBreakdown.map((cc) => `- ${cc.name}: R$ ${cc.total.toFixed(2)} (${cc.percentage}% da receita)`).join("\n")}

### Tendência Mensal (últimos 6 meses)
${monthlyTrends.map((m) => `- ${m.month}: Receita R$ ${m.revenue.toFixed(2)} | Despesa R$ ${m.expenses.toFixed(2)} | Resultado R$ ${(m.revenue - m.expenses).toFixed(2)}`).join("\n")}

### Plano de Contas
${accounts.map((a) => `- ${a.code || "?"} ${a.name} (${a.type})`).join("\n")}

### Contas Bancárias
${bankAccounts.map((b) => `- ${b.name} (${b.bank_name || ""})`).join("\n")}

### Total de Lançamentos: ${transactions.length}
`;

    const systemPrompt = `Você é o CFO Digital, um consultor financeiro estratégico de alto nível. Você analisa os dados financeiros reais da empresa e fornece insights estratégicos, alertas e recomendações acionáveis.

REGRAS:
- Responda SEMPRE em português brasileiro
- Use linguagem executiva, clara e direta
- Forneça números concretos quando possível
- Seja proativo: aponte riscos, oportunidades e tendências
- Use emojis moderadamente para destaque visual (📊 💰 ⚠️ ✅ 📈 📉)
- Formate com markdown (headers, bullets, bold)
- Se não houver dados suficientes, diga isso claramente e sugira ações

CAPACIDADES:
- Análise de receitas, custos e despesas
- Diagnóstico de margem e rentabilidade
- Comparação mensal e tendências
- Análise de centros de custo
- Detecção de anomalias (despesas anormais, queda de receita)
- Recomendações estratégicas (redução de custos, precificação, contratação)
- Simulações simples (impacto de redução/aumento)
- Score financeiro (0-100) baseado na saúde geral
- Projeções básicas de fluxo de caixa

${financialContext}`;

    const userMessage = question || "Gere um resumo estratégico completo da saúde financeira da empresa, incluindo: score financeiro (0-100), principais alertas, diagnóstico e 3 recomendações prioritárias.";

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro no serviço de IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("cfo-digital error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
