import { corsPreflightResponse } from "../_shared/cors.ts";
import { authenticate, assertMembership, jsonResp } from "../_shared/auth.ts";
import { parseJsonBody, validate, validateRequired, validateUUID } from "../_shared/validate.ts";
import { projetarCaixa, type Compromisso, type MesHistorico } from "../_shared/forecast.ts";
import { chamarModelo, registrarUso } from "../_shared/ia.ts";

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

    // ── O CAIXA DOS PRÓXIMOS 90 DIAS JÁ ESTÁ, EM BOA PARTE, CONTRATADO.
    // Recebível tem vencimento, conta a pagar tem vencimento, contrato tem
    // próxima cobrança. Buscar isso é barato e é a diferença entre previsão e
    // chute. O modelo não vê nada disso antes de a conta estar feita.
    const hojeISO = new Date().toISOString().split("T")[0];
    const horizonte = new Date();
    horizonte.setMonth(horizonte.getMonth() + 4);
    const horizonteISO = horizonte.toISOString().split("T")[0];

    const [recebiveis, contasPagar, contratos, contasBancarias] = await Promise.all([
      supabase.from("receivables").select("due_date, amount, status")
        .eq("company_id", company_id).gte("due_date", hojeISO).lte("due_date", horizonteISO),
      supabase.from("bills_payable").select("vencimento, valor, status")
        .eq("company_id", company_id).gte("vencimento", hojeISO).lte("vencimento", horizonteISO),
      supabase.from("contracts").select("next_due_date, amount, status")
        .eq("company_id", company_id).eq("status", "active"),
      supabase.from("bank_accounts").select("balance").eq("company_id", company_id),
    ]);

    const compromissos: Compromisso[] = [];
    for (const r of recebiveis.data ?? []) {
      if (r.status !== "recebido" && r.status !== "cancelado") {
        compromissos.push({ data: r.due_date, valor: Number(r.amount), tipo: "entrada", origem: "recebivel" });
      }
    }
    for (const b of contasPagar.data ?? []) {
      if (b.status !== "pago" && b.status !== "cancelado") {
        compromissos.push({ data: b.vencimento, valor: Number(b.valor), tipo: "saida", origem: "conta_a_pagar" });
      }
    }
    for (const c of contratos.data ?? []) {
      if (c.next_due_date) {
        compromissos.push({ data: c.next_due_date, valor: Number(c.amount), tipo: "entrada", origem: "contrato" });
      }
    }

    const saldoInicial = (contasBancarias.data ?? []).reduce((s: number, c: { balance: number | null }) => s + Number(c.balance ?? 0), 0);

    const historicoCalculo: MesHistorico[] = Object.entries(monthlyData)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mes, v]) => ({ mes, receita: v.revenue, despesa: v.expense }));

    const { forecast: projecao, runwayMeses, baseHistorica } = projetarCaixa(
      historicoCalculo, compromissos, saldoInicial, 3,
    );

    // ── AGORA SIM O MODELO, e só para EXPLICAR o que a conta já decidiu.
    // Ele recebe os números prontos e escreve a frase em volta. Se ele cair, a
    // projeção continua de pé: a IA é o comentário, não o cálculo.
    const contratadoTotal = compromissos.filter((c) => c.tipo === "entrada").reduce((s, c) => s + c.valor, 0);
    const resumoProjecao = projecao
      .map((m) => `${m.month}: entrada ${fmt(m.projected_revenue)} (${fmt(m.contratado_entrada)} já contratada), saída ${fmt(m.projected_expense)}, saldo ao fim ${fmt(m.saldo_projetado)}`)
      .join("\n");

    const narracao = await chamarModelo<{
      insights: string[];
      risk_level: "low" | "medium" | "high";
      risk_explanation: string;
    }>(
      lovableApiKey,
      [
        {
          role: "system",
          content: `Você é um CFO explicando uma projeção de caixa JÁ CALCULADA para o dono de uma PME brasileira.

REGRA ABSOLUTA: não recalcule, não corrija e não invente nenhum número. Todos os valores já estão decididos. Seu trabalho é dizer POR QUE o caixa vai por esse caminho e o que fazer a respeito, citando apenas os números que eu te dei.

Escreva em português claro, sem jargão. Cada insight tem no máximo duas frases e é acionável.`,
        },
        {
          role: "user",
          content: `Histórico dos últimos meses:\n${monthSummary}\n\nProjeção calculada:\n${resumoProjecao}\n\nSaldo em conta hoje: ${fmt(saldoInicial)}\nTotal já contratado a receber no período: ${fmt(contratadoTotal)}\nMédia histórica ponderada de receita: ${fmt(baseHistorica)}\n${runwayMeses !== null ? `A empresa está queimando caixa: o saldo atual dura cerca de ${runwayMeses} meses nesse ritmo.` : "A empresa não está queimando caixa no ritmo atual."}`,
        },
      ],
      {
        modelo: "google/gemini-2.5-flash",
        temperatura: 0,
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["insights", "risk_level", "risk_explanation"],
          properties: {
            insights: { type: "array", items: { type: "string" }, maxItems: 4 },
            risk_level: { type: "string", enum: ["low", "medium", "high"] },
            risk_explanation: { type: "string" },
          },
        },
      },
    );

    await registrarUso(supabase, company_id as string, "ai-forecast", narracao);

    // A projeção é entregue com ou sem o modelo. Sem ele, o cliente perde a
    // explicação, não o número.
    const forecast = {
      forecast: projecao,
      insights: narracao.dados?.insights ?? [
        runwayMeses !== null
          ? `No ritmo atual, o saldo em conta cobre cerca de ${runwayMeses} meses.`
          : "As entradas projetadas cobrem as saídas no período.",
        `${fmt(contratadoTotal)} das entradas do período já estão contratadas.`,
      ],
      risk_level: narracao.dados?.risk_level ?? (runwayMeses !== null && runwayMeses < 3 ? "high" : "low"),
      risk_explanation:
        narracao.dados?.risk_explanation ??
        "Projeção calculada a partir dos vencimentos já registrados e da média histórica.",
      runway_meses: runwayMeses,
      saldo_inicial: saldoInicial,
      calculado_por: "motor_deterministico",
    };

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
