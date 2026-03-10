import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
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

    const remoteJid = key?.remoteJid || "";
    const instanceName = body.instance;
    const messageId = key?.id || "";

    // ── Ignorar mensagens de grupos ───────────────────────────────────────────
    if (remoteJid.endsWith("@g.us")) {
      return new Response(JSON.stringify({ ok: true, skipped: "group" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const phoneNumber = remoteJid.replace("@s.whatsapp.net", "");

    // ── Lookup da instância e empresa ANTES de processar mídia ────────────────
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

    // ── Extrair credenciais Evolution do config ──────────────────────────────
    const evolutionUrl = whatsappConfig.evolution_api_url || Deno.env.get("EVOLUTION_API_URL");
    const evolutionKey = whatsappConfig.evolution_api_key || Deno.env.get("EVOLUTION_API_KEY");

    if (!member) {
      await sendWhatsAppMessage(instanceName, remoteJid, "❌ Nenhum admin encontrado na empresa.", evolutionUrl, evolutionKey);
      return new Response(JSON.stringify({ ok: true, error: "no-admin" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Deduplicação: ignorar mensagem já processada ──────────────────────────
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

    let textContent = "";
    if (message?.conversation) {
      textContent = message.conversation;
    } else if (message?.extendedTextMessage?.text) {
      textContent = message.extendedTextMessage.text;
    } else if (message?.audioMessage) {
      try {
        await sendWhatsAppMessage(instanceName, remoteJid, "🎙️ _Transcrevendo seu áudio..._", evolutionUrl, evolutionKey);
        const audioBase64 = await getMediaBase64(instanceName, messageId, remoteJid, evolutionUrl, evolutionKey);
        if (!audioBase64) {
          await sendWhatsAppMessage(instanceName, remoteJid, "❌ Não consegui baixar o áudio. Tente enviar novamente.", evolutionUrl, evolutionKey);
          return new Response(JSON.stringify({ ok: true, error: "audio-download-failed" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const transcription = await transcribeAudio(audioBase64, message.audioMessage.mimetype || "audio/ogg");
        if (!transcription) {
          await sendWhatsAppMessage(instanceName, remoteJid, "❌ Não consegui transcrever o áudio. Tente enviar uma mensagem de texto.", evolutionUrl, evolutionKey);
          return new Response(JSON.stringify({ ok: true, error: "transcription-failed" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        textContent = transcription;
        console.log("Audio transcribed:", textContent.slice(0, 200));
      } catch (err) {
        console.error("Audio processing error:", err);
        await sendWhatsAppMessage(instanceName, remoteJid, "❌ Erro ao processar o áudio. Tente novamente.", evolutionUrl, evolutionKey);
        return new Response(JSON.stringify({ ok: true, error: "audio-error" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else if (message?.imageMessage) {
      try {
        await sendWhatsAppMessage(instanceName, remoteJid, "📸 _Analisando sua imagem..._", evolutionUrl, evolutionKey);
        const imageBase64 = await getMediaBase64(instanceName, messageId, remoteJid, evolutionUrl, evolutionKey);
        if (!imageBase64) {
          await sendWhatsAppMessage(instanceName, remoteJid, "❌ Não consegui baixar a imagem. Tente enviar novamente.", evolutionUrl, evolutionKey);
          return new Response(JSON.stringify({ ok: true, error: "image-download-failed" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const imageDescription = await analyzeDocumentImage(imageBase64, message.imageMessage.mimetype || "image/jpeg");
        if (!imageDescription) {
          await sendWhatsAppMessage(instanceName, remoteJid, "❌ Não consegui analisar a imagem. Tente enviar uma foto mais nítida.", evolutionUrl, evolutionKey);
          return new Response(JSON.stringify({ ok: true, error: "image-analysis-failed" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const caption = message.imageMessage.caption || "";
        textContent = `[DOCUMENTO ESCANEADO]\n${imageDescription}${caption ? `\n\nMensagem do usuário: ${caption}` : "\n\nO usuário enviou este documento. Apresente os dados extraídos e pergunte se deseja criar um lançamento."}`;
        console.log("Image analyzed:", textContent.slice(0, 300));
      } catch (err) {
        console.error("Image processing error:", err);
        await sendWhatsAppMessage(instanceName, remoteJid, "❌ Erro ao processar a imagem. Tente novamente.", evolutionUrl, evolutionKey);
        return new Response(JSON.stringify({ ok: true, error: "image-error" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      await sendWhatsAppMessage(instanceName, remoteJid,
        "🤖 Consigo processar *texto*, *áudio* e *imagens de documentos*! Envie uma descrição, um áudio ou foto de boleto/nota/recibo.",
        evolutionUrl, evolutionKey
      );
      return new Response(JSON.stringify({ ok: true, skipped: "non-text" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const companyId = whatsappConfig.company_id;
    const companyName = (whatsappConfig.companies as any)?.name || "sua empresa";
    const userId = member.user_id;

    // ── Verificar se há pending action para este número ──────────────────────
    const { data: pendingRecord } = await supabase
      .from("whatsapp_pending_actions")
      .select("*")
      .eq("phone_number", phoneNumber)
      .eq("company_id", companyId)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (pendingRecord && isConfirmationReply(textContent)) {
      await executePendingAction({
        pending: pendingRecord,
        reply: textContent.trim().toLowerCase(),
        instanceName,
        remoteJid,
        supabase,
        today: new Date().toISOString().split("T")[0],
        evolutionUrl,
        evolutionKey,
      });
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Rodar o agente financeiro ─────────────────────────────────────────────
    await runFinancialAgent({
      text: textContent,
      companyId,
      companyName,
      userId,
      instanceName,
      remoteJid,
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

// ─── PENDING ACTION HELPERS ───────────────────────────────────────────────────

function isConfirmationReply(text: string): boolean {
  const t = text.trim().toLowerCase();
  return ["0", "1", "2", "sim", "não", "nao", "pessoal", "empresa", "confirmar", "cancelar", "ok", "cancel"].includes(t);
}

async function executePendingAction({
  pending, reply, instanceName, remoteJid, supabase, today, evolutionUrl, evolutionKey,
}: {
  pending: any;
  reply: string;
  instanceName: string;
  remoteJid: string;
  supabase: any;
  today: string;
  evolutionUrl: string | undefined;
  evolutionKey: string | undefined;
}) {
  // Deletar o pending independentemente do resultado
  await supabase.from("whatsapp_pending_actions").delete().eq("id", pending.id);

  if (["0", "cancelar", "cancel", "não", "nao"].includes(reply)) {
    await sendWhatsAppMessage(instanceName, remoteJid, "✅ Lançamento cancelado.", evolutionUrl, evolutionKey);
    return;
  }

  const action = pending.pending_action;
  const forceSide = ["1", "pessoal"].includes(reply) ? "pf" : ["2", "empresa"].includes(reply) ? "pj" : action.side;
  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const paymentSource = action.payment_source as "pf" | "pj" | "unknown" | undefined;

  if (forceSide === "pf") {
    await insertPfTransaction({ supabase, action, userId: pending.user_id, today });

    // MISTO normal: usuário confirmou PF mas pagou com conta da empresa → criar retirada
    if (paymentSource === "pj") {
      const { error: ownerErr } = await supabase.functions.invoke("owner-transactions", {
        body: {
          transaction_type: "retirada",
          amount: Math.abs(action.amount),
          date: action.date || today,
          description: `Retirada — gasto pessoal pago pela empresa: ${action.description}`,
          pf_account_id: action.pf_account_id || null,
          pj_bank_account_id: action.pj_bank_account_id || null,
          user_id: pending.user_id,
          company_id: pending.company_id,
        },
      });
      if (ownerErr) console.error("Owner transaction (retirada) error:", ownerErr);
    }

    await sendWhatsAppMessage(instanceName, remoteJid,
      `✅ *Lançamento Pessoal registrado!*\n\n` +
      `💰 *Valor:* ${fmt(action.amount)}\n` +
      `📝 *Descrição:* ${action.description}\n` +
      `📅 *Data:* ${action.date || today}\n` +
      `_Registrado no módulo Pessoal (PF)._` +
      (paymentSource === "pj" ? `\n_⚠️ Retirada criada para manter separação patrimonial._` : ""),
      evolutionUrl, evolutionKey
    );
  } else {
    await insertPjTransaction({ supabase, action, companyId: pending.company_id, userId: pending.user_id, today });

    // MISTO reverso: usuário confirmou PJ mas pagou do próprio bolso → criar aporte
    if (paymentSource === "pf") {
      const { error: ownerErr } = await supabase.functions.invoke("owner-transactions", {
        body: {
          transaction_type: "aporte",
          amount: Math.abs(action.amount),
          date: action.date || today,
          description: `Aporte — despesa empresarial paga com recursos pessoais: ${action.description}`,
          pf_account_id: action.pf_account_id || null,
          pj_bank_account_id: action.pj_bank_account_id || null,
          user_id: pending.user_id,
          company_id: pending.company_id,
        },
      });
      if (ownerErr) console.error("Owner transaction (aporte) error:", ownerErr);
    }

    await sendWhatsAppMessage(instanceName, remoteJid,
      `✅ *Lançamento Empresarial registrado!*\n\n` +
      `💰 *Valor:* ${fmt(action.amount)}\n` +
      `📝 *Descrição:* ${action.description}\n` +
      `📅 *Data:* ${action.date || today}\n` +
      `_Registrado no módulo Empresa (PJ)._` +
      (paymentSource === "pf" ? `\n_⚠️ Aporte criado para reembolsar seus recursos pessoais._` : ""),
      evolutionUrl, evolutionKey
    );
  }
}

// ─── INSERT HELPERS ───────────────────────────────────────────────────────────

async function insertPfTransaction({ supabase, action, userId, today }: {
  supabase: any; action: any; userId: string; today: string;
}) {
  const { error } = await supabase.from("personal_transactions").insert({
    user_id: userId,
    title: action.description || "Lançamento via WhatsApp",
    amount: Math.abs(action.amount),
    type: action.type === "revenue" ? "receita" : "despesa",
    date: action.date || today,
    description: action.description,
    category_id: action.pf_category_id || null,
    account_id: action.pf_account_id || null,
    source: "whatsapp",
    status: "confirmed",
  });
  if (error) console.error("PF transaction insert error:", error);
  return error;
}

async function insertPjTransaction({ supabase, action, companyId, userId, today }: {
  supabase: any; action: any; companyId: string; userId: string; today: string;
}) {
  const { error } = await supabase.from("transactions").insert({
    company_id: companyId,
    user_id: userId,
    description: action.description || "Lançamento via WhatsApp",
    amount: Math.abs(action.amount),
    type: action.type,
    date: action.date || today,
    source: "whatsapp",
    status: "confirmed",
    account_id: action.pj_account_id || null,
    cost_center_id: action.pj_cost_center_id || null,
    bank_account_id: action.pj_bank_account_id || null,
  });
  if (error) console.error("PJ transaction insert error:", error);
  return error;
}

// ─── AI AGENT ────────────────────────────────────────────────────────────────

interface AgentContext {
  text: string;
  companyId: string;
  companyName: string;
  userId: string;
  instanceName: string;
  remoteJid: string;
  phoneNumber: string;
  messageId: string;
  configId: string;
  supabase: any;
}

async function runFinancialAgent(ctx: AgentContext) {
  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!lovableApiKey) {
    await sendWhatsAppMessage(ctx.instanceName, ctx.remoteJid, "❌ Configuração de IA não encontrada.");
    return;
  }

  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const monthName = now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  // ── Carregar contexto PJ ──────────────────────────────────────────────────
  const [accountsRes, centersRes, recentTxRes, bankAccountsRes] = await Promise.all([
    ctx.supabase.from("chart_of_accounts").select("id, name, code, type").eq("company_id", ctx.companyId),
    ctx.supabase.from("cost_centers").select("id, name, category").eq("company_id", ctx.companyId).eq("active", true),
    ctx.supabase.from("transactions")
      .select("type, amount, description, date, status, chart_of_accounts(name, code), cost_centers(name)")
      .eq("company_id", ctx.companyId)
      .order("date", { ascending: false })
      .limit(50),
    ctx.supabase.from("bank_accounts").select("id, name, bank_name").eq("company_id", ctx.companyId).limit(5),
  ]);

  const accounts = accountsRes.data || [];
  const centers = centersRes.data || [];
  const recentTx = recentTxRes.data || [];
  const bankAccounts = bankAccountsRes.data || [];

  // ── Carregar contexto PF ──────────────────────────────────────────────────
  const [pfCategoriesRes, pfAccountsRes, pfRecentTxRes] = await Promise.all([
    ctx.supabase.from("personal_categories")
      .select("id, name, type")
      .or(`user_id.eq.${ctx.userId},user_id.is.null`)
      .order("name"),
    ctx.supabase.from("personal_accounts")
      .select("id, name, type, current_balance")
      .eq("user_id", ctx.userId)
      .eq("is_active", true),
    ctx.supabase.from("personal_transactions")
      .select("type, amount, title, date, personal_categories(name)")
      .eq("user_id", ctx.userId)
      .order("date", { ascending: false })
      .limit(20),
  ]);

  const pfCategories = pfCategoriesRes.data || [];
  const pfAccounts = pfAccountsRes.data || [];
  const pfRecentTx = pfRecentTxRes.data || [];
  const defaultPfAccount = pfAccounts.find((a: any) => a.name === "Carteira") || pfAccounts[0];
  const defaultBankAccount = bankAccounts[0];

  // ── Resumo financeiro mensal PJ ───────────────────────────────────────────
  const monthTx = recentTx.filter((t: any) => t.date >= firstDay && t.date <= today);
  const revenue = monthTx.filter((t: any) => t.type === "revenue").reduce((s: number, t: any) => s + Number(t.amount), 0);
  const expense = monthTx.filter((t: any) => t.type === "expense").reduce((s: number, t: any) => s + Number(t.amount), 0);
  const balance = revenue - expense;
  const margin = revenue > 0 ? ((balance / revenue) * 100).toFixed(1) : "0";

  const expenseByAccount: Record<string, number> = {};
  const revenueByAccount: Record<string, number> = {};
  for (const t of monthTx) {
    const name = t.chart_of_accounts?.name || "Sem classificação";
    const map = t.type === "expense" ? expenseByAccount : revenueByAccount;
    map[name] = (map[name] || 0) + Number(t.amount);
  }

  const accountsList = accounts.map((a: any) => `${a.code} ${a.name} (${a.type}) [id:${a.id}]`).join("\n");
  const centersList = centers.map((c: any) => `${c.name} (${c.category}) [id:${c.id}]`).join("\n");
  const bankAccountsList = bankAccounts.map((b: any) => `${b.name} - ${b.bank_name} [id:${b.id}]`).join("\n");

  const expenseBreakdown = Object.entries(expenseByAccount).map(([n, v]) => `  • ${n}: ${fmt(v)}`).join("\n");
  const revenueBreakdown = Object.entries(revenueByAccount).map(([n, v]) => `  • ${n}: ${fmt(v)}`).join("\n");
  const recentTxList = monthTx.slice(0, 10).map((t: any) =>
    `${t.date} | ${t.type === "revenue" ? "📈" : "📉"} ${fmt(Number(t.amount))} | ${t.description} | ${t.chart_of_accounts?.name || "-"} | ${t.status}`
  ).join("\n");

  // ── Resumo PF ─────────────────────────────────────────────────────────────
  const pfCategoriesList = pfCategories.map((c: any) => `${c.name} (${c.type}) [id:${c.id}]`).join("\n");
  const pfAccountsList = pfAccounts.map((a: any) => `${a.name} - Saldo: ${fmt(Number(a.current_balance))} [id:${a.id}]`).join("\n");
  const pfRecentTxList = pfRecentTx.slice(0, 10).map((t: any) =>
    `${t.date} | ${t.type === "receita" ? "📈" : "📉"} ${fmt(Number(t.amount))} | ${t.title} | ${(t.personal_categories as any)?.name || "-"}`
  ).join("\n");

  const systemPrompt = `Você é o *CFO Digital*, o assistente financeiro inteligente da empresa *${ctx.companyName}* no WhatsApp.

Você é proativo, organizado e comunica tudo de forma clara usando formatação WhatsApp (*negrito*, _itálico_).

## SEU PAPEL PRINCIPAL — SEPARAÇÃO PATRIMONIAL PF/PJ

Toda vez que o usuário mencionar um gasto ou receita, você DEVE classificar automaticamente se é:
- **PJ (Empresa)**: gastos empresariais (fornecedores, funcionários, ferramentas de trabalho, despesas operacionais, clientes)
- **PF (Pessoal)**: gastos pessoais (supermercado, farmácia, escola, saúde pessoal, lazer, restaurante sem CNPJ, vestuário)
- **MISTO**: pago com conta empresarial mas gasto é pessoal (ou vice-versa)

### Regras de Classificação:
PESSOAL (PF): supermercado, mercado, farmácia, escola, academia, restaurante/lanche (uso pessoal), saúde, dentista, roupa, lazer, streaming pessoal, combustível pessoal, seguro do carro pessoal, moradia pessoal, mesada
EMPRESARIAL (PJ): fornecedor B2B, software de trabalho, funcionários/RH, aluguel comercial, marketing, matéria-prima, contador, advogado PJ, equipamento de trabalho, viagem de negócios, cliente recebimento
MISTO: "comprei notebook pela empresa para uso pessoal", "paguei mercado no cartão da empresa", "usei dinheiro pessoal para pagar fornecedor"

### Confiança:
- HIGH: gasto claramente PF ou PJ sem ambiguidade
- MEDIUM: tem contexto mas pode ser dos dois lados
- LOW: sem contexto suficiente

---

## Dados da Empresa (PJ) — ${monthName}:
📈 Receita: ${fmt(revenue)}
${revenueBreakdown || "  Nenhuma receita"}
📉 Despesas: ${fmt(expense)}
${expenseBreakdown || "  Nenhuma despesa"}
💰 Saldo: ${fmt(balance)} | Margem: ${margin}%

Últimos lançamentos PJ:
${recentTxList || "Nenhum lançamento"}

Plano de contas PJ:
${accountsList || "Nenhuma conta"}

Centros de custo:
${centersList || "Nenhum centro"}

Contas bancárias PJ:
${bankAccountsList || "Nenhuma conta bancária"}

---

## Dados Pessoais (PF):
Contas pessoais (use o nome mencionado pelo usuário para selecionar o pf_account_id correto):
${pfAccountsList || "Nenhuma conta pessoal"}

Categorias PF disponíveis:
${pfCategoriesList || "Nenhuma categoria"}

Últimos lançamentos PF:
${pfRecentTxList || "Nenhum lançamento pessoal"}

---

## Como Responder:

### Para lançamentos com ALTA confiança (high):
Classifique e registre automaticamente. Confirme com detalhes.
IMPORTANTE: sempre inclua "payment_source":"pf" ou "payment_source":"pj" nos actions, indicando de qual conta o pagamento foi feito.

Para PJ (pago com conta da empresa):
"✅ *Lançamento Empresarial registrado!*
💰 *Valor:* R$ X
📝 *Descrição:* ...
📂 *Conta:* ... | *Centro:* ...
📅 *Data:* ...
_Registrado como gasto da empresa._"
<ACTION>{"action":"create_pj_transaction","type":"expense","amount":X,"description":"...","pj_account_id":"...","pj_cost_center_id":"...","date":"YYYY-MM-DD","payment_source":"pj"}</ACTION>

Para PF (pago com conta pessoal):
"✅ *Lançamento Pessoal registrado!*
💰 *Valor:* R$ X
📝 *Descrição:* ...
📂 *Categoria:* ...
📅 *Data:* ...
_Registrado no módulo Pessoal._"
<ACTION>{"action":"create_pf_transaction","type":"despesa","amount":X,"description":"...","pf_category_id":"...","pf_account_id":"[id da conta pessoal mencionada ou ${defaultPfAccount?.id || ""}]","date":"YYYY-MM-DD","payment_source":"pf"}</ACTION>

Para MISTO (pago com conta PJ mas gasto é PF — ex: "paguei mercado no cartão da empresa"):
"⚠️ *Atenção patrimonial!*
Detectei que este gasto é *pessoal* mas foi pago com a conta da empresa.
Vou registrar como despesa pessoal e criar uma retirada para manter a separação patrimonial.
💰 *Valor:* R$ X | 📝 *Descrição:* ..."
<ACTION>{"action":"create_pf_transaction","type":"despesa","amount":X,"description":"...","pf_category_id":"...","pf_account_id":"${defaultPfAccount?.id || ""}","date":"YYYY-MM-DD","payment_source":"pj"}</ACTION>
<ACTION>{"action":"create_owner_transaction","transaction_type":"retirada","amount":X,"description":"Retirada — gasto pessoal pago pela empresa: ...","pf_account_id":"${defaultPfAccount?.id || ""}","pj_bank_account_id":"${defaultBankAccount?.id || ""}","date":"YYYY-MM-DD"}</ACTION>

Para MISTO REVERSO (pago com conta PF mas gasto é PJ — ex: "paguei o fornecedor do meu próprio bolso", "usei meu Pix pessoal para pagar despesa da empresa"):
"⚠️ *Atenção patrimonial!*
Detectei que este gasto é *empresarial* mas foi pago com recursos pessoais.
Vou registrar como despesa da empresa e criar um aporte para que a empresa reembolse você.
💰 *Valor:* R$ X | 📝 *Descrição:* ..."
<ACTION>{"action":"create_pj_transaction","type":"expense","amount":X,"description":"...","pj_account_id":"...","pj_cost_center_id":"...","pj_bank_account_id":"${defaultBankAccount?.id || ""}","date":"YYYY-MM-DD","payment_source":"pf"}</ACTION>
<ACTION>{"action":"create_owner_transaction","transaction_type":"aporte","amount":X,"description":"Aporte — despesa empresarial paga com recursos pessoais: ...","pf_account_id":"${defaultPfAccount?.id || ""}","pj_bank_account_id":"${defaultBankAccount?.id || ""}","date":"YYYY-MM-DD"}</ACTION>

### Para lançamentos com confiança MÉDIA ou BAIXA:
Pergunte antes de lançar. Inclua sempre "payment_source" na action com o que você inferiu.
"❓ *Preciso de uma confirmação:*
💰 *Valor:* R$ X
📝 *Descrição:* ...
🤔 [Motivo da dúvida]
Responda:
*1* → Pessoal (PF)
*2* → Empresa (PJ)
*0* → Cancelar"
<ACTION>{"action":"ask_confirmation","amount":X,"description":"...","type":"expense","pf_category_id":"...","pf_account_id":"${defaultPfAccount?.id || ""}","pj_account_id":"...","pj_cost_center_id":"...","pj_bank_account_id":"${defaultBankAccount?.id || ""}","date":"YYYY-MM-DD","reason":"...","payment_source":"pf|pj|unknown"}</ACTION>

### Para consultas e relatórios:
Responda com dados reais. Organize com emojis e formatação.

### Para DRE:
Monte a DRE e inclua <ACTION>{"action":"send_chart"}</ACTION>

### Para Resumo Executivo:
<ACTION>{"action":"send_executive_summary"}</ACTION>

### Para Previsão de Fluxo de Caixa:
<ACTION>{"action":"send_cashflow_forecast"}</ACTION>

### Regras:
- SEMPRE responda em português brasileiro
- SEMPRE use formatação WhatsApp
- SEMPRE classifique PF ou PJ em lançamentos
- SEMPRE inclua payment_source nos actions de transação
- NÃO misture patrimônio pessoal com empresarial
- Se a mensagem não for financeira, responda educadamente e ofereça ajuda`;

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

    // Extrair ações
    const actionMatches = aiResponse.matchAll(/<ACTION>(.*?)<\/ACTION>/gs);
    const actions: any[] = [];
    for (const match of actionMatches) {
      try { actions.push(JSON.parse(match[1])); } catch { /* skip */ }
    }

    // Enviar resposta limpa
    const cleanResponse = aiResponse.replace(/<ACTION>.*?<\/ACTION>/gs, "").trim();
    if (cleanResponse) {
      await sendWhatsAppMessage(ctx.instanceName, ctx.remoteJid, cleanResponse);
    }

    // Processar ações
    for (const action of actions) {
      if (action.action === "create_pj_transaction") {
        const err = await insertPjTransaction({
          supabase: ctx.supabase, action,
          companyId: ctx.companyId, userId: ctx.userId, today,
        });
        if (err) {
          await sendWhatsAppMessage(ctx.instanceName, ctx.remoteJid,
            `⚠️ Classificado mas erro ao salvar PJ: ${err.message}`
          );
        }

      } else if (action.action === "create_pf_transaction") {
        const err = await insertPfTransaction({
          supabase: ctx.supabase, action, userId: ctx.userId, today,
        });
        if (err) {
          await sendWhatsAppMessage(ctx.instanceName, ctx.remoteJid,
            `⚠️ Classificado mas erro ao salvar PF: ${err.message}`
          );
        }

      } else if (action.action === "create_owner_transaction") {
        // Chama a edge function owner-transactions para operação atômica PF↔PJ
        const { error: ownerErr } = await ctx.supabase.functions.invoke("owner-transactions", {
          body: {
            transaction_type: action.transaction_type || "retirada",
            amount: Math.abs(action.amount),
            date: action.date || today,
            description: action.description,
            pf_account_id: action.pf_account_id || null,
            pj_bank_account_id: action.pj_bank_account_id || null,
            user_id: ctx.userId,
            company_id: ctx.companyId,
          },
        });
        if (ownerErr) {
          console.error("Owner transaction error:", ownerErr);
          await sendWhatsAppMessage(ctx.instanceName, ctx.remoteJid,
            `⚠️ Lançamento PF criado, mas erro ao criar a retirada: ${ownerErr.message}`
          );
        }

      } else if (action.action === "ask_confirmation") {
        // Salvar pending action e enviar pergunta
        await ctx.supabase.from("whatsapp_pending_actions").delete()
          .eq("phone_number", ctx.phoneNumber)
          .eq("company_id", ctx.companyId);

        await ctx.supabase.from("whatsapp_pending_actions").insert({
          company_id: ctx.companyId,
          user_id: ctx.userId,
          phone_number: ctx.phoneNumber,
          instance_name: ctx.instanceName,
          pending_action: action,
        });

      } else if (action.action === "send_chart") {
        try {
          const chartData = { revenue, expense, balance, expenseByAccount, revenueByAccount, month: monthName };
          const imageBase64 = await generateFinancialChart(chartData, lovableApiKey);
          if (imageBase64) {
            await sendWhatsAppImage(ctx.instanceName, ctx.remoteJid, imageBase64, `📊 Dashboard Financeiro — ${monthName}`);
          }
        } catch (chartErr) { console.error("Chart generation error:", chartErr); }

      } else if (action.action === "send_executive_summary") {
        try {
          await sendWhatsAppMessage(ctx.instanceName, ctx.remoteJid, "📝 _Gerando seu resumo executivo... aguarde._");
          const summaryText = await generateExecutiveSummary(ctx.companyId, ctx.supabase, lovableApiKey);
          if (summaryText) {
            for (const chunk of splitMessage(summaryText, 3800)) {
              await sendWhatsAppMessage(ctx.instanceName, ctx.remoteJid, chunk);
            }
          } else {
            await sendWhatsAppMessage(ctx.instanceName, ctx.remoteJid, "⚠️ Não foi possível gerar o resumo executivo.");
          }
        } catch (err) { console.error("Executive summary error:", err); }

      } else if (action.action === "send_cashflow_forecast") {
        try {
          await sendWhatsAppMessage(ctx.instanceName, ctx.remoteJid, "📊 _Analisando dados e gerando previsão de fluxo de caixa..._");
          const forecastResult = await generateCashFlowForecast(ctx.companyId, ctx.supabase, lovableApiKey);
          if (forecastResult) {
            await sendWhatsAppMessage(ctx.instanceName, ctx.remoteJid, forecastResult.text);
            if (forecastResult.chartData) {
              const imageBase64 = await generateForecastChart(forecastResult.chartData, lovableApiKey);
              if (imageBase64) {
                await sendWhatsAppImage(ctx.instanceName, ctx.remoteJid, imageBase64, "📈 Previsão de Fluxo de Caixa — Próximos 3 meses");
              }
            }
          } else {
            await sendWhatsAppMessage(ctx.instanceName, ctx.remoteJid, "⚠️ Não foi possível gerar a previsão.");
          }
        } catch (err) { console.error("Cashflow forecast error:", err); }
      }
    }

    // Log da interação
    await ctx.supabase.from("whatsapp_messages").insert({
      company_id: ctx.companyId,
      config_id: ctx.configId,
      phone_number: ctx.phoneNumber,
      direction: "inbound",
      message_text: ctx.text,
      message_type: "text",
      processed: true,
      message_id: ctx.messageId || null,
      classification: { actions, aiModel: "gemini-2.5-flash" },
    });

  } catch (err) {
    console.error("Agent error:", err);
    await sendWhatsAppMessage(ctx.instanceName, ctx.remoteJid,
      "❌ Ocorreu um erro inesperado. Tente novamente em instantes."
    );
  }
}

// ─── AUDIO PROCESSING ─────────────────────────────────────────────────────────

async function getMediaBase64(instanceName: string, messageId: string, remoteJid: string): Promise<string | null> {
  const evolutionUrl = Deno.env.get("EVOLUTION_API_URL");
  const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");
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

// ─── CHART & REPORT GENERATION ───────────────────────────────────────────────

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

async function generateExecutiveSummary(companyId: string, supabase: any, apiKey: string): Promise<string | null> {
  const now = new Date();
  const curStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const curEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
  const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split("T")[0];
  const prevEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split("T")[0];

  const [curRes, prevRes, companyRes] = await Promise.all([
    supabase.from("transactions").select("amount, type, description, date, chart_of_accounts(name, code), cost_centers(name)").eq("company_id", companyId).eq("status", "confirmed").gte("date", curStart).lte("date", curEnd),
    supabase.from("transactions").select("amount, type, description, chart_of_accounts(name, code), cost_centers(name)").eq("company_id", companyId).eq("status", "confirmed").gte("date", prevStart).lte("date", prevEnd),
    supabase.from("companies").select("name").eq("id", companyId).single(),
  ]);

  const cur = curRes.data || [];
  const prev = prevRes.data || [];
  const companyName = companyRes.data?.name || "Empresa";
  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const curRevenue = cur.filter((t: any) => t.type === "revenue").reduce((s: number, t: any) => s + Number(t.amount), 0);
  const curExpense = cur.filter((t: any) => t.type === "expense").reduce((s: number, t: any) => s + Number(t.amount), 0);
  const prevRevenue = prev.filter((t: any) => t.type === "revenue").reduce((s: number, t: any) => s + Number(t.amount), 0);
  const prevExpense = prev.filter((t: any) => t.type === "expense").reduce((s: number, t: any) => s + Number(t.amount), 0);

  const expByAccount: Record<string, number> = {};
  const revByAccount: Record<string, number> = {};
  for (const t of cur) {
    const name = (t as any).chart_of_accounts?.name || "Sem classificação";
    const amount = Number(t.amount);
    if (t.type === "expense") expByAccount[name] = (expByAccount[name] || 0) + amount;
    else revByAccount[name] = (revByAccount[name] || 0) + amount;
  }

  const monthName = now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const prevMonthName = new Date(now.getFullYear(), now.getMonth() - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  const prompt = `Gere um resumo executivo para WhatsApp da empresa "${companyName}".

Dados de ${monthName}: Receita ${fmt(curRevenue)}, Despesas ${fmt(curExpense)}, Resultado ${fmt(curRevenue - curExpense)}, Margem ${curRevenue > 0 ? ((curRevenue - curExpense) / curRevenue * 100).toFixed(1) : "0"}%
Receitas: ${Object.entries(revByAccount).map(([n, v]) => `${n}: ${fmt(v)}`).join(", ") || "Nenhuma"}
Despesas: ${Object.entries(expByAccount).map(([n, v]) => `${n}: ${fmt(v)}`).join(", ") || "Nenhuma"}

Mês anterior (${prevMonthName}): Receita ${fmt(prevRevenue)}, Despesas ${fmt(prevExpense)}, Resultado ${fmt(prevRevenue - prevExpense)}

Formate para WhatsApp usando *negrito*, _itálico_, emojis. Inclua:
1. Visão geral do mês
2. Destaques positivos
3. Pontos de atenção
4. Comparativo vs mês anterior com %
5. 3 recomendações práticas
Seja direto e profissional.`;

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: "google/gemini-2.5-flash", messages: [{ role: "system", content: "Você é um CFO que gera resumos executivos claros para WhatsApp." }, { role: "user", content: prompt }], temperature: 0.4 }),
    });
    if (!res.ok) { console.error("Summary AI error:", res.status); return null; }
    const result = await res.json();
    return result.choices?.[0]?.message?.content || null;
  } catch (err) { console.error("Executive summary generation error:", err); return null; }
}

async function generateCashFlowForecast(companyId: string, supabase: any, apiKey: string): Promise<{ text: string; chartData: any } | null> {
  const now = new Date();
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);
  const startDate = sixMonthsAgo.toISOString().split("T")[0];
  const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

  const { data: transactions } = await supabase.from("transactions").select("date, amount, type").eq("company_id", companyId).eq("status", "confirmed").gte("date", startDate).order("date", { ascending: true });

  const txData = transactions || [];
  const monthlyData: Record<string, { revenue: number; expense: number }> = {};
  for (const t of txData) {
    const key = t.date.slice(0, 7);
    if (!monthlyData[key]) monthlyData[key] = { revenue: 0, expense: 0 };
    if (t.type === "revenue") monthlyData[key].revenue += Number(t.amount);
    else monthlyData[key].expense += Number(t.amount);
  }

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const monthSummary = Object.entries(monthlyData).sort(([a], [b]) => a.localeCompare(b)).map(([key, val]) => {
    const [y, m] = key.split("-");
    return `${monthNames[parseInt(m) - 1]}/${y}: Receita ${fmt(val.revenue)}, Despesa ${fmt(val.expense)}`;
  }).join("\n");

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: `Você é um analista financeiro. Baseado nos dados históricos, gere previsão de 3 meses. Responda APENAS com JSON: {"forecast":[{"month":"Mês/Ano","projected_revenue":N,"projected_expense":N,"confidence":"high|medium|low"}],"insights":["insight1","insight2","insight3"],"risk_level":"low|medium|high","risk_explanation":"explicação"}` },
          { role: "user", content: `Dados históricos:\n${monthSummary || "Sem dados"}` },
        ],
        temperature: 0.3,
      }),
    });
    if (!res.ok) { console.error("Forecast AI error:", res.status); return null; }
    const result = await res.json();
    const content = result.choices?.[0]?.message?.content || "";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const forecast = JSON.parse(jsonMatch[0]);
    const riskLabel = forecast.risk_level === "low" ? "🟢 Baixo" : forecast.risk_level === "high" ? "🔴 Alto" : "🟡 Médio";
    const confLabel = (c: string) => c === "high" ? "Alta" : c === "medium" ? "Média" : "Baixa";

    let text = `📊 *Previsão de Fluxo de Caixa*\n_Próximos 3 meses_\n\n`;
    for (const f of forecast.forecast || []) {
      const saldo = f.projected_revenue - f.projected_expense;
      text += `*${f.month}*\n📈 Receita: ${fmt(f.projected_revenue)}\n📉 Despesa: ${fmt(f.projected_expense)}\n💰 Saldo: ${fmt(saldo)}\n🎯 Confiança: ${confLabel(f.confidence)}\n\n`;
    }
    text += `⚠️ *Nível de Risco:* ${riskLabel}\n${forecast.risk_explanation || ""}\n\n`;
    text += `💡 *Insights:*\n`;
    for (const ins of forecast.insights || []) text += `• ${ins}\n`;

    return { text, chartData: { history: monthlyData, forecast: forecast.forecast, monthNames } };
  } catch (err) { console.error("Forecast generation error:", err); return null; }
}

async function generateForecastChart(chartData: any, apiKey: string): Promise<string | null> {
  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const monthNames = chartData.monthNames;

  const historyLines = Object.entries(chartData.history as Record<string, { revenue: number; expense: number }>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, val]) => {
      const [y, m] = key.split("-");
      return `${monthNames[parseInt(m) - 1]}/${y.slice(2)}: Receita ${fmt(val.revenue)}, Despesa ${fmt(val.expense)}`;
    }).join("\n");

  const forecastLines = (chartData.forecast || []).map((f: any) =>
    `${f.month}: Receita ${fmt(f.projected_revenue)}, Despesa ${fmt(f.projected_expense)} (confiança: ${f.confidence})`
  ).join("\n");

  const prompt = `Create a clean, professional cash flow forecast chart image in Portuguese (Brazil) with dark background (#1a1a2e).
Title: "Previsão de Fluxo de Caixa — Próximos 3 Meses"
Show a bar chart with:
1. Historical months (solid bars): ${historyLines || "No historical data"}
2. Projected months (semi-transparent bars): ${forecastLines || "No forecast data"}
Use green (#10b981) for revenue, red (#ef4444) for expenses.
Add a trend line showing the net balance.
Style: Modern fintech, 16:9 landscape, rounded corners, clean typography. No watermarks.`;

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: "google/gemini-2.5-flash-image", messages: [{ role: "user", content: prompt }], modalities: ["image", "text"] }),
    });
    if (!res.ok) { console.error("Forecast chart AI error:", res.status); return null; }
    const result = await res.json();
    const imageUrl = result.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!imageUrl) return null;
    return imageUrl.replace(/^data:image\/\w+;base64,/, "");
  } catch (err) { console.error("Forecast chart error:", err); return null; }
}

async function generateFinancialChart(chartData: any, lovableApiKey: string): Promise<string | null> {
  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const expenseLines = Object.entries(chartData.expenseByAccount).map(([n, v]) => `${n}: ${fmt(v as number)}`).join(", ");
  const revenueLines = Object.entries(chartData.revenueByAccount).map(([n, v]) => `${n}: ${fmt(v as number)}`).join(", ");

  const prompt = `Create a clean, professional financial dashboard chart image in Portuguese (Brazil) with a dark background (#1a1a2e) and vibrant colors.
Title: "Resumo Financeiro — ${chartData.month}"
Show:
1. Horizontal bar chart: Receitas (green #10b981, total ${fmt(chartData.revenue)}) vs Despesas (red #ef4444, total ${fmt(chartData.expense)})
2. Donut chart expense breakdown: ${expenseLines || "Sem dados"}
3. KPI card "Saldo: ${fmt(chartData.balance)}" in ${chartData.balance >= 0 ? "green" : "red"}
4. Revenue breakdown: ${revenueLines || "Sem dados"}
Style: Modern fintech dashboard, rounded corners, subtle gradients, clean typography. 16:9 ratio. No watermarks.`;

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
