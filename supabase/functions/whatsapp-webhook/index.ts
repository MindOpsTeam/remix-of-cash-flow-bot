import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    console.log("Evolution webhook received:", JSON.stringify(body).slice(0, 500));

    if (body.event !== "messages.upsert") {
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = body.data;
    const key = data?.key;
    const message = data?.message;

    if (key?.fromMe) {
      return new Response(JSON.stringify({ ok: true, skipped: "fromMe" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const remoteJid = key?.remoteJid;
    const phoneNumber = remoteJid?.replace("@s.whatsapp.net", "") || "";
    const instanceName = body.instance;

    let textContent = "";
    if (message?.conversation) {
      textContent = message.conversation;
    } else if (message?.extendedTextMessage?.text) {
      textContent = message.extendedTextMessage.text;
    } else {
      await sendWhatsAppMessage(instanceName, remoteJid,
        "🤖 Por enquanto, só consigo processar mensagens de texto. Envie uma descrição do lançamento ou faça uma pergunta sobre suas finanças!"
      );
      return new Response(JSON.stringify({ ok: true, skipped: "non-text" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: whatsappConfig } = await supabase
      .from("whatsapp_configs")
      .select("*, companies(name)")
      .eq("instance_name", instanceName)
      .eq("active", true)
      .single();

    if (!whatsappConfig) {
      console.log("No active config found for instance:", instanceName);
      return new Response(JSON.stringify({ ok: true, skipped: "no-config" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: member } = await supabase
      .from("company_members")
      .select("user_id")
      .eq("company_id", whatsappConfig.company_id)
      .eq("role", "admin")
      .limit(1)
      .single();

    if (!member) {
      await sendWhatsAppMessage(instanceName, remoteJid, "❌ Nenhum admin encontrado na empresa.");
      return new Response(JSON.stringify({ ok: true, error: "no-admin" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const companyId = whatsappConfig.company_id;
    const companyName = (whatsappConfig.companies as any)?.name || "sua empresa";

    // Run the AI agent
    await runFinancialAgent({
      text: textContent,
      companyId,
      companyName,
      userId: member.user_id,
      instanceName,
      remoteJid,
      phoneNumber,
      configId: whatsappConfig.id,
      supabase,
    });

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("WhatsApp webhook error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ─── AI AGENT ──────────────────────────────────────────────────────────────────

interface AgentContext {
  text: string;
  companyId: string;
  companyName: string;
  userId: string;
  instanceName: string;
  remoteJid: string;
  phoneNumber: string;
  configId: string;
  supabase: any;
}

async function runFinancialAgent(ctx: AgentContext) {
  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!lovableApiKey) {
    await sendWhatsAppMessage(ctx.instanceName, ctx.remoteJid, "❌ Configuração de IA não encontrada.");
    return;
  }

  // Load company financial context
  const [accountsRes, centersRes, recentTxRes] = await Promise.all([
    ctx.supabase.from("chart_of_accounts").select("id, name, code, type").eq("company_id", ctx.companyId),
    ctx.supabase.from("cost_centers").select("id, name, category").eq("company_id", ctx.companyId).eq("active", true),
    ctx.supabase.from("transactions")
      .select("type, amount, description, date, status, chart_of_accounts(name, code), cost_centers(name)")
      .eq("company_id", ctx.companyId)
      .order("date", { ascending: false })
      .limit(50),
  ]);

  const accounts = accountsRes.data || [];
  const centers = centersRes.data || [];
  const recentTx = recentTxRes.data || [];

  // Calculate financial summary
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const today = now.toISOString().split("T")[0];
  const monthTx = recentTx.filter((t: any) => t.date >= firstDay && t.date <= today);

  const revenue = monthTx.filter((t: any) => t.type === "revenue").reduce((s: number, t: any) => s + Number(t.amount), 0);
  const expense = monthTx.filter((t: any) => t.type === "expense").reduce((s: number, t: any) => s + Number(t.amount), 0);
  const balance = revenue - expense;
  const margin = revenue > 0 ? ((balance / revenue) * 100).toFixed(1) : "0";

  // Group by account
  const expenseByAccount: Record<string, number> = {};
  const revenueByAccount: Record<string, number> = {};
  for (const t of monthTx) {
    const name = t.chart_of_accounts?.name || "Sem classificação";
    const map = t.type === "expense" ? expenseByAccount : revenueByAccount;
    map[name] = (map[name] || 0) + Number(t.amount);
  }

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const accountsList = accounts.map((a: any) => `${a.code} ${a.name} (${a.type}) [id: ${a.id}]`).join("\n");
  const centersList = centers.map((c: any) => `${c.name} (${c.category}) [id: ${c.id}]`).join("\n");

  const expenseBreakdown = Object.entries(expenseByAccount).map(([n, v]) => `  • ${n}: ${fmt(v)}`).join("\n");
  const revenueBreakdown = Object.entries(revenueByAccount).map(([n, v]) => `  • ${n}: ${fmt(v)}`).join("\n");

  const recentTxList = monthTx.slice(0, 10).map((t: any) =>
    `${t.date} | ${t.type === "revenue" ? "📈" : "📉"} ${fmt(Number(t.amount))} | ${t.description} | ${t.chart_of_accounts?.name || "-"} | ${t.cost_centers?.name || "-"} | ${t.status}`
  ).join("\n");

  const monthName = now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  const systemPrompt = `Você é o *CFO Digital*, o assistente financeiro inteligente da empresa *${ctx.companyName}* no WhatsApp.

Você é proativo, organizado e comunica tudo de forma clara e estruturada usando formatação do WhatsApp (*negrito*, _itálico_, ~tachado~).

## Seu papel:
- Registrar lançamentos financeiros (receitas e despesas)
- Consultar saldos, resumos e relatórios
- Gerar DRE (Demonstração do Resultado do Exercício)
- Dar dicas e análises financeiras
- Responder qualquer pergunta sobre a saúde financeira da empresa

## Dados da empresa (${monthName}):
📈 Receita total: ${fmt(revenue)}
${revenueBreakdown || "  Nenhuma receita registrada"}
📉 Despesa total: ${fmt(expense)}
${expenseBreakdown || "  Nenhuma despesa registrada"}
💰 Saldo: ${fmt(balance)}
📊 Margem: ${margin}%

## Últimos lançamentos:
${recentTxList || "Nenhum lançamento recente"}

## Plano de contas disponível:
${accountsList}

## Centros de custo disponíveis:
${centersList}

## Instruções de comportamento:

### Para lançamentos:
Quando o usuário enviar algo que parece um lançamento (ex: "paguei 200 de internet", "recebi 5000 do cliente X"):
1. Identifique: tipo (receita/despesa), valor, descrição
2. Classifique automaticamente a conta contábil e centro de custo mais adequados
3. Confirme DETALHADAMENTE o que você está fazendo
4. Responda no formato JSON na tag <ACTION> para eu processar

Exemplo de resposta para lançamento:
"✅ *Lançamento registrado!*

📉 *Tipo:* Despesa
💰 *Valor:* R$ 200,00
📝 *Descrição:* Pagamento de internet
📂 *Conta:* 5.5 Softwares
🏢 *Centro de custo:* Administrativo
📅 *Data:* 18/02/2026
⏳ *Status:* Pendente

_Classificado automaticamente pelo CFO Digital._"

<ACTION>{"action":"create_transaction","type":"expense","amount":200,"description":"Pagamento de internet","account_id":"xxx","cost_center_id":"yyy"}</ACTION>

### Para consultas e relatórios:
Quando perguntarem sobre saldo, gastos, receitas, DRE, resumo financeiro:
- Responda com os dados reais que você tem acima
- Organize com emojis e formatação rica
- Adicione insights e dicas relevantes

### Para DRE:
Quando pedirem DRE ou demonstração de resultado, monte assim:
"📊 *DRE — ${monthName}*
━━━━━━━━━━━━━━━━━━━━━
📈 *RECEITA BRUTA*
[detalhar receitas por conta]
━━━━━━━━━━━━━━━━━━━━━
📉 *(-) DEDUÇÕES E CUSTOS*
[detalhar custos código 4.x]
━━━━━━━━━━━━━━━━━━━━━
= *LUCRO BRUTO:* R$ X
━━━━━━━━━━━━━━━━━━━━━
📉 *(-) DESPESAS OPERACIONAIS*
[detalhar despesas código 5.x]
━━━━━━━━━━━━━━━━━━━━━
💰 *RESULTADO LÍQUIDO:* R$ X
📊 *Margem líquida:* X%"

E depois adicione <ACTION>{"action":"send_chart"}</ACTION> para eu gerar um gráfico visual.

### Para conversas gerais:
- Seja simpático e profissional
- Se não entender, pergunte de forma educada
- Sempre ofereça ajuda sobre o que mais pode fazer

### Regras:
- SEMPRE responda em português brasileiro
- SEMPRE use formatação WhatsApp
- SEMPRE seja descritivo sobre o que está fazendo
- Se tiver dúvida sobre a classificação, escolha a mais provável e informe ao usuário
- Inclua tags <ACTION> APENAS quando precisar executar ações no sistema`;

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableApiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: ctx.text },
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      console.error("AI Agent error:", response.status, await response.text());
      await sendWhatsAppMessage(ctx.instanceName, ctx.remoteJid,
        "❌ Desculpe, tive um problema técnico. Tente novamente em instantes."
      );
      return;
    }

    const result = await response.json();
    const aiResponse = result.choices?.[0]?.message?.content || "";

    // Extract actions from response
    const actionMatches = aiResponse.matchAll(/<ACTION>(.*?)<\/ACTION>/gs);
    const actions: any[] = [];
    for (const match of actionMatches) {
      try {
        actions.push(JSON.parse(match[1]));
      } catch { /* skip invalid JSON */ }
    }

    // Clean response (remove ACTION tags) for display
    const cleanResponse = aiResponse.replace(/<ACTION>.*?<\/ACTION>/gs, "").trim();

    // Send the AI response to WhatsApp
    if (cleanResponse) {
      await sendWhatsAppMessage(ctx.instanceName, ctx.remoteJid, cleanResponse);
    }

    // Process actions
    for (const action of actions) {
      if (action.action === "create_transaction") {
        const { error: txError } = await ctx.supabase
          .from("transactions")
          .insert({
            company_id: ctx.companyId,
            user_id: ctx.userId,
            description: action.description || "Lançamento via WhatsApp",
            amount: action.amount,
            type: action.type,
            date: action.date || today,
            source: "whatsapp",
            status: "pending",
            account_id: action.account_id || null,
            cost_center_id: action.cost_center_id || null,
          });

        if (txError) {
          console.error("Transaction insert error:", txError);
          await sendWhatsAppMessage(ctx.instanceName, ctx.remoteJid,
            `⚠️ O lançamento foi classificado mas houve um erro ao salvar: ${txError.message}`
          );
        }
      } else if (action.action === "send_chart") {
        try {
          const chartData = {
            revenue, expense, balance,
            expenseByAccount, revenueByAccount,
            month: monthName,
          };
          const imageBase64 = await generateFinancialChart(chartData, lovableApiKey);
          if (imageBase64) {
            await sendWhatsAppImage(ctx.instanceName, ctx.remoteJid, imageBase64, `📊 Dashboard Financeiro — ${monthName}`);
          }
        } catch (chartErr) {
          console.error("Chart generation error:", chartErr);
        }
      }
    }

    // Log the interaction
    await ctx.supabase.from("whatsapp_messages").insert({
      company_id: ctx.companyId,
      config_id: ctx.configId,
      phone_number: ctx.phoneNumber,
      direction: "inbound",
      message_text: ctx.text,
      message_type: "text",
      processed: true,
      classification: { actions, aiModel: "gemini-2.5-flash" },
    });

  } catch (err) {
    console.error("Agent error:", err);
    await sendWhatsAppMessage(ctx.instanceName, ctx.remoteJid,
      "❌ Ocorreu um erro inesperado. Tente novamente em instantes."
    );
  }
}

// ─── EVOLUTION API HELPERS ─────────────────────────────────────────────────────

async function sendWhatsAppMessage(instanceName: string, remoteJid: string, text: string) {
  const evolutionUrl = Deno.env.get("EVOLUTION_API_URL");
  const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");
  if (!evolutionUrl || !evolutionKey) { console.error("Evolution credentials missing"); return; }

  try {
    const res = await fetch(`${evolutionUrl}/message/sendText/${instanceName}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: evolutionKey },
      body: JSON.stringify({ number: remoteJid, text }),
    });
    if (!res.ok) console.error(`Evolution send failed [${res.status}]:`, await res.text());
  } catch (err) { console.error("Error sending WhatsApp message:", err); }
}

async function sendWhatsAppImage(instanceName: string, remoteJid: string, base64Image: string, caption: string) {
  const evolutionUrl = Deno.env.get("EVOLUTION_API_URL");
  const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");
  if (!evolutionUrl || !evolutionKey) { console.error("Evolution credentials missing"); return; }

  try {
    const res = await fetch(`${evolutionUrl}/message/sendMedia/${instanceName}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: evolutionKey },
      body: JSON.stringify({ number: remoteJid, mediatype: "image", mimetype: "image/png", caption, media: base64Image }),
    });
    if (!res.ok) console.error(`Evolution sendMedia failed [${res.status}]:`, await res.text());
  } catch (err) { console.error("Error sending WhatsApp image:", err); }
}

// ─── CHART GENERATION ──────────────────────────────────────────────────────────

async function generateFinancialChart(chartData: any, lovableApiKey: string): Promise<string | null> {
  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const expenseLines = Object.entries(chartData.expenseByAccount).map(([n, v]) => `${n}: ${fmt(v as number)}`).join(", ");
  const revenueLines = Object.entries(chartData.revenueByAccount).map(([n, v]) => `${n}: ${fmt(v as number)}`).join(", ");

  const prompt = `Create a clean, professional financial dashboard chart image in Portuguese (Brazil) with a dark background (#1a1a2e) and vibrant colors.

Title: "Resumo Financeiro — ${chartData.month}"

Show these elements:
1. A horizontal bar chart comparing Receitas (green #10b981, total ${fmt(chartData.revenue)}) vs Despesas (red #ef4444, total ${fmt(chartData.expense)})
2. A donut/pie chart showing expense breakdown: ${expenseLines || "Sem dados"}
3. A large KPI card showing "Saldo: ${fmt(chartData.balance)}" in ${chartData.balance >= 0 ? "green" : "red"}
4. Revenue breakdown: ${revenueLines || "Sem dados"}

Style: Modern fintech dashboard, rounded corners, subtle gradients, clean typography. Size: landscape 16:9 ratio. No watermarks.`;

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${lovableApiKey}` },
      body: JSON.stringify({ model: "google/gemini-2.5-flash-image", messages: [{ role: "user", content: prompt }], modalities: ["image", "text"] }),
    });

    if (!res.ok) { console.error("Chart AI error:", res.status, await res.text()); return null; }

    const result = await res.json();
    const imageUrl = result.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!imageUrl) { console.error("No image returned from AI"); return null; }

    return imageUrl.replace(/^data:image\/\w+;base64,/, "");
  } catch (err) { console.error("Chart generation error:", err); return null; }
}
