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

    // Evolution API sends different event types
    const event = body.event;

    // Only process incoming text messages
    if (event !== "messages.upsert") {
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = body.data;
    const key = data?.key;
    const message = data?.message;

    // Skip messages sent by us (fromMe = true)
    if (key?.fromMe) {
      return new Response(JSON.stringify({ ok: true, skipped: "fromMe" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const remoteJid = key?.remoteJid;
    const phoneNumber = remoteJid?.replace("@s.whatsapp.net", "") || "";
    const instanceName = body.instance;

    // Extract text content
    let textContent = "";
    if (message?.conversation) {
      textContent = message.conversation;
    } else if (message?.extendedTextMessage?.text) {
      textContent = message.extendedTextMessage.text;
    } else {
      // For now, only handle text messages
      await sendWhatsAppMessage(
        instanceName,
        remoteJid,
        "🤖 Por enquanto, só consigo processar mensagens de texto. Envie uma descrição do lançamento como:\n\n*Despesa* R$ 150 Almoço com cliente\n*Receita* R$ 5000 Pagamento projeto X"
      );
      return new Response(JSON.stringify({ ok: true, skipped: "non-text" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find the company linked to this Evolution instance
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

    // Get an admin user for creating transactions
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

    // Use AI to classify the message
    const classification = await classifyMessage(textContent, whatsappConfig.company_id, supabase);

    if (classification.intent === "transaction") {
      // Create the transaction
      const { data: tx, error: txError } = await supabase
        .from("transactions")
        .insert({
          company_id: whatsappConfig.company_id,
          user_id: member.user_id,
          description: classification.description,
          amount: classification.amount,
          type: classification.type,
          date: new Date().toISOString().split("T")[0],
          source: "whatsapp",
          status: "pending",
          account_id: classification.account_id || null,
          cost_center_id: classification.cost_center_id || null,
        })
        .select("id")
        .single();

      if (txError) {
        console.error("Transaction error:", txError);
        await sendWhatsAppMessage(
          instanceName,
          remoteJid,
          `❌ Erro ao criar lançamento: ${txError.message}`
        );
      } else {
        const typeLabel = classification.type === "revenue" ? "📈 Receita" : "📉 Despesa";
        const amountFormatted = classification.amount.toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
        });
        await sendWhatsAppMessage(
          instanceName,
          remoteJid,
          `✅ Lançamento criado!\n\n${typeLabel}: ${amountFormatted}\n📝 ${classification.description}\n📅 ${new Date().toLocaleDateString("pt-BR")}\n\n_Status: Pendente_`
        );
      }

      // Log the interaction
      await supabase.from("whatsapp_messages").insert({
        company_id: whatsappConfig.company_id,
        config_id: whatsappConfig.id,
        phone_number: phoneNumber,
        direction: "inbound",
        message_text: textContent,
        message_type: "text",
        processed: true,
        classification: classification as any,
      });
    } else if (classification.intent === "query") {
      // Handle balance/query requests with chart image
      const { text: queryText, chartData } = await handleQuery(classification, whatsappConfig.company_id, supabase);
      await sendWhatsAppMessage(instanceName, remoteJid, queryText);

      // Generate and send chart image
      if (chartData) {
        try {
          const imageBase64 = await generateFinancialChart(chartData);
          if (imageBase64) {
            await sendWhatsAppImage(instanceName, remoteJid, imageBase64, "📊 Gráfico financeiro do mês");
          }
        } catch (imgErr) {
          console.error("Chart generation error:", imgErr);
        }
      }

      await supabase.from("whatsapp_messages").insert({
        company_id: whatsappConfig.company_id,
        config_id: whatsappConfig.id,
        phone_number: phoneNumber,
        direction: "inbound",
        message_text: textContent,
        message_type: "text",
        processed: true,
        classification: classification as any,
      });
    } else {
      // Unknown intent - send help
      await sendWhatsAppMessage(
        instanceName,
        remoteJid,
        `🤖 Olá! Sou o assistente financeiro. Posso ajudar com:\n\n📝 *Lançamentos* — envie algo como:\n_Despesa R$ 150 Almoço com cliente_\n_Receita R$ 5000 Pagamento projeto_\n\n📊 *Consultas* — pergunte:\n_Qual meu saldo?_\n_Quanto gastei esse mês?_`
      );
    }

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

// Send message via Evolution API
async function sendWhatsAppMessage(instanceName: string, remoteJid: string, text: string) {
  const evolutionUrl = Deno.env.get("EVOLUTION_API_URL");
  const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");

  if (!evolutionUrl || !evolutionKey) {
    console.error("Evolution API credentials not configured");
    return;
  }

  try {
    const response = await fetch(
      `${evolutionUrl}/message/sendText/${instanceName}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: evolutionKey,
        },
        body: JSON.stringify({
          number: remoteJid,
          text,
        }),
      }
    );

    if (!response.ok) {
      const errBody = await response.text();
      console.error(`Evolution send failed [${response.status}]:`, errBody);
    }
  } catch (err) {
    console.error("Error sending WhatsApp message:", err);
  }
}

// Send image via Evolution API
async function sendWhatsAppImage(instanceName: string, remoteJid: string, base64Image: string, caption: string) {
  const evolutionUrl = Deno.env.get("EVOLUTION_API_URL");
  const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");

  if (!evolutionUrl || !evolutionKey) {
    console.error("Evolution API credentials not configured");
    return;
  }

  try {
    const response = await fetch(
      `${evolutionUrl}/message/sendMedia/${instanceName}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: evolutionKey,
        },
        body: JSON.stringify({
          number: remoteJid,
          mediatype: "image",
          mimetype: "image/png",
          caption,
          media: base64Image,
        }),
      }
    );

    if (!response.ok) {
      const errBody = await response.text();
      console.error(`Evolution sendMedia failed [${response.status}]:`, errBody);
    }
  } catch (err) {
    console.error("Error sending WhatsApp image:", err);
  }
}



// Classify message using Lovable AI
async function classifyMessage(
  text: string,
  companyId: string,
  supabase: any
): Promise<{
  intent: "transaction" | "query" | "unknown";
  type: "revenue" | "expense";
  amount: number;
  description: string;
  account_id?: string;
  cost_center_id?: string;
  query_type?: string;
}> {
  // Load accounts and cost centers for context
  const [accountsRes, centersRes] = await Promise.all([
    supabase
      .from("chart_of_accounts")
      .select("id, name, code, type")
      .eq("company_id", companyId),
    supabase
      .from("cost_centers")
      .select("id, name")
      .eq("company_id", companyId)
      .eq("active", true),
  ]);

  const accounts = accountsRes.data || [];
  const centers = centersRes.data || [];

  const accountsList = accounts
    .map((a: any) => `${a.id}|${a.code} ${a.name} (${a.type})`)
    .join("\n");
  const centersList = centers
    .map((c: any) => `${c.id}|${c.name}`)
    .join("\n");

  const prompt = `Você é um assistente financeiro. Analise a mensagem do usuário e classifique-a.

CONTAS DISPONÍVEIS:
${accountsList}

CENTROS DE CUSTO:
${centersList}

MENSAGEM: "${text}"

Responda APENAS com JSON válido (sem markdown):
{
  "intent": "transaction" ou "query" ou "unknown",
  "type": "revenue" ou "expense" (se transaction),
  "amount": número (se transaction, sem R$),
  "description": "descrição limpa do lançamento",
  "account_id": "id da conta mais adequada ou null",
  "cost_center_id": "id do centro de custo mais adequado ou null",
  "query_type": "balance" ou "expenses" ou "revenue" (se query)
}

Exemplos:
- "Despesa R$ 150 almoço" → transaction, expense, 150, "Almoço"
- "Recebi 5000 do cliente X" → transaction, revenue, 5000, "Pagamento cliente X"
- "Quanto gastei esse mês?" → query, query_type: "expenses"
- "Qual meu saldo?" → query, query_type: "balance"`;

  try {
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) {
      console.error("LOVABLE_API_KEY not set");
      return parseManually(text);
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableApiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      console.error("AI API error:", response.status, await response.text());
      return parseManually(text);
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || "";

    // Clean potential markdown wrapping
    const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return JSON.parse(cleaned);
  } catch (err) {
    console.error("AI classification error:", err);
    return parseManually(text);
  }
}

// Fallback manual parser
function parseManually(text: string): any {
  const lower = text.toLowerCase();
  const isRevenue =
    lower.includes("receita") ||
    lower.includes("recebi") ||
    lower.includes("entrada") ||
    lower.includes("pagamento recebido");

  const amountMatch = text.match(/R?\$?\s*(\d[\d.,]*)/);
  const amount = amountMatch
    ? parseFloat(amountMatch[1].replace(".", "").replace(",", "."))
    : 0;

  const description = text
    .replace(/R?\$?\s*\d[\d.,]*/g, "")
    .replace(/^(despesa|receita|gasto|entrada|saída)\s*/i, "")
    .trim() || "Lançamento via WhatsApp";

  if (amount > 0) {
    return {
      intent: "transaction",
      type: isRevenue ? "revenue" : "expense",
      amount,
      description,
    };
  }

  if (
    lower.includes("saldo") ||
    lower.includes("quanto") ||
    lower.includes("gast")
  ) {
    return { intent: "query", query_type: "balance", type: "expense", amount: 0, description: "" };
  }

  return { intent: "unknown", type: "expense", amount: 0, description: "" };
}

// Handle query requests
async function handleQuery(
  classification: any,
  companyId: string,
  supabase: any
): Promise<{ text: string; chartData: any | null }> {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split("T")[0];
  const today = now.toISOString().split("T")[0];

  const { data: transactions } = await supabase
    .from("transactions")
    .select("type, amount, account_id, date, chart_of_accounts(name, code)")
    .eq("company_id", companyId)
    .gte("date", firstDay)
    .lte("date", today);

  if (!transactions || transactions.length === 0) {
    return { text: "📊 Nenhum lançamento encontrado neste mês.", chartData: null };
  }

  const revenue = transactions
    .filter((t: any) => t.type === "revenue")
    .reduce((s: number, t: any) => s + Number(t.amount), 0);
  const expense = transactions
    .filter((t: any) => t.type === "expense")
    .reduce((s: number, t: any) => s + Number(t.amount), 0);
  const balance = revenue - expense;

  // Group expenses by account
  const expenseByAccount: Record<string, number> = {};
  const revenueByAccount: Record<string, number> = {};
  for (const t of transactions) {
    const accountName = t.chart_of_accounts?.name || "Sem conta";
    const map = t.type === "expense" ? expenseByAccount : revenueByAccount;
    map[accountName] = (map[accountName] || 0) + Number(t.amount);
  }

  const fmt = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  // Build detailed text
  let detailText = `📊 *Resumo Financeiro — ${new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}*\n\n`;
  detailText += `📈 *Receitas:* ${fmt(revenue)}\n`;
  for (const [name, val] of Object.entries(revenueByAccount)) {
    detailText += `   • ${name}: ${fmt(val as number)}\n`;
  }
  detailText += `\n📉 *Despesas:* ${fmt(expense)}\n`;
  for (const [name, val] of Object.entries(expenseByAccount)) {
    detailText += `   • ${name}: ${fmt(val as number)}\n`;
  }
  detailText += `\n💰 *Saldo:* ${fmt(balance)}`;
  detailText += `\n📅 _${firstDay} a ${today}_`;

  const chartData = {
    revenue,
    expense,
    balance,
    expenseByAccount,
    revenueByAccount,
    period: `${firstDay} a ${today}`,
    month: new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
  };

  return { text: detailText, chartData };
}

// Generate financial chart image using AI
async function generateFinancialChart(chartData: any): Promise<string | null> {
  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!lovableApiKey) {
    console.error("LOVABLE_API_KEY not set for chart generation");
    return null;
  }

  const fmt = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const expenseLines = Object.entries(chartData.expenseByAccount)
    .map(([name, val]) => `${name}: ${fmt(val as number)}`)
    .join(", ");
  const revenueLines = Object.entries(chartData.revenueByAccount)
    .map(([name, val]) => `${name}: ${fmt(val as number)}`)
    .join(", ");

  const prompt = `Create a clean, professional financial dashboard chart image in Portuguese (Brazil) with a dark background (#1a1a2e) and vibrant colors.

Title: "Resumo Financeiro — ${chartData.month}"

Show these elements:
1. A horizontal bar chart comparing Receitas (green #10b981, total ${fmt(chartData.revenue)}) vs Despesas (red #ef4444, total ${fmt(chartData.expense)})
2. A donut/pie chart showing expense breakdown: ${expenseLines}
3. A large KPI card showing "Saldo: ${fmt(chartData.balance)}" in ${chartData.balance >= 0 ? "green" : "red"}
4. Revenue breakdown: ${revenueLines}

Style: Modern fintech dashboard, rounded corners, subtle gradients, clean typography. Size: landscape 16:9 ratio. No watermarks.`;

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableApiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"],
      }),
    });

    if (!response.ok) {
      console.error("Chart AI error:", response.status, await response.text());
      return null;
    }

    const result = await response.json();
    const imageUrl = result.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!imageUrl) {
      console.error("No image returned from AI");
      return null;
    }

    // Extract base64 data (remove data:image/png;base64, prefix)
    const base64Data = imageUrl.replace(/^data:image\/\w+;base64,/, "");
    return base64Data;
  } catch (err) {
    console.error("Chart generation error:", err);
    return null;
  }
}
