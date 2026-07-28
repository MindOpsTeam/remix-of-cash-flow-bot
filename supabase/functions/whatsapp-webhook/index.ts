import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";
import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const preflight = corsPreflightResponse(req);
  if (preflight) return preflight;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    // Não logar payload completo — pode conter PII e texto financeiro
    console.log("Evolution webhook received:", body?.event, "instance:", body?.instance);

    if (body.event !== "messages.upsert") {
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = body.data;
    const key = data?.key;
    const message = data?.message;

    const remoteJid = key?.remoteJid || "";
    const instanceName = body.instance;
    const messageId = key?.id || "";

    // ── Lookup da instância e empresa ────────────────────────────────────────
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

    // ── Webhook secret check (CRÍTICO) ────────────────────────────────────────
    // Evita que qualquer um na internet forje mensagens forjando body.instance.
    // O secret pode vir via header X-Webhook-Secret ou query param ?token=
    // O usuário configura a Evolution para enviar esse header/query no webhook.
    const url = new URL(req.url);
    const providedSecret =
      req.headers.get("x-webhook-secret") ||
      req.headers.get("X-Webhook-Secret") ||
      url.searchParams.get("token") ||
      "";
    const expectedSecret = (whatsappConfig as { webhook_secret?: string }).webhook_secret || "";
    if (!expectedSecret || providedSecret !== expectedSecret) {
      console.warn(`[whatsapp-webhook] invalid secret for instance ${instanceName}`);
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Filtro de grupo dedicado ─────────────────────────────────────────────
    const isGroup = remoteJid.endsWith("@g.us");
    const configuredGroupJid = whatsappConfig.group_jid;

    if (!configuredGroupJid) {
      console.log("No group_jid configured, skipping all messages");
      return new Response(JSON.stringify({ ok: true, skipped: "no-group-configured" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!isGroup) {
      return new Response(JSON.stringify({ ok: true, skipped: "not-group" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (remoteJid !== configuredGroupJid) {
      return new Response(JSON.stringify({ ok: true, skipped: "wrong-group" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (key?.fromMe === true) {
      return new Response(JSON.stringify({ ok: true, skipped: "from-bot" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const phoneNumber = (key?.participant || "").replace("@s.whatsapp.net", "").replace(/\D/g, "");
    const replyJid = configuredGroupJid;

    const { data: member } = await supabase
      .from("company_members")
      .select("user_id")
      .eq("company_id", whatsappConfig.company_id)
      .eq("role", "admin")
      .limit(1)
      .single();

    const evolutionUrl = whatsappConfig.evolution_api_url || Deno.env.get("EVOLUTION_API_URL");
    const evolutionKey = whatsappConfig.evolution_api_key || Deno.env.get("EVOLUTION_API_KEY");

    if (!member) {
      await sendWhatsAppMessage(instanceName, replyJid, "❌ Nenhum admin encontrado na empresa.", evolutionUrl, evolutionKey);
      return new Response(JSON.stringify({ ok: true, error: "no-admin" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Deduplicação ─────────────────────────────────────────────────────────
    if (messageId) {
      const { data: existing } = await supabase
        .from("whatsapp_messages")
        .select("id")
        .eq("message_id", messageId)
        .eq("company_id", whatsappConfig.company_id)
        .maybeSingle();
      if (existing) {
        console.log("Duplicate message ignored:", messageId);
        return new Response(JSON.stringify({ ok: true, skipped: "duplicate" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ── Extrair conteúdo da mensagem ─────────────────────────────────────────
    let textContent = "";
    if (message?.conversation) {
      textContent = message.conversation;
    } else if (message?.extendedTextMessage?.text) {
      textContent = message.extendedTextMessage.text;
    } else if (message?.audioMessage) {
      try {
        await sendWhatsAppMessage(instanceName, replyJid, "🎙️ _Transcrevendo seu áudio..._", evolutionUrl, evolutionKey);
        const audioBase64 = await getMediaBase64(instanceName, messageId, replyJid, evolutionUrl, evolutionKey);
        if (!audioBase64) {
          await sendWhatsAppMessage(instanceName, replyJid, "❌ Não consegui baixar o áudio. Tente enviar novamente.", evolutionUrl, evolutionKey);
          return new Response(JSON.stringify({ ok: true, error: "audio-download-failed" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const transcription = await transcribeAudio(audioBase64, message.audioMessage.mimetype || "audio/ogg");
        if (!transcription) {
          await sendWhatsAppMessage(instanceName, replyJid, "❌ Não consegui transcrever o áudio. Tente enviar uma mensagem de texto.", evolutionUrl, evolutionKey);
          return new Response(JSON.stringify({ ok: true, error: "transcription-failed" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        textContent = transcription;
        console.log("Audio transcribed:", textContent.slice(0, 200));
      } catch (err) {
        console.error("Audio processing error:", err);
        await sendWhatsAppMessage(instanceName, replyJid, "❌ Erro ao processar o áudio. Tente novamente.", evolutionUrl, evolutionKey);
        return new Response(JSON.stringify({ ok: true, error: "audio-error" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else if (message?.imageMessage) {
      try {
        await sendWhatsAppMessage(instanceName, replyJid, "📸 _Analisando sua imagem..._", evolutionUrl, evolutionKey);
        const imageBase64 = await getMediaBase64(instanceName, messageId, replyJid, evolutionUrl, evolutionKey);
        if (!imageBase64) {
          await sendWhatsAppMessage(instanceName, replyJid, "❌ Não consegui baixar a imagem. Tente enviar novamente.", evolutionUrl, evolutionKey);
          return new Response(JSON.stringify({ ok: true, error: "image-download-failed" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const imageDescription = await analyzeDocumentImage(imageBase64, message.imageMessage.mimetype || "image/jpeg");
        if (!imageDescription) {
          await sendWhatsAppMessage(instanceName, replyJid, "❌ Não consegui analisar a imagem. Tente enviar uma foto mais nítida.", evolutionUrl, evolutionKey);
          return new Response(JSON.stringify({ ok: true, error: "image-analysis-failed" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const caption = message.imageMessage.caption || "";
        textContent = `[DOCUMENTO FINANCEIRO ENVIADO]\n${imageDescription}${caption ? `\n\nMensagem do usuário: ${caption}` : "\n\nO usuário enviou este documento. Analise os dados extraídos e forneça insights financeiros estratégicos."}`;
        console.log("Image analyzed:", textContent.slice(0, 300));
      } catch (err) {
        console.error("Image processing error:", err);
        await sendWhatsAppMessage(instanceName, replyJid, "❌ Erro ao processar a imagem. Tente novamente.", evolutionUrl, evolutionKey);
        return new Response(JSON.stringify({ ok: true, error: "image-error" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      await sendWhatsAppMessage(instanceName, replyJid,
        "🤖 Sou o *CFO Digital* da empresa! Consigo processar *texto*, *áudio* e *imagens de documentos*. Pergunte sobre a saúde financeira, riscos, projeções ou envie um documento para análise.",
        evolutionUrl, evolutionKey
      );
      return new Response(JSON.stringify({ ok: true, skipped: "non-text" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const companyId = whatsappConfig.company_id;
    const companyName = (whatsappConfig.companies as any)?.name || "sua empresa";

    // ── Comandos de agentes: "ações" lista pendentes; "aprovar N"/"recusar N" decide ──
    const trimmed = textContent.trim();
    if (/^(ações|acoes|pendências|pendencias)$/i.test(trimmed)) {
      const reply = await listPendingAgentActions(supabase, companyId);
      await sendWhatsAppMessage(instanceName, replyJid, reply, evolutionUrl, evolutionKey);
      return new Response(JSON.stringify({ ok: true, handled: "agent-list" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const approvalMatch = trimmed.match(/^(aprovar|recusar)\s+(\d{1,3})$/i);
    if (approvalMatch) {
      const reply = await decideAgentAction(
        supabase,
        companyId,
        approvalMatch[1].toLowerCase() === "aprovar" ? "approved" : "rejected",
        parseInt(approvalMatch[2], 10),
      );
      await sendWhatsAppMessage(instanceName, replyJid, reply, evolutionUrl, evolutionKey);
      return new Response(JSON.stringify({ ok: true, handled: "agent-decision" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Rodar o assistente CFO ────────────────────────────────────────────────
    await runCFOAssistant({
      text: textContent,
      companyId,
      companyName,
      instanceName,
      remoteJid: replyJid,
      phoneNumber,
      messageId,
      configId: whatsappConfig.id,
      supabase,
      evolutionUrl,
      evolutionKey,
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

// ─── CFO ASSISTANT ───────────────────────────────────────────────────────────

interface CFOContext {
  text: string;
  companyId: string;
  companyName: string;
  instanceName: string;
  remoteJid: string;
  phoneNumber: string;
  messageId: string;
  configId: string;
  supabase: any;
  evolutionUrl: string | undefined;
  evolutionKey: string | undefined;
}

async function runCFOAssistant(ctx: CFOContext) {
  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!lovableApiKey) {
    await sendWhatsAppMessage(ctx.instanceName, ctx.remoteJid, "❌ Configuração de IA não encontrada.", ctx.evolutionUrl, ctx.evolutionKey);
    return;
  }

  await sendWhatsAppMessage(ctx.instanceName, ctx.remoteJid, "🧠 _Analisando dados financeiros..._", ctx.evolutionUrl, ctx.evolutionKey);

  // ── Fetch financial data (same as cfo-digital edge function) ──────────────
  const [transactionsRes, accountsRes, costCentersRes, bankAccountsRes] = await Promise.all([
    ctx.supabase
      .from("transactions")
      .select("*, chart_of_accounts(name, code, type), cost_centers(name, category)")
      .eq("company_id", ctx.companyId)
      .order("date", { ascending: false })
      .limit(1000),
    ctx.supabase
      .from("chart_of_accounts")
      .select("*")
      .eq("company_id", ctx.companyId),
    ctx.supabase
      .from("cost_centers")
      .select("*")
      .eq("company_id", ctx.companyId),
    ctx.supabase
      .from("bank_accounts")
      .select("*")
      .eq("company_id", ctx.companyId),
  ]);

  const transactions = transactionsRes.data || [];
  const accounts = accountsRes.data || [];
  const costCenters = costCentersRes.data || [];
  const bankAccounts = bankAccountsRes.data || [];

  // ── Build financial summary ──────────────────────────────────────────────
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const thisMonthTx = transactions.filter((t: any) => {
    const d = new Date(t.date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  const lastMonthTx = transactions.filter((t: any) => {
    const d = new Date(t.date);
    const lm = currentMonth === 0 ? 11 : currentMonth - 1;
    const ly = currentMonth === 0 ? currentYear - 1 : currentYear;
    return d.getMonth() === lm && d.getFullYear() === ly;
  });

  const sumByType = (txs: any[], type: string) =>
    txs.filter((t: any) => t.type === type).reduce((s: number, t: any) => s + Number(t.amount), 0);

  const currentRevenue = sumByType(thisMonthTx, "revenue");
  const currentExpenses = sumByType(thisMonthTx, "expense");
  const lastRevenue = sumByType(lastMonthTx, "revenue");
  const lastExpenses = sumByType(lastMonthTx, "expense");
  const totalRevenue = sumByType(transactions, "revenue");
  const totalExpenses = sumByType(transactions, "expense");

  // Cost center breakdown
  const costCenterBreakdown = costCenters.map((cc: any) => {
    const ccTx = thisMonthTx.filter((t: any) => t.cost_center_id === cc.id);
    const total = ccTx.reduce((s: number, t: any) => s + Number(t.amount), 0);
    return { name: cc.name, total, percentage: currentRevenue > 0 ? ((total / currentRevenue) * 100).toFixed(1) : "0" };
  });

  // Monthly trends (last 6 months)
  const monthlyTrends: { month: string; revenue: number; expenses: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const m = new Date(currentYear, currentMonth - i, 1);
    const mTx = transactions.filter((t: any) => {
      const d = new Date(t.date);
      return d.getMonth() === m.getMonth() && d.getFullYear() === m.getFullYear();
    });
    monthlyTrends.push({
      month: m.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
      revenue: sumByType(mTx, "revenue"),
      expenses: sumByType(mTx, "expense"),
    });
  }

  const fmt = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;

  const financialContext = `
## DADOS FINANCEIROS — ${ctx.companyName}

### Resumo Mês Atual
- Receitas: ${fmt(currentRevenue)}
- Despesas: ${fmt(currentExpenses)}
- Resultado: ${fmt(currentRevenue - currentExpenses)}
- Margem: ${currentRevenue > 0 ? (((currentRevenue - currentExpenses) / currentRevenue) * 100).toFixed(1) : "0"}%

### Mês Anterior
- Receitas: ${fmt(lastRevenue)}
- Despesas: ${fmt(lastExpenses)}
- Resultado: ${fmt(lastRevenue - lastExpenses)}

### Variação Mensal
- Receita: ${lastRevenue > 0 ? (((currentRevenue - lastRevenue) / lastRevenue) * 100).toFixed(1) : "N/A"}%
- Despesa: ${lastExpenses > 0 ? (((currentExpenses - lastExpenses) / lastExpenses) * 100).toFixed(1) : "N/A"}%

### Acumulado Total
- Total Receitas: ${fmt(totalRevenue)}
- Total Despesas: ${fmt(totalExpenses)}
- Resultado: ${fmt(totalRevenue - totalExpenses)}

### Breakdown por Centro de Custo (mês atual)
${costCenterBreakdown.map((cc: any) => `- ${cc.name}: ${fmt(cc.total)} (${cc.percentage}% da receita)`).join("\n")}

### Tendência Mensal (últimos 6 meses)
${monthlyTrends.map((m) => `- ${m.month}: Receita ${fmt(m.revenue)} | Despesa ${fmt(m.expenses)} | Resultado ${fmt(m.revenue - m.expenses)}`).join("\n")}

### Plano de Contas
${accounts.map((a: any) => `- ${a.code || "?"} ${a.name} (${a.type})`).join("\n")}

### Contas Bancárias
${bankAccounts.map((b: any) => `- ${b.name} (${b.bank_name || ""})`).join("\n")}

### Total de Lançamentos: ${transactions.length}
`;

  const systemPrompt = `Você é o *CFO Digital*, um consultor financeiro estratégico de alto nível da empresa "${ctx.companyName}". Você analisa os dados financeiros reais da empresa e fornece insights estratégicos, alertas e recomendações acionáveis.

REGRAS:
- Responda SEMPRE em português brasileiro
- Use linguagem executiva, clara e direta
- Forneça números concretos quando possível
- Seja proativo: aponte riscos, oportunidades e tendências
- Use emojis moderadamente para destaque visual (📊 💰 ⚠️ ✅ 📈 📉)
- Formate para *WhatsApp*: use *negrito* com asteriscos, _itálico_ com underline, listas com • ou -
- NÃO use markdown com # headers — WhatsApp não renderiza isso
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
- Análise de documentos financeiros (boletos, notas, recibos)

${financialContext}`;

  const userMessage = ctx.text;

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableApiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        temperature: 0.4,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI CFO error:", response.status, errText);
      if (response.status === 429) {
        await sendWhatsAppMessage(ctx.instanceName, ctx.remoteJid, "⏳ Limite de requisições excedido. Tente novamente em alguns minutos.", ctx.evolutionUrl, ctx.evolutionKey);
      } else {
        await sendWhatsAppMessage(ctx.instanceName, ctx.remoteJid, "❌ Desculpe, tive um problema técnico. Tente novamente em instantes.", ctx.evolutionUrl, ctx.evolutionKey);
      }
      return;
    }

    const result = await response.json();
    const aiResponse = result.choices?.[0]?.message?.content || "";

    if (!aiResponse) {
      await sendWhatsAppMessage(ctx.instanceName, ctx.remoteJid, "⚠️ Não consegui gerar uma resposta. Tente reformular sua pergunta.", ctx.evolutionUrl, ctx.evolutionKey);
      return;
    }

    // Send response in chunks (WhatsApp has message size limits)
    for (const chunk of splitMessage(aiResponse, 3800)) {
      await sendWhatsAppMessage(ctx.instanceName, ctx.remoteJid, chunk, ctx.evolutionUrl, ctx.evolutionKey);
    }

    // Log da interação
    await Promise.all([
      ctx.supabase.from("whatsapp_messages").insert({
        company_id: ctx.companyId,
        config_id: ctx.configId,
        phone_number: ctx.phoneNumber,
        direction: "inbound",
        message_text: ctx.text,
        message_type: "text",
        processed: true,
        message_id: ctx.messageId || null,
        classification: { aiModel: "gemini-3-flash-preview", mode: "cfo-assistant" },
      }),
      ctx.supabase.from("whatsapp_messages").insert({
        company_id: ctx.companyId,
        config_id: ctx.configId,
        phone_number: "bot",
        direction: "outbound",
        message_text: aiResponse.slice(0, 2000),
        message_type: "text",
        processed: true,
        classification: { mode: "cfo-assistant" },
      }),
    ]);

  } catch (err) {
    console.error("CFO Assistant error:", err);
    await sendWhatsAppMessage(ctx.instanceName, ctx.remoteJid,
      "❌ Ocorreu um erro inesperado. Tente novamente em instantes.", ctx.evolutionUrl, ctx.evolutionKey
    );
  }
}

// ─── AUDIO PROCESSING ─────────────────────────────────────────────────────────

async function getMediaBase64(instanceName: string, messageId: string, remoteJid: string, evoUrl?: string, evoKey?: string): Promise<string | null> {
  const evolutionUrl = evoUrl || Deno.env.get("EVOLUTION_API_URL");
  const evolutionKey = evoKey || Deno.env.get("EVOLUTION_API_KEY");
  if (!evolutionUrl || !evolutionKey) { console.error("Evolution credentials missing"); return null; }

  try {
    const res = await fetch(`${evolutionUrl}/chat/getBase64FromMediaMessage/${instanceName}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: evolutionKey },
      body: JSON.stringify({ message: { key: { remoteJid, id: messageId } }, convertToMp4: false }),
    });
    if (!res.ok) { console.error(`Evolution getBase64 failed [${res.status}]:`, await res.text()); return null; }
    const data = await res.json();
    return data?.base64 || null;
  } catch (err) { console.error("Error getting media base64:", err); return null; }
}

async function transcribeAudio(audioBase64: string, mimetype: string): Promise<string | null> {
  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!lovableApiKey) return null;

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${lovableApiKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{
          role: "user",
          content: [
            { type: "text", text: "Transcreva este áudio em português brasileiro. Retorne APENAS o texto transcrito, sem formatação, sem aspas, sem explicações." },
            { type: "input_audio", input_audio: { data: audioBase64, format: mimetype.includes("ogg") ? "ogg" : "mp3" } },
          ],
        }],
        temperature: 0.1,
      }),
    });
    if (!res.ok) { console.error("Transcription AI error:", res.status, await res.text()); return null; }
    const result = await res.json();
    return result.choices?.[0]?.message?.content?.trim() || null;
  } catch (err) { console.error("Transcription error:", err); return null; }
}

// ─── IMAGE ANALYSIS ───────────────────────────────────────────────────────────

async function analyzeDocumentImage(imageBase64: string, mimetype: string): Promise<string | null> {
  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!lovableApiKey) return null;

  try {
    const imageUrl = `data:${mimetype};base64,${imageBase64}`;
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${lovableApiKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{
          role: "user",
          content: [
            { type: "text", text: `Analise esta imagem de documento financeiro brasileiro e extraia todas as informações relevantes.
Identifique o tipo (boleto, nota fiscal, NFS-e, cupom fiscal, recibo, comprovante PIX, extrato, etc).
Extraia: valor, data, emitente, CNPJ/CPF, beneficiário, descrição, código de barras/linha digitável (se boleto), número do documento.
Formate a resposta em texto corrido descritivo, ex: "Boleto de R$ 150,00, vencimento 15/03/2026, emitido por Empresa X (CNPJ 12.345.678/0001-99), referente a serviços de internet."
Se não for um documento financeiro, descreva o que vê na imagem.` },
            { type: "image_url", image_url: { url: imageUrl } },
          ],
        }],
        temperature: 0.1,
      }),
    });
    if (!res.ok) { console.error("Image analysis AI error:", res.status, await res.text()); return null; }
    const result = await res.json();
    return result.choices?.[0]?.message?.content?.trim() || null;
  } catch (err) { console.error("Image analysis error:", err); return null; }
}

// ─── EVOLUTION API HELPERS ────────────────────────────────────────────────────

async function sendWhatsAppMessage(instanceName: string, remoteJid: string, text: string, evoUrl?: string, evoKey?: string) {
  const evolutionUrl = evoUrl || Deno.env.get("EVOLUTION_API_URL");
  const evolutionKey = evoKey || Deno.env.get("EVOLUTION_API_KEY");
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

// ─── UTILITY ─────────────────────────────────────────────────────────────────

function splitMessage(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= maxLen) { chunks.push(remaining); break; }
    let splitIdx = remaining.lastIndexOf("\n", maxLen);
    if (splitIdx < maxLen * 0.3) splitIdx = maxLen;
    chunks.push(remaining.slice(0, splitIdx));
    remaining = remaining.slice(splitIdx).trimStart();
  }
  return chunks;
}

// ── Aprovação de ações dos agentes pelo grupo ────────────────────────────────

async function fetchPendingActions(supabase: any, companyId: string) {
  const { data } = await supabase
    .from("agent_actions")
    .select("id, title, suggested_message, amount, status")
    .eq("company_id", companyId)
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(20);
  return (data ?? []) as Array<{ id: string; title: string; suggested_message: string | null; amount: number | null; status: string }>;
}

async function listPendingAgentActions(supabase: any, companyId: string): Promise<string> {
  const actions = await fetchPendingActions(supabase, companyId);
  if (actions.length === 0) {
    return "✅ Nenhuma ação de agente aguardando aprovação.";
  }
  const lines = actions.map((a, i) => `*${i + 1}.* ${a.title}`);
  return (
    `🤖 *Ações aguardando aprovação:*\n\n${lines.join("\n")}\n\n` +
    `Responda *aprovar N* ou *recusar N* (ex.: aprovar 1).`
  );
}

async function decideAgentAction(
  supabase: any,
  companyId: string,
  status: "approved" | "rejected",
  num: number,
): Promise<string> {
  const actions = await fetchPendingActions(supabase, companyId);
  const action = actions[num - 1];
  if (!action) {
    return `⚠️ Não encontrei a ação nº ${num}. Envie *ações* para ver a lista atual.`;
  }
  const { error } = await supabase
    .from("agent_actions")
    .update({ status, decided_at: new Date().toISOString() })
    .eq("id", action.id)
    .eq("status", "pending");
  if (error) {
    return "❌ Erro ao registrar a decisão. Tente novamente.";
  }
  if (status === "rejected") {
    return `🚫 Ação recusada: ${action.title}`;
  }
  return (
    `✅ Aprovada: ${action.title}\n\n` +
    (action.suggested_message
      ? `Mensagem pronta para enviar ao cliente:\n\n_${action.suggested_message}_\n\n(copie e envie, ou use o botão WhatsApp na plataforma em Agentes)`
      : "Conclua a execução na plataforma, em *Inteligência → Agentes*.")
  );
}
