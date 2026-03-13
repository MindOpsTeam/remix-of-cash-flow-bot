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




    const remoteJid = key?.remoteJid || "";
    const instanceName = body.instance;
    const messageId = key?.id || "";

    // ── Lookup da instância e empresa ANTES de filtrar ────────────────────────
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

    // ── Filtro de grupo dedicado ─────────────────────────────────────────────
    const isGroup = remoteJid.endsWith("@g.us");
    const configuredGroupJid = whatsappConfig.group_jid;

    if (!configuredGroupJid) {
      console.log("No group_jid configured, skipping all messages");
      return new Response(JSON.stringify({ ok: true, skipped: "no-group-configured" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Ignorar mensagens privadas (DMs) — só processar grupo
    if (!isGroup) {
      return new Response(JSON.stringify({ ok: true, skipped: "not-group" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Ignorar mensagens de outros grupos
    if (remoteJid !== configuredGroupJid) {
      return new Response(JSON.stringify({ ok: true, skipped: "wrong-group" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Ignorar mensagens enviadas pelo próprio bot
    if (key?.fromMe === true) {
      return new Response(JSON.stringify({ ok: true, skipped: "from-bot" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Em grupos, o remetente real vem em key.participant
    const phoneNumber = (key?.participant || "").replace("@s.whatsapp.net", "").replace(/\D/g, "");
    // Respostas vão para o grupo
    const replyJid = configuredGroupJid;

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
      await sendWhatsAppMessage(instanceName, replyJid, "❌ Nenhum admin encontrado na empresa.", evolutionUrl, evolutionKey);
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
        textContent = `[DOCUMENTO ESCANEADO]\n${imageDescription}${caption ? `\n\nMensagem do usuário: ${caption}` : "\n\nO usuário enviou este documento. Apresente os dados extraídos e pergunte se deseja criar um lançamento."}`;
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
        remoteJid: replyJid,
        supabase,
        today: new Date().toISOString().split("T")[0],
        evolutionUrl,
        evolutionKey,
      });
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Serialização: bloquear se já existe pending para este telefone ────────
    if (pendingRecord) {
      await sendWhatsAppMessage(instanceName, replyJid,
        "⏳ Responda a pergunta anterior primeiro (1, 2 ou 0 para cancelar).",
        evolutionUrl, evolutionKey
      );
      return new Response(JSON.stringify({ ok: true, skipped: "pending-exists" }), {
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

// ─── PENDING ACTION HELPERS ───────────────────────────────────────────────────

function isConfirmationReply(text: string): boolean {
  const t = text.trim().toLowerCase();
  return ["0", "1", "2", "3", "sim", "não", "nao", "pessoal", "empresa", "confirmar", "cancelar", "ok", "cancel"].includes(t);
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
  const action = pending.pending_action;
  const step = action._step || "module"; // "module" | "payment_method" | "select_card" | "select_account"
  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  // ── Cancel at any step ──────────────────────────────────────────────────
  if (["0", "cancelar", "cancel", "não", "nao"].includes(reply)) {
    await supabase.from("whatsapp_pending_actions").delete().eq("id", pending.id);
    await sendWhatsAppMessage(instanceName, remoteJid, "✅ Lançamento cancelado.", evolutionUrl, evolutionKey);
    return;
  }

  // ── Step: payment_method (PF confirmed only) ────────────────────────────
  if (step === "payment_method") {
    await supabase.from("whatsapp_pending_actions").delete().eq("id", pending.id);

    if (["1", "cartão", "cartao"].includes(reply)) {
      // List credit cards and ask which one
      const { data: cards } = await supabase.from("personal_credit_cards")
        .select("id, name, brand")
        .eq("user_id", pending.user_id)
        .eq("is_active", true);
      
      if (!cards || cards.length === 0) {
        // No cards, insert without card
        await insertPfTransaction({ supabase, action, userId: pending.user_id, today });
        await sendPfConfirmation({ supabase, action, pending, instanceName, remoteJid, today, evolutionUrl, evolutionKey, fmt });
        return;
      }

      if (cards.length === 1) {
        // Only one card, use it directly
        action.pf_credit_card_id = cards[0].id;
        action.pf_account_id = null;
        await insertPfTransaction({ supabase, action, userId: pending.user_id, today });
        await sendPfConfirmation({ supabase, action, pending, instanceName, remoteJid, today, evolutionUrl, evolutionKey, fmt });
        return;
      }

      // Multiple cards — ask which one
      const cardList = cards.map((c: any, i: number) => `${i + 1}️⃣ ${c.name}${c.brand ? ` (${c.brand})` : ""}`).join("\n");
      action._step = "select_card";
      action._cards = cards.map((c: any) => c.id);
      await supabase.from("whatsapp_pending_actions").insert({
        company_id: pending.company_id,
        user_id: pending.user_id,
        phone_number: pending.phone_number,
        instance_name: instanceName,
        pending_action: action,
      });
      await sendWhatsAppMessage(instanceName, remoteJid, `💳 Em qual cartão?\n${cardList}\n0️⃣ Cancelar`, evolutionUrl, evolutionKey);
      return;

    } else if (["2", "pix", "débito", "debito"].includes(reply)) {
      // List accounts and ask which one
      const { data: accounts } = await supabase.from("personal_accounts")
        .select("id, name, current_balance")
        .eq("user_id", pending.user_id)
        .eq("is_active", true);
      
      if (!accounts || accounts.length === 0) {
        await insertPfTransaction({ supabase, action, userId: pending.user_id, today });
        await sendPfConfirmation({ supabase, action, pending, instanceName, remoteJid, today, evolutionUrl, evolutionKey, fmt });
        return;
      }

      if (accounts.length === 1) {
        action.pf_account_id = accounts[0].id;
        action.pf_credit_card_id = null;
        await insertPfTransaction({ supabase, action, userId: pending.user_id, today });
        await sendPfConfirmation({ supabase, action, pending, instanceName, remoteJid, today, evolutionUrl, evolutionKey, fmt });
        return;
      }

      const accList = accounts.map((a: any, i: number) => `${i + 1}️⃣ ${a.name} (${fmt(Number(a.current_balance))})`).join("\n");
      action._step = "select_account";
      action._accounts = accounts.map((a: any) => a.id);
      await supabase.from("whatsapp_pending_actions").insert({
        company_id: pending.company_id,
        user_id: pending.user_id,
        phone_number: pending.phone_number,
        instance_name: instanceName,
        pending_action: action,
      });
      await sendWhatsAppMessage(instanceName, remoteJid, `🏦 De qual conta?\n${accList}\n0️⃣ Cancelar`, evolutionUrl, evolutionKey);
      return;

    } else {
      // "3" or "dinheiro" — no account, no card
      action.pf_account_id = null;
      action.pf_credit_card_id = null;
      await insertPfTransaction({ supabase, action, userId: pending.user_id, today });
      await sendPfConfirmation({ supabase, action, pending, instanceName, remoteJid, today, evolutionUrl, evolutionKey, fmt });
      return;
    }
  }

  // ── Step: select_card ───────────────────────────────────────────────────
  if (step === "select_card") {
    await supabase.from("whatsapp_pending_actions").delete().eq("id", pending.id);
    const idx = parseInt(reply) - 1;
    const cards = action._cards || [];
    if (idx >= 0 && idx < cards.length) {
      action.pf_credit_card_id = cards[idx];
      action.pf_account_id = null;
    }
    await insertPfTransaction({ supabase, action, userId: pending.user_id, today });
    await sendPfConfirmation({ supabase, action, pending, instanceName, remoteJid, today, evolutionUrl, evolutionKey, fmt });
    return;
  }

  // ── Step: select_account ────────────────────────────────────────────────
  if (step === "select_account") {
    await supabase.from("whatsapp_pending_actions").delete().eq("id", pending.id);
    const idx = parseInt(reply) - 1;
    const accounts = action._accounts || [];
    if (idx >= 0 && idx < accounts.length) {
      action.pf_account_id = accounts[idx];
      action.pf_credit_card_id = null;
    }
    await insertPfTransaction({ supabase, action, userId: pending.user_id, today });
    await sendPfConfirmation({ supabase, action, pending, instanceName, remoteJid, today, evolutionUrl, evolutionKey, fmt });
    return;
  }

  // ── Step: module (default — user picking PF or PJ) ─────────────────────
  await supabase.from("whatsapp_pending_actions").delete().eq("id", pending.id);

  const forceSide = ["1", "pessoal"].includes(reply) ? "pf" : ["2", "empresa"].includes(reply) ? "pj" : action.side;
  const paymentSource = action.payment_source as "pf" | "pj" | "unknown" | undefined;

  if (forceSide === "pf") {
    const isPending = action.status === "pending";

    if (!isPending) {
      // PF confirmed → ask payment method (multi-step)
      action._step = "payment_method";
      action.side = "pf";
      await supabase.from("whatsapp_pending_actions").insert({
        company_id: pending.company_id,
        user_id: pending.user_id,
        phone_number: pending.phone_number,
        instance_name: instanceName,
        pending_action: action,
      });
      await sendWhatsAppMessage(instanceName, remoteJid,
        `💰 ${fmt(Math.abs(action.amount))} — *${isRevenueIntent(action.type) ? "Receita" : "Despesa"}* PF\n\n` +
        `Qual a forma?\n1️⃣ Cartão de crédito\n2️⃣ PIX / Débito\n3️⃣ Dinheiro\n0️⃣ Cancelar`,
        evolutionUrl, evolutionKey
      );
      return;
    }

    // PF pending → insert directly (no payment method needed)
    await insertPfTransaction({ supabase, action, userId: pending.user_id, today });
    await sendPfConfirmation({ supabase, action, pending, instanceName, remoteJid, today, evolutionUrl, evolutionKey, fmt });

  } else {
    // PJ → insert directly
    const [accRes, ccRes, bankRes] = await Promise.all([
      action.pj_account_id
        ? supabase.from("chart_of_accounts").select("name").eq("id", action.pj_account_id).maybeSingle()
        : Promise.resolve({ data: null }),
      action.pj_cost_center_id
        ? supabase.from("cost_centers").select("name").eq("id", action.pj_cost_center_id).maybeSingle()
        : Promise.resolve({ data: null }),
      action.pj_bank_account_id
        ? supabase.from("bank_accounts").select("name").eq("id", action.pj_bank_account_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    const chartAccountName = accRes.data?.name || "Sem classificação";
    const costCenterName = ccRes.data?.name || "—";
    const bankName = bankRes.data?.name || "—";

    await insertPjTransaction({ supabase, action, companyId: pending.company_id, userId: pending.user_id, today });

    // MISTO reverso: PJ mas pagou do bolso → aporte
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
      `✅ *Transação registrada!*\n\n` +
      `💰 ${fmt(action.amount)} — *${isRevenueIntent(action.type) ? "Receita" : "Despesa"}*\n` +
      `📂 *Conta contábil:* ${chartAccountName}\n` +
      `🏢 *Centro de custo:* ${costCenterName}\n` +
      `🏦 *Conta bancária:* ${bankName}\n` +
      `📅 *Data:* ${action.date || today}\n` +
      `📍 *Módulo:* Empresa (PJ)` +
      (paymentSource === "pf" ? `\n\n_⚠️ Aporte criado automaticamente para reembolsar seus recursos pessoais._` : ""),
      evolutionUrl, evolutionKey
    );
  }
}

// ─── PF CONFIRMATION HELPER ──────────────────────────────────────────────────

async function sendPfConfirmation({ supabase, action, pending, instanceName, remoteJid, today, evolutionUrl, evolutionKey, fmt }: any) {
  let categoryName = "Sem categoria";
  let accountName = "Carteira";
  let currentBalance: number | null = null;

  const [catRes, accRes, cardRes] = await Promise.all([
    action.pf_category_id
      ? supabase.from("personal_categories").select("name").eq("id", action.pf_category_id).maybeSingle()
      : Promise.resolve({ data: null }),
    action.pf_account_id
      ? supabase.from("personal_accounts").select("name, current_balance").eq("id", action.pf_account_id).maybeSingle()
      : Promise.resolve({ data: null }),
    action.pf_credit_card_id
      ? supabase.from("personal_credit_cards").select("name").eq("id", action.pf_credit_card_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  categoryName = catRes.data?.name || "Sem categoria";
  if (cardRes.data) {
    accountName = `Cartão: ${cardRes.data.name}`;
  } else if (accRes.data) {
    accountName = accRes.data.name;
    currentBalance = Number(accRes.data.current_balance);
    // Recalcular saldo após inserção
    const { data: updatedAcc } = await supabase.from("personal_accounts").select("current_balance").eq("id", action.pf_account_id).maybeSingle();
    if (updatedAcc) currentBalance = Number(updatedAcc.current_balance);
  } else {
    accountName = "Dinheiro";
  }

  const paymentSource = action.payment_source as string | undefined;
  // MISTO: PF mas pagou com conta da empresa → criar retirada
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

  const balanceStr = currentBalance != null ? ` (saldo atual: ${fmt(currentBalance)})` : "";
  await sendWhatsAppMessage(instanceName, remoteJid,
    `✅ *Transação registrada!*\n\n` +
    `💰 ${fmt(Math.abs(action.amount))} — *${isRevenueIntent(action.type) ? "Receita" : "Despesa"}*\n` +
    `📂 *Categoria:* ${categoryName}\n` +
    `🏦 *${accountName}*${balanceStr}\n` +
    `📅 *Data:* ${action.date || today}\n` +
    `📍 *Módulo:* Pessoal (PF)` +
    (paymentSource === "pj" ? `\n\n_⚠️ Retirada criada automaticamente para manter a separação patrimonial._` : ""),
    evolutionUrl, evolutionKey
  );
}

// ─── INSERT HELPERS ───────────────────────────────────────────────────────────

function isRevenueIntent(type: unknown): boolean {
  const normalized = String(type ?? "").toLowerCase().trim();
  return ["revenue", "receita", "income", "entrada", "ganho", "ganhei", "recebi", "faturei"].includes(normalized);
}

function normalizePfType(type: unknown): "receita" | "despesa" {
  return isRevenueIntent(type) ? "receita" : "despesa";
}

function normalizePjType(type: unknown): "revenue" | "expense" {
  return isRevenueIntent(type) ? "revenue" : "expense";
}

async function insertPfTransaction({ supabase, action, userId, today }: {
  supabase: any; action: any; userId: string; today: string;
}) {
  const insertData: any = {
    user_id: userId,
    title: action.description || "Lançamento via WhatsApp",
    amount: Math.abs(action.amount),
    type: normalizePfType(action.type),
    date: action.date || today,
    description: action.description,
    category_id: action.pf_category_id || null,
    source: "whatsapp",
    status: action.status || "confirmed",
  };
  // Se tem cartão de crédito, usa credit_card_id; senão usa account_id
  if (action.pf_credit_card_id) {
    insertData.credit_card_id = action.pf_credit_card_id;
  } else {
    insertData.account_id = action.pf_account_id || null;
  }
  const { error } = await supabase.from("personal_transactions").insert(insertData);
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
    type: normalizePjType(action.type),
    date: action.date || today,
    source: "whatsapp",
    status: action.status || "confirmed",
    account_id: action.pj_account_id || null,
    cost_center_id: action.pj_cost_center_id || null,
    bank_account_id: action.pj_bank_account_id || null,
  });
  if (error) console.error("PJ transaction insert error:", error);
  return error;
}

// ─── QUICK PARSER (SEM CONVERSA) ─────────────────────────────────────────────

function parseBrazilianAmount(text: string): number | null {
  const normalized = text.toLowerCase().replace(/\s+/g, " ").trim();

  // 1) Textual multipliers: "5 mil", "1,5k", "meio mil", "2 milhões", "3 conto"
  const multipliers: Record<string, number> = {
    mil: 1000, k: 1000, conto: 1000, contos: 1000,
    milhão: 1_000_000, milhao: 1_000_000, mi: 1_000_000, milhões: 1_000_000, milhoes: 1_000_000,
  };
  const mKeys = Object.keys(multipliers).join("|");

  // "meio mil" → 500
  const halfMatch = normalized.match(new RegExp(`meio\\s+(${mKeys})`, "i"));
  if (halfMatch) return multipliers[halfMatch[1].toLowerCase()] / 2;

  // "5 mil", "1,5k", "2.5 milhão"
  const multMatch = normalized.match(new RegExp(`(\\d+[.,]?\\d*)\\s*(${mKeys})`, "i"));
  if (multMatch) {
    const val = parseFloat(multMatch[1].replace(",", "."));
    const factor = multipliers[multMatch[2].toLowerCase()];
    if (Number.isFinite(val) && val > 0) return val * factor;
  }

  // 2) Standard numeric: "R$ 1.500,00", "150", "49,90"
  const match = normalized.match(/(?:r\$\s*)?(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)/i);
  if (!match) return null;

  let raw = match[1].replace(/\s/g, "");
  if (raw.includes(".") && raw.includes(",")) raw = raw.replace(/\./g, "").replace(",", ".");
  else if (raw.includes(",")) raw = raw.replace(",", ".");

  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}

function detectQuickTransaction({
  text,
  pfCategories,
  defaultPfAccountId,
  defaultPjAccountId,
  defaultPjCostCenterId,
  defaultPjBankAccountId,
  today,
}: {
  text: string;
  pfCategories: any[];
  defaultPfAccountId?: string;
  defaultPjAccountId?: string;
  defaultPjCostCenterId?: string;
  defaultPjBankAccountId?: string;
  today: string;
}): any | null {
  const normalized = text.toLowerCase().trim();
  const amount = parseBrazilianAmount(normalized);
  if (!amount) return null;

  const expenseSignals = ["gastei", "paguei", "comprei", "despesa", "custo", "debito", "débito", "pix enviado"];
  const revenueSignals = ["recebi", "entrou", "ganhei", "vendi", "faturei", "receita", "pix recebido"];

  const hasExpense = expenseSignals.some((s) => normalized.includes(s));
  const hasRevenue = revenueSignals.some((s) => normalized.includes(s));
  const onlyValue = /^(r\$\s*)?\d+[\d.,]*$/.test(normalized);

  let nature: "expense" | "revenue" | null = null;
  if (hasExpense && !hasRevenue) nature = "expense";
  else if (hasRevenue && !hasExpense) nature = "revenue";
  else if (onlyValue) nature = "expense";
  else return null;

  const isPj = /\b(pj|empresa|empresarial|fornecedor|cliente|cnpj|nota fiscal)\b/.test(normalized);

  const cleanedDescription = text
    .replace(/(?:r\$\s*)?\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  const description = cleanedDescription || (nature === "expense" ? "Despesa via WhatsApp" : "Receita via WhatsApp");

  if (isPj) {
    return {
      action: "create_pj_transaction",
      type: nature,
      amount,
      description,
      pj_account_id: defaultPjAccountId || null,
      pj_cost_center_id: defaultPjCostCenterId || null,
      pj_bank_account_id: defaultPjBankAccountId || null,
      date: today,
      payment_source: "pj",
      _quick_side: "pj",
    };
  }

  const wantedTypes = nature === "expense" ? ["expense", "despesa"] : ["income", "receita"];
  const fallbackCategory = pfCategories.find((c: any) => wantedTypes.includes((c.type || "").toLowerCase()));

  return {
    action: "create_pf_transaction",
    type: nature === "expense" ? "despesa" : "receita",
    amount,
    description,
    pf_category_id: fallbackCategory?.id || null,
    pf_account_id: defaultPfAccountId || null,
    date: today,
    payment_source: "pf",
    _quick_side: "pf",
  };
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
  evolutionUrl: string | undefined;
  evolutionKey: string | undefined;
}

async function runFinancialAgent(ctx: AgentContext) {
  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!lovableApiKey) {
    await sendWhatsAppMessage(ctx.instanceName, ctx.remoteJid, "❌ Configuração de IA não encontrada.", ctx.evolutionUrl, ctx.evolutionKey);
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
  const [pfCategoriesRes, pfAccountsRes, pfRecentTxRes, pfCreditCardsRes] = await Promise.all([
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
    ctx.supabase.from("personal_credit_cards")
      .select("id, name, brand, closing_day, due_day")
      .eq("user_id", ctx.userId)
      .eq("is_active", true),
  ]);

  const pfCategories = pfCategoriesRes.data || [];
  const pfAccounts = pfAccountsRes.data || [];
  const pfRecentTx = pfRecentTxRes.data || [];
  const pfCreditCards = pfCreditCardsRes.data || [];
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
  const pfCreditCardsList = pfCreditCards.map((c: any) => `${c.name}${c.brand ? ` (${c.brand})` : ""} - Fecha dia ${c.closing_day}, vence dia ${c.due_day} [id:${c.id}]`).join("\n");
  const pfRecentTxList = pfRecentTx.slice(0, 10).map((t: any) =>
    `${t.date} | ${t.type === "receita" ? "📈" : "📉"} ${fmt(Number(t.amount))} | ${t.title} | ${(t.personal_categories as any)?.name || "-"}`
  ).join("\n");

  const pfCategoryMap = new Map((pfCategories || []).map((c: any) => [c.id, c.name]));
  const pfAccountMap = new Map((pfAccounts || []).map((a: any) => [a.id, a.name]));
  const pfCreditCardMap = new Map((pfCreditCards || []).map((c: any) => [c.id, c.name]));
  const pjAccountMap = new Map((accounts || []).map((a: any) => [a.id, a.name]));
  const pjCostCenterMap = new Map((centers || []).map((c: any) => [c.id, c.name]));
  const pjBankAccountMap = new Map((bankAccounts || []).map((b: any) => [b.id, b.name]));

  const buildActionFallbackMessage = (action: any): string | null => {
    const amount = Number(action?.amount || 0);
    const formattedAmount = Number.isFinite(amount) ? fmt(Math.abs(amount)) : "—";
    const actionDate = action?.date || today;
    const isPending = action?.status === "pending";
    const isRevenue = isRevenueIntent(action?.type);

    if (action?.action === "create_pf_transaction") {
      const kind = isPending ? (isRevenue ? "Conta a Receber" : "Conta a Pagar") : (isRevenue ? "Receita" : "Despesa");
      const categoryName = action?.pf_category_id ? (pfCategoryMap.get(action.pf_category_id) || "Sem categoria") : "Sem categoria";
      const paymentName = action?.pf_credit_card_id
        ? `Cartão: ${pfCreditCardMap.get(action.pf_credit_card_id) || "Não identificado"}`
        : action?.pf_account_id
          ? `Conta: ${pfAccountMap.get(action.pf_account_id) || "Não identificada"}`
          : "Forma: Dinheiro/Não informado";

      return `✅ ${formattedAmount} • ${kind} • ${categoryName} • ${paymentName} • ${actionDate} • PF`;
    }

    if (action?.action === "create_pj_transaction") {
      const kind = isPending ? (isRevenue ? "Conta a Receber" : "Conta a Pagar") : (isRevenue ? "Receita" : "Despesa");
      const accountName = action?.pj_account_id ? (pjAccountMap.get(action.pj_account_id) || "Sem classificação") : "Sem classificação";
      const costCenterName = action?.pj_cost_center_id ? (pjCostCenterMap.get(action.pj_cost_center_id) || "Sem centro") : "Sem centro";
      const bankName = action?.pj_bank_account_id ? (pjBankAccountMap.get(action.pj_bank_account_id) || "Sem conta") : "Sem conta";

      return `✅ ${formattedAmount} • ${kind} • ${accountName} • ${costCenterName} • ${bankName} • ${actionDate} • PJ`;
    }

    if (action?.action === "create_owner_transaction") {
      const ownerType = action?.transaction_type === "aporte" ? "Aporte" : "Retirada";
      return `✅ ${formattedAmount} • ${ownerType} • ${actionDate} • Sócio PF↔PJ`;
    }

    if (action?.action === "ask_confirmation") {
      return `💰 Identifiquei ${formattedAmount}. Você quer lançar em qual módulo?\n1️⃣ Pessoal (PF)\n2️⃣ Empresa (PJ)\n0️⃣ Cancelar`;
    }

    return null;
  };

  // Quick path removido — toda mensagem passa pelo agente IA para classificação contextual correta

  const systemPrompt = `Você é um assistente financeiro rápido e direto. Responda em pt-BR com formatação WhatsApp. Seja ULTRA conciso.

REGRA PRINCIPAL: Ao receber qualquer mensagem com valor financeiro, determine se é um GASTO JÁ REALIZADO (confirmed) ou uma CONTA A PAGAR/RECEBER futura (pending).

REGRA CRÍTICA — VOCÊ SÓ TEM UMA TOOL:
Sua ÚNICA tool disponível é "ask_confirmation". Você NÃO PODE criar transações diretamente.
Para QUALQUER transação (PF ou PJ, confirmed ou pending), você DEVE usar ask_confirmation.
O sistema cuidará de perguntar PF/PJ ao usuário e registrar a transação.

COMO USAR ask_confirmation:
- Preencha amount, description, type, date, status com os dados extraídos da mensagem
- Preencha pf_category_id, pf_account_id, pj_account_id, pj_cost_center_id, pj_bank_account_id com os melhores IDs disponíveis
- O campo "reason" descreve o que foi identificado
- O sistema automaticamente perguntará ao usuário: "PF ou PJ?"
- NÃO precisa perguntar forma de pagamento — o sistema faz isso automaticamente para PF

CONTAS A PAGAR / A RECEBER (status=pending):
- "conta de luz", "boleto", "fatura", "vencimento", "vence dia X", "pagar até", "parcela" = CONTA A PAGAR → status="pending", type=despesa, date=data de vencimento
- "vai receber", "cliente vai pagar", "fatura para cobrar" = CONTA A RECEBER → status="pending", type=receita/revenue

GASTOS/RECEITAS JÁ REALIZADOS (status=confirmed):
- "gastei", "paguei", "comprei", "débito" = DESPESA (status=confirmed)
- "ganhei", "recebi", "entrou", "vendi", "faturei" = RECEITA (status=confirmed)
- Se não houver verbo claro mas há valor, pergunte brevemente: "💰 R$ X — é gasto ou receita?"

Interpretação de valores brasileiros:
- "5 mil" = 5000, "1,5k" = 1500, "meio mil" = 500, "2 milhões" = 2000000
- Mês atual: ${monthName}. Hoje: ${today}. Se disser "dia 30" sem mês, use o dia 30 do mês atual (ou próximo mês se dia 30 já passou).

Defaults: pf_account_id="${defaultPfAccount?.id || ""}" | pj_bank_account_id="${defaultBankAccount?.id || ""}" | date="${today}"

Dados PJ (${monthName}): Receita ${fmt(revenue)} | Despesas ${fmt(expense)} | Saldo ${fmt(balance)}
Contas PJ: ${accountsList || "—"}
Centros: ${centersList || "—"}
Bancos PJ: ${bankAccountsList || "—"}

Dados PF:
Contas: ${pfAccountsList || "—"}
Categorias: ${pfCategoriesList || "—"}
Cartões de crédito: ${pfCreditCardsList || "Nenhum cadastrado"}

Quando não for transação (pergunta, resumo, etc), responda normalmente sem usar tools.
Nunca mostre UUIDs ao usuário.`;

  // Define tools — ONLY ask_confirmation + reports. No direct creation tools.
  // This forces the AI to always use ask_confirmation, preventing bypass.
  const tools = [
    {
      type: "function",
      function: {
        name: "ask_confirmation",
        description: "SEMPRE use esta tool para qualquer transação financeira. Ela pergunta ao usuário se é PF ou PJ antes de registrar. É a ÚNICA forma de criar transações.",
        parameters: {
          type: "object",
          properties: {
            amount: { type: "number" },
            description: { type: "string" },
            type: { type: "string", enum: ["revenue", "expense", "receita", "despesa"] },
            pf_category_id: { type: "string" },
            pf_account_id: { type: "string" },
            pf_credit_card_id: { type: "string" },
            pj_account_id: { type: "string" },
            pj_cost_center_id: { type: "string" },
            pj_bank_account_id: { type: "string" },
            date: { type: "string" },
            reason: { type: "string", description: "Motivo da dúvida" },
            payment_source: { type: "string", enum: ["pf", "pj", "unknown"] },
            status: { type: "string", enum: ["confirmed", "pending"], description: "confirmed=já pago. pending=conta a pagar/receber." },
          },
          required: ["amount", "description", "type", "date", "reason"],
          additionalProperties: false,
        },
      },
    },
    {
      type: "function",
      function: {
        name: "send_executive_summary",
        description: "Gera e envia resumo executivo da empresa.",
        parameters: { type: "object", properties: {}, additionalProperties: false },
      },
    },
    {
      type: "function",
      function: {
        name: "send_cashflow_forecast",
        description: "Gera e envia previsão de fluxo de caixa.",
        parameters: { type: "object", properties: {}, additionalProperties: false },
      },
    },
    {
      type: "function",
      function: {
        name: "send_chart",
        description: "Gera e envia gráfico DRE.",
        parameters: { type: "object", properties: {}, additionalProperties: false },
      },
    },
  ];

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
          { role: "user", content: ctx.text },
        ],
        tools,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI Agent error:", response.status, errText);
      await sendWhatsAppMessage(ctx.instanceName, ctx.remoteJid,
        "❌ Desculpe, tive um problema técnico. Tente novamente em instantes."
      );
      return;
    }

    const result = await response.json();
    const choice = result.choices?.[0];
    const aiResponse = choice?.message?.content || "";
    const toolCalls = choice?.message?.tool_calls || [];

    console.log("AI response (first 500 chars):", aiResponse.slice(0, 500));
    console.log("Tool calls count:", toolCalls.length);

    // Extract actions from tool calls
    const actions: any[] = [];
    for (const tc of toolCalls) {
      try {
        const args = typeof tc.function.arguments === "string" ? JSON.parse(tc.function.arguments) : tc.function.arguments;
        actions.push({ action: tc.function.name, ...args });
      } catch (e) {
        console.error("Failed to parse tool call:", tc, e);
      }
    }

    // Fallback: also try <ACTION> tags in case model uses them
    if (actions.length === 0 && aiResponse) {
      const actionMatches = aiResponse.matchAll(/<ACTION>(.*?)<\/ACTION>/gs);
      for (const match of actionMatches) {
        try { actions.push(JSON.parse(match[1])); } catch { /* skip */ }
      }
      if (actions.length > 0) console.log("Fallback: extracted", actions.length, "actions from <ACTION> tags");
    }

    console.log("Total actions:", actions.length, actions.map((a: any) => a.action));

    // Send clean text response
    const cleanResponse = aiResponse.replace(/<ACTION>.*?<\/ACTION>/gs, "").trim();
    if (cleanResponse) {
      await sendWhatsAppMessage(ctx.instanceName, ctx.remoteJid, cleanResponse, ctx.evolutionUrl, ctx.evolutionKey);
    }
    const shouldSendActionFallback = !cleanResponse;

    // Processar ações — only ask_confirmation and report tools are expected
    for (const action of actions) {
      if (action.action === "ask_confirmation") {
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

        if (shouldSendActionFallback) {
          const fallback = buildActionFallbackMessage(action);
          if (fallback) {
            await sendWhatsAppMessage(ctx.instanceName, ctx.remoteJid, fallback, ctx.evolutionUrl, ctx.evolutionKey);
          }
        }

      } else if (action.action === "send_chart") {
        try {
          const chartData = { revenue, expense, balance, expenseByAccount, revenueByAccount, month: monthName };
          const imageBase64 = await generateFinancialChart(chartData, lovableApiKey);
          if (imageBase64) {
            await sendWhatsAppImage(ctx.instanceName, ctx.remoteJid, imageBase64, `📊 Dashboard Financeiro — ${monthName}`, ctx.evolutionUrl, ctx.evolutionKey);
          }
        } catch (chartErr) { console.error("Chart generation error:", chartErr); }

      } else if (action.action === "send_executive_summary") {
        try {
          await sendWhatsAppMessage(ctx.instanceName, ctx.remoteJid, "📝 _Gerando seu resumo executivo... aguarde._", ctx.evolutionUrl, ctx.evolutionKey);
          const summaryText = await generateExecutiveSummary(ctx.companyId, ctx.supabase, lovableApiKey);
          if (summaryText) {
            for (const chunk of splitMessage(summaryText, 3800)) {
              await sendWhatsAppMessage(ctx.instanceName, ctx.remoteJid, chunk, ctx.evolutionUrl, ctx.evolutionKey);
            }
          } else {
            await sendWhatsAppMessage(ctx.instanceName, ctx.remoteJid, "⚠️ Não foi possível gerar o resumo executivo.", ctx.evolutionUrl, ctx.evolutionKey);
          }
        } catch (err) { console.error("Executive summary error:", err); }

      } else if (action.action === "send_cashflow_forecast") {
        try {
          await sendWhatsAppMessage(ctx.instanceName, ctx.remoteJid, "📊 _Analisando dados e gerando previsão de fluxo de caixa..._", ctx.evolutionUrl, ctx.evolutionKey);
          const forecastResult = await generateCashFlowForecast(ctx.companyId, ctx.supabase, lovableApiKey);
          if (forecastResult) {
            await sendWhatsAppMessage(ctx.instanceName, ctx.remoteJid, forecastResult.text, ctx.evolutionUrl, ctx.evolutionKey);
            if (forecastResult.chartData) {
              const imageBase64 = await generateForecastChart(forecastResult.chartData, lovableApiKey);
              if (imageBase64) {
                await sendWhatsAppImage(ctx.instanceName, ctx.remoteJid, imageBase64, "📈 Previsão de Fluxo de Caixa — Próximos 3 meses", ctx.evolutionUrl, ctx.evolutionKey);
              }
            }
          } else {
            await sendWhatsAppMessage(ctx.instanceName, ctx.remoteJid, "⚠️ Não foi possível gerar a previsão.", ctx.evolutionUrl, ctx.evolutionKey);
          }
        } catch (err) { console.error("Cashflow forecast error:", err); }
      }
    }

    // Log da interação (inbound + outbound)
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
        classification: { actions, aiModel: "gemini-3-flash-preview", toolCalls: toolCalls.length },
      }),
      cleanResponse ? ctx.supabase.from("whatsapp_messages").insert({
        company_id: ctx.companyId,
        config_id: ctx.configId,
        phone_number: "bot",
        direction: "outbound",
        message_text: cleanResponse.slice(0, 2000),
        message_type: "text",
        processed: true,
        classification: { actions: actions.map((a: any) => a.action) },
      }) : Promise.resolve(),
    ]);

  } catch (err) {
    console.error("Agent error:", err);
    await sendWhatsAppMessage(ctx.instanceName, ctx.remoteJid,
      "❌ Ocorreu um erro inesperado. Tente novamente em instantes.", ctx.evolutionUrl, ctx.evolutionKey
    );
  }
}

// ─── AUDIO PROCESSING ─────────────────────────────────────────────────────────

async function getMediaBase64(instanceName: string, messageId: string, remoteJid: string, evoUrl?: string | undefined, evoKey?: string | undefined): Promise<string | null> {
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

async function sendWhatsAppMessage(instanceName: string, remoteJid: string, text: string, evoUrl?: string | undefined, evoKey?: string | undefined) {
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

async function sendWhatsAppImage(instanceName: string, remoteJid: string, base64Image: string, caption: string, evoUrl?: string | undefined, evoKey?: string | undefined) {
  const evolutionUrl = evoUrl || Deno.env.get("EVOLUTION_API_URL");
  const evolutionKey = evoKey || Deno.env.get("EVOLUTION_API_KEY");
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
