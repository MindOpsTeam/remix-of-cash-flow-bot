import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";
import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";
import { parseJsonBody, validate, validateRequired, validateUUID } from "../_shared/validate.ts";

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

    const { question, company_id, messages: clientMessages } = parsed.data;

    const validationError = validate(
      validateRequired(parsed.data, ["company_id"]),
      validateUUID(company_id, "company_id"),
    );
    if (validationError) {
      return new Response(JSON.stringify({ error: validationError }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify JWT and membership
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const financialContext = await buildFinancialContext(supabase, company_id);

    const systemPrompt = buildSystemPrompt(financialContext);

    // Build conversation: support both `messages` array and legacy `question` field
    const conversation: { role: string; content: string }[] = [
      { role: "system", content: systemPrompt },
    ];

    if (Array.isArray(clientMessages) && clientMessages.length > 0) {
      for (const m of clientMessages) {
        if (m.role && m.content) {
          conversation.push({ role: m.role, content: m.content });
        }
      }
    } else if (question) {
      conversation.push({ role: "user", content: question });
    } else {
      conversation.push({
        role: "user",
        content: "Me dê um resumo rápido da saúde financeira da empresa.",
      });
    }

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
        messages: conversation,
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes." }), {
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

// ──────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────

async function buildFinancialContext(supabase: any, companyId: string): Promise<string> {
  const [transactionsRes, accountsRes, costCentersRes, bankAccountsRes, recentTxRes] = await Promise.all([
    supabase
      .from("transactions")
      .select("date, amount, type, cost_center_id")
      .eq("company_id", companyId)
      .order("date", { ascending: false })
      .limit(1000),
    supabase.from("chart_of_accounts").select("name, code, type").eq("company_id", companyId),
    supabase.from("cost_centers").select("id, name").eq("company_id", companyId),
    supabase.from("bank_accounts").select("name, bank_name").eq("company_id", companyId),
    // Last 30 transactions with full detail for statement queries
    supabase
      .from("transactions")
      .select("date, description, type, amount, chart_of_accounts(name), cost_centers(name)")
      .eq("company_id", companyId)
      .order("date", { ascending: false })
      .limit(30),
  ]);

  const transactions = transactionsRes.data || [];
  const accounts = accountsRes.data || [];
  const costCenters = costCentersRes.data || [];
  const bankAccounts = bankAccountsRes.data || [];
  const recentTx = recentTxRes.data || [];

  const now = new Date();
  const cm = now.getMonth();
  const cy = now.getFullYear();

  const sumByType = (txs: any[], type: string) =>
    txs.filter((t: any) => t.type === type).reduce((s: number, t: any) => s + Number(t.amount), 0);

  const thisMonth = transactions.filter((t: any) => {
    const d = new Date(t.date);
    return d.getMonth() === cm && d.getFullYear() === cy;
  });
  const lm = cm === 0 ? 11 : cm - 1;
  const ly = cm === 0 ? cy - 1 : cy;
  const lastMonth = transactions.filter((t: any) => {
    const d = new Date(t.date);
    return d.getMonth() === lm && d.getFullYear() === ly;
  });

  const curRev = sumByType(thisMonth, "revenue");
  const curExp = sumByType(thisMonth, "expense");
  const prevRev = sumByType(lastMonth, "revenue");
  const prevExp = sumByType(lastMonth, "expense");
  const totalRev = sumByType(transactions, "revenue");
  const totalExp = sumByType(transactions, "expense");

  // Cost center breakdown
  const ccMap = new Map<string, string>();
  costCenters.forEach((cc: any) => ccMap.set(cc.id, cc.name));
  const ccTotals = new Map<string, number>();
  thisMonth
    .filter((t: any) => t.type === "expense" && t.cost_center_id)
    .forEach((t: any) => {
      const name = ccMap.get(t.cost_center_id) || "Outros";
      ccTotals.set(name, (ccTotals.get(name) || 0) + Number(t.amount));
    });

  // Monthly trends (last 6)
  const trends: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const m = new Date(cy, cm - i, 1);
    const mTx = transactions.filter((t: any) => {
      const d = new Date(t.date);
      return d.getMonth() === m.getMonth() && d.getFullYear() === m.getFullYear();
    });
    const r = sumByType(mTx, "revenue");
    const e = sumByType(mTx, "expense");
    trends.push(`${m.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" })}: Receita R$ ${r.toFixed(2)} | Despesa R$ ${e.toFixed(2)} | Resultado R$ ${(r - e).toFixed(2)}`);
  }

  // Detailed recent transactions for statement
  const detailedTx = recentTx.map((t: any) => {
    const acctName = t.chart_of_accounts?.name || "";
    const ccName = t.cost_centers?.name || "";
    const typeLabel = t.type === "revenue" ? "Receita" : "Despesa";
    return `${t.date} | ${typeLabel} | R$ ${Number(t.amount).toFixed(2)} | ${t.description || "Sem descrição"} | Conta: ${acctName} | CC: ${ccName}`;
  });

  return `
## DADOS FINANCEIROS

### Saldo / Resultado Mês Atual
- Receitas: R$ ${curRev.toFixed(2)}
- Despesas: R$ ${curExp.toFixed(2)}
- Resultado: R$ ${(curRev - curExp).toFixed(2)}
- Margem: ${curRev > 0 ? (((curRev - curExp) / curRev) * 100).toFixed(1) : "0"}%

### Mês Anterior
- Receitas: R$ ${prevRev.toFixed(2)} | Despesas: R$ ${prevExp.toFixed(2)} | Resultado: R$ ${(prevRev - prevExp).toFixed(2)}

### Variação Mensal
- Receita: ${prevRev > 0 ? (((curRev - prevRev) / prevRev) * 100).toFixed(1) : "N/A"}%
- Despesa: ${prevExp > 0 ? (((curExp - prevExp) / prevExp) * 100).toFixed(1) : "N/A"}%

### Acumulado Total
- Receitas: R$ ${totalRev.toFixed(2)} | Despesas: R$ ${totalExp.toFixed(2)} | Resultado: R$ ${(totalRev - totalExp).toFixed(2)}

### Despesas por Centro de Custo (mês atual)
${Array.from(ccTotals.entries()).map(([n, v]) => `- ${n}: R$ ${v.toFixed(2)}`).join("\n") || "- Nenhuma despesa categorizada"}

### Tendência (últimos 6 meses)
${trends.join("\n")}

### Contas Bancárias
${bankAccounts.map((b: any) => `- ${b.name} (${b.bank_name || ""})`).join("\n") || "- Nenhuma conta cadastrada"}

### Últimas 30 Transações (extrato)
${detailedTx.join("\n") || "- Nenhuma transação encontrada"}

### Total de Lançamentos: ${transactions.length}
`;
}

function buildSystemPrompt(financialContext: string): string {
  return `Você é o CFO Digital, um assistente financeiro direto e conversacional. Responda em português brasileiro.

COMO RESPONDER:
- Perguntas sobre saldo, resultado ou caixa → responda o valor direto, sem enrolação
- Perguntas sobre extrato ou transações → liste as transações relevantes dos dados abaixo
- Perguntas sobre quanto gastou/recebeu → calcule e responda objetivamente
- Pedidos de resumo ou análise → aí sim forneça análise completa com insights
- Respostas curtas por padrão. Só elabore se pedirem

FORMATO:
- Use markdown quando útil (bold, listas)
- Emojis moderados (💰 📊 ⚠️ ✅)
- Valores sempre em R$ com 2 casas decimais
- Se não houver dados, diga claramente

${financialContext}`;
}
