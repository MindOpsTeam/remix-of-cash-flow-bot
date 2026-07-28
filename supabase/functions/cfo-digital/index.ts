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

    // parseJsonBody devolve o corpo como `unknown` por segurança. Amarrar o
    // formato aqui, uma vez, é o que faz `deno check` valer alguma coisa neste
    // arquivo: sem isto, tudo abaixo virava `unknown` e o compilador parava de
    // proteger o resto da função.
    const corpo = parsed.data as {
      question?: unknown;
      company_id?: unknown;
      messages?: unknown;
    };
    const question = typeof corpo.question === "string" ? corpo.question : "";
    const company_id = typeof corpo.company_id === "string" ? corpo.company_id : "";
    const clientMessages = Array.isArray(corpo.messages)
      ? (corpo.messages as Array<{ role?: unknown; content?: unknown }>)
      : [];

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

    // Verify company membership
    const { data: membership } = await supabase
      .from("company_members")
      .select("id")
      .eq("user_id", user.id)
      .eq("company_id", company_id)
      .maybeSingle();

    if (!membership) {
      return new Response(JSON.stringify({ error: "Acesso negado a esta empresa" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const financialContext = await buildFinancialContext(supabase, company_id);

    const systemPrompt = buildSystemPrompt(financialContext);

    // Build conversation: support both `messages` array and legacy `question` field
    const conversation: { role: string; content: string }[] = [
      { role: "system", content: systemPrompt },
    ];

    if (clientMessages.length > 0) {
      for (const m of clientMessages) {
        if (typeof m?.role === "string" && typeof m?.content === "string") {
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

/**
 * Contexto financeiro do assistente.
 *
 * Regra da casa: o modelo NÃO soma. Ele recebe números já apurados e escreve a
 * frase em volta. Aqui isso vai além de estilo, porque a versão anterior somava
 * em TypeScript uma amostra de 1000 lançamentos SEM filtro de status:
 *
 *   - acima de 1000 lançamentos o total ficava errado em silêncio, e piorava
 *     conforme o cliente usasse mais o produto;
 *   - lançamento pendente ou cancelado entrava na conta, então o assistente
 *     dava um número e o DRE da tela ao lado dava outro.
 *
 * Agora tudo vem agregado das views v_dre_linhas e v_centro_custo_mes, que são
 * as mesmas do DRE. Um número só para a empresa inteira.
 */
async function buildFinancialContext(supabase: any, companyId: string): Promise<string> {
  const now = new Date();
  const cm = now.getMonth();
  const cy = now.getFullYear();
  const chaveMes = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const inicioJanela = new Date(cy, cm - 5, 1).toISOString().split("T")[0];

  const [dreRes, ccRes, bankAccountsRes, recentTxRes] = await Promise.all([
    supabase.from("v_dre_linhas").select("mes, grupo, total").eq("company_id", companyId),
    supabase
      .from("v_centro_custo_mes")
      .select("mes, centro_nome, type, total")
      .eq("company_id", companyId)
      .gte("mes", inicioJanela),
    supabase.from("bank_accounts").select("name, bank_name").eq("company_id", companyId),
    // Extrato: as últimas 30 com detalhe, para perguntas do tipo "o que entrou
    // ontem". Este é o único bloco de linha a linha que vai para o modelo.
    supabase
      .from("transactions")
      .select("date, description, type, amount, status, chart_of_accounts(name), cost_centers(name)")
      .eq("company_id", companyId)
      .in("status", ["confirmed", "reconciled"])
      .order("date", { ascending: false })
      .limit(30),
  ]);

  const linhasDre = (dreRes.data || []) as Array<{ mes: string; grupo: string; total: string | number }>;
  const linhasCc = (ccRes.data || []) as Array<{ mes: string; centro_nome: string; type: string; total: string | number }>;
  const bankAccounts = bankAccountsRes.data || [];
  const recentTx = recentTxRes.data || [];

  const somar = (filtro: (l: { mes: string; grupo: string }) => boolean) =>
    linhasDre.filter(filtro).reduce((s, l) => s + Number(l.total), 0);

  const mesAtual = chaveMes(now);
  const mesAnterior = chaveMes(new Date(cy, cm - 1, 1));
  const doMes = (mes: string) => (l: { mes: string }) => String(l.mes).slice(0, 7) === mes;

  const receitaDe = (mes: string) => somar((l) => doMes(mes)(l) && l.grupo === "receita");
  const saidaDe = (mes: string) => somar((l) => doMes(mes)(l) && (l.grupo === "custo" || l.grupo === "despesa"));

  const curRev = receitaDe(mesAtual);
  const curExp = saidaDe(mesAtual);
  const prevRev = receitaDe(mesAnterior);
  const prevExp = saidaDe(mesAnterior);
  const totalRev = somar((l) => l.grupo === "receita");
  const totalExp = somar((l) => l.grupo === "custo" || l.grupo === "despesa");

  // O que ainda não tem conta contábil fica FORA dos números acima, igual ao
  // DRE. O assistente precisa saber disso para não afirmar um resultado
  // completo quando ele não é.
  const naoClassificadoMes = somar((l) => doMes(mesAtual)(l) && l.grupo === "a_classificar");
  const naoClassificadoTotal = somar((l) => l.grupo === "a_classificar");

  const ccTotals = new Map<string, number>();
  for (const l of linhasCc) {
    if (String(l.mes).slice(0, 7) !== mesAtual || l.type !== "expense") continue;
    ccTotals.set(l.centro_nome, (ccTotals.get(l.centro_nome) || 0) + Number(l.total));
  }

  const trends: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const m = new Date(cy, cm - i, 1);
    const chave = chaveMes(m);
    const r = receitaDe(chave);
    const e = saidaDe(chave);
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

### Lançamentos ainda sem conta contábil
- Mês atual: R$ ${naoClassificadoMes.toFixed(2)}
- Acumulado: R$ ${naoClassificadoTotal.toFixed(2)}
- Este valor NÃO está somado nos resultados acima. Se for maior que zero, avise que o resultado ainda está incompleto e que classificar em Lançamentos fecha a conta.

### Despesas por Centro de Custo (mês atual)
${Array.from(ccTotals.entries()).map(([n, v]) => `- ${n}: R$ ${v.toFixed(2)}`).join("\n") || "- Nenhuma despesa categorizada"}

### Tendência (últimos 6 meses)
${trends.join("\n")}

### Contas Bancárias
${bankAccounts.map((b: any) => `- ${b.name} (${b.bank_name || ""})`).join("\n") || "- Nenhuma conta cadastrada"}

### Últimas 30 Transações (extrato)
${detailedTx.join("\n") || "- Nenhuma transação encontrada"}

### Cobertura destes dados
- Os totais acima vêm do banco já somados, sobre TODOS os lançamentos confirmados ou conciliados da empresa. Não são amostra.
- O extrato acima são apenas as 30 últimas. Para períodos ou filtros diferentes, oriente o usuário a usar a tela de Lançamentos em vez de estimar.
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
