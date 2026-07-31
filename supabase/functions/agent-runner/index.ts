/**
 * agent-runner — executor dos templates de agente configuráveis.
 *
 * Cron (x-cron-secret) roda todas as instâncias ativas; com JWT +
 * company_id roda as da empresa (botão "rodar agora" da galeria).
 *
 * Divisão de trabalho rígida (padrão _shared/agentes.ts): a decisão de QUANDO
 * falar é determinística e mora em _shared/templates-agentes.ts; a IA só
 * redige narrativa nos templates que pedem (resumo_semanal, analista_custom)
 * e nunca produz número. Todo aviso passa pelo dedupe por dedupe_key antes de
 * virar notificação; o canal WhatsApp exige destinatário explícito.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";
import { authenticate, assertMembership, jsonResp } from "../_shared/auth.ts";
import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";
import { chamarModelo, registrarUso } from "../_shared/ia.ts";
import {
  TEMPLATE_POR_KEY,
  avaliarCaixaBaixo,
  avaliarContasAVencer,
  avaliarImpostos,
  avaliarMeta,
  avaliarRecompra,
  type Aviso,
} from "../_shared/templates-agentes.ts";

// deno-lint-ignore no-explicit-any
type Service = any;

interface Instancia {
  id: string;
  company_id: string;
  template_key: string;
  nome: string;
  config: Record<string, unknown>;
  canais: { inapp?: boolean; whatsapp?: boolean };
}

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const hojeIso = () => new Date().toISOString().slice(0, 10);

const METAS_LABELS: Record<string, { label: string; formato: "currency" | "percent" }> = {
  receita_mes: { label: "Receita do mês", formato: "currency" },
  resultado_mes: { label: "Resultado do mês", formato: "currency" },
  margem_operacional: { label: "Margem operacional", formato: "percent" },
  mrr: { label: "Receita recorrente (MRR)", formato: "currency" },
  inadimplencia: { label: "Inadimplência", formato: "percent" },
};

/** Números do mês para o vigia de metas e para o contexto dos templates de IA. */
async function numerosDoMes(service: Service, companyId: string) {
  const mes = `${hojeIso().slice(0, 7)}-01`;
  const [margem, contratos, receivables] = await Promise.all([
    service.from("v_company_margin").select("receita, custos, despesas").eq("company_id", companyId).eq("month", mes),
    service.from("contracts").select("amount, cycle").eq("company_id", companyId).eq("status", "active"),
    service.from("receivables").select("amount, due_date, status").eq("company_id", companyId).neq("status", "cancelado"),
  ]);

  const m = (margem.data ?? []).reduce(
    (acc: { receita: number; custos: number; despesas: number }, r: { receita: number; custos: number; despesas: number }) => ({
      receita: acc.receita + Number(r.receita || 0),
      custos: acc.custos + Number(r.custos || 0),
      despesas: acc.despesas + Number(r.despesas || 0),
    }),
    { receita: 0, custos: 0, despesas: 0 },
  );
  const resultado = m.receita - m.custos - m.despesas;

  const fatorMensal: Record<string, number> = {
    WEEKLY: 52 / 12, BIWEEKLY: 26 / 12, MONTHLY: 1, QUARTERLY: 1 / 3, SEMIANNUALLY: 1 / 6, YEARLY: 1 / 12,
  };
  const mrr = (contratos.data ?? []).reduce(
    (s: number, c: { amount: number; cycle: string }) => s + Number(c.amount) * (fatorMensal[c.cycle] ?? 1),
    0,
  );

  const hoje = hojeIso();
  const abertos = (receivables.data ?? []).filter(
    (r: { status: string }) => r.status === "a_receber" || r.status === "vencido",
  );
  const totalAberto = abertos.reduce((s: number, r: { amount: number }) => s + Number(r.amount), 0);
  const vencido = abertos
    .filter((r: { due_date: string; status: string }) => r.status === "vencido" || r.due_date < hoje)
    .reduce((s: number, r: { amount: number }) => s + Number(r.amount), 0);

  return {
    receita_mes: m.receita,
    resultado_mes: resultado,
    margem_operacional: m.receita > 0 ? (resultado / m.receita) * 100 : 0,
    mrr,
    inadimplencia: totalAberto > 0 ? (vencido / totalAberto) * 100 : 0,
  };
}

/** Dedupe: já avisamos isso nos últimos N dias? */
async function jaAvisado(service: Service, companyId: string, dedupeKey: string, dias: number): Promise<boolean> {
  const desde = new Date(Date.now() - dias * 86_400_000).toISOString();
  const { data } = await service
    .from("notifications")
    .select("id")
    .eq("company_id", companyId)
    .eq("dedupe_key", dedupeKey)
    .gte("created_at", desde)
    .limit(1);
  return (data ?? []).length > 0;
}

async function despachar(service: Service, inst: Instancia, aviso: Aviso, link: string) {
  if (inst.canais.inapp !== false) {
    await service.from("notifications").insert({
      company_id: inst.company_id,
      titulo: aviso.titulo,
      corpo: aviso.corpo,
      categoria: "agente",
      link,
      dedupe_key: aviso.dedupeKey,
      agent_instance_id: inst.id,
    });
  }

  if (inst.canais.whatsapp) {
    // Entitlement: plano sem WhatsApp não envia, mesmo com canal ligado.
    const { data: plano } = await service.rpc("plano_da_empresa", { p_company_id: inst.company_id });
    if (plano && plano.whatsapp === false) return;

    const { data: config } = await service
      .from("whatsapp_configs")
      .select("instance_name, notify_number, evolution_api_url, evolution_api_key")
      .eq("company_id", inst.company_id)
      .eq("active", true)
      .maybeSingle();
    const numero = config?.notify_number?.replace(/\D/g, "");
    const evolutionUrl = config?.evolution_api_url || Deno.env.get("EVOLUTION_API_URL");
    const evolutionKey = config?.evolution_api_key || Deno.env.get("EVOLUTION_API_KEY");
    if (config && numero && numero.length >= 10 && evolutionUrl && evolutionKey) {
      const texto = `🤖 *${inst.nome}*\n\n*${aviso.titulo}*\n${aviso.corpo}`;
      // Evolution cai com frequência: duas tentativas com backoff, e falha
      // definitiva vira notificação in-app visível — nunca descarte mudo.
      let enviado = false;
      for (const espera of [0, 1500]) {
        if (espera > 0) await new Promise((r) => setTimeout(r, espera));
        try {
          const resp = await fetch(`${evolutionUrl}/message/sendText/${config.instance_name}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: evolutionKey },
            body: JSON.stringify({ number: `${numero}@s.whatsapp.net`, text: texto }),
          });
          if (resp.ok) {
            enviado = true;
            break;
          }
          console.error(`[agent-runner] Evolution ${resp.status} p/ ${inst.company_id}`);
        } catch (err) {
          console.error(`[agent-runner] WhatsApp falhou p/ ${inst.company_id}`, err);
        }
      }
      if (!enviado) {
        await service.from("notifications").insert({
          company_id: inst.company_id,
          titulo: "Aviso não chegou no WhatsApp",
          corpo: `O agente ${inst.nome} tentou avisar por WhatsApp e a Evolution não respondeu. Reconecte a instância.`,
          categoria: "sistema",
          link: "/whatsapp",
          dedupe_key: `whatsapp_falhou:${inst.id}`,
        });
      }
    }
  }
}

async function rodarInstancia(service: Service, apiKey: string | undefined, inst: Instancia): Promise<string> {
  const template = TEMPLATE_POR_KEY[inst.template_key];
  if (!template) return "template desconhecido";
  const config = { ...template.configPadrao, ...(inst.config ?? {}) };
  const hoje = hojeIso();
  const avisos: Aviso[] = [];

  if (inst.template_key === "caixa_baixo") {
    const { data } = await service.from("bank_accounts").select("balance").eq("company_id", inst.company_id);
    const saldos = (data ?? []).map((b: { balance: number | null }) => b.balance).filter((v: number | null) => v !== null);
    const saldo = saldos.length > 0 ? saldos.reduce((s: number, v: number) => s + v, 0) : null;
    const aviso = avaliarCaixaBaixo(saldo, Number(config.limite));
    if (aviso) avisos.push(aviso);
  } else if (inst.template_key === "contas_a_vencer") {
    const { data } = await service
      .from("bills_payable")
      .select("valor, vencimento, fornecedor")
      .eq("company_id", inst.company_id)
      .neq("status", "pago");
    const aviso = avaliarContasAVencer(data ?? [], hoje, Number(config.dias));
    if (aviso) avisos.push(aviso);
  } else if (inst.template_key === "impostos_a_vencer") {
    const { data } = await service
      .from("tax_guides")
      .select("valor, vencimento, tipo")
      .eq("company_id", inst.company_id)
      .neq("status", "pago");
    const aviso = avaliarImpostos(data ?? [], hoje, Number(config.dias));
    if (aviso) avisos.push(aviso);
  } else if (inst.template_key === "vigia_de_recompra") {
    const { data } = await service
      .from("v_recompra_clientes")
      .select("name, status, ticket_medio")
      .eq("company_id", inst.company_id);
    const aviso = avaliarRecompra(data ?? [], Number(config.ticket_min ?? 0), hoje);
    if (aviso) avisos.push(aviso);
  } else if (inst.template_key === "vigia_de_metas") {
    const { data: metas } = await service
      .from("kpi_metas")
      .select("metric_key, alvo, direcao")
      .eq("company_id", inst.company_id);
    if ((metas ?? []).length > 0) {
      const numeros = await numerosDoMes(service, inst.company_id);
      for (const meta of metas ?? []) {
        const def = METAS_LABELS[meta.metric_key];
        if (!def) continue;
        const aviso = avaliarMeta({
          metric_key: meta.metric_key,
          label: def.label,
          formato: def.formato,
          valor: numeros[meta.metric_key as keyof typeof numeros] ?? 0,
          alvo: Number(meta.alvo),
          direcao: meta.direcao,
        });
        if (aviso) avisos.push(aviso);
      }
    }
  } else if (inst.template_key === "resumo_semanal" || inst.template_key === "analista_custom") {
    if (inst.template_key === "resumo_semanal" && new Date().getUTCDay() !== 1) return "não é segunda";
    if (!apiKey) return "IA não configurada";
    const prompt = String(config.prompt ?? "").trim();
    if (inst.template_key === "analista_custom" && !prompt) return "sem prompt configurado";

    const numeros = await numerosDoMes(service, inst.company_id);
    const contexto =
      `Números do mês corrente (calculados pelo sistema, NUNCA recalcule): ` +
      `receita ${brl(numeros.receita_mes)}, resultado ${brl(numeros.resultado_mes)}, ` +
      `margem operacional ${numeros.margem_operacional.toFixed(1)}%, MRR ${brl(numeros.mrr)}, ` +
      `inadimplência ${numeros.inadimplencia.toFixed(1)}%.`;

    const instrucao =
      inst.template_key === "resumo_semanal"
        ? "Escreva UM parágrafo executivo (máx. 420 caracteres) resumindo a situação financeira da semana para o dono da empresa, em português direto, citando os números fornecidos."
        : `Responda à pergunta do dono da empresa em até 500 caracteres, usando somente os números fornecidos. Pergunta: ${prompt}`;

    const resposta = await chamarModelo<{ texto: string }>(
      apiKey,
      [
        { role: "system", content: "Você é um CFO objetivo. Responda JSON: {\"texto\": \"...\"}. Use apenas os números fornecidos; não invente valores." },
        { role: "user", content: `${contexto}\n\n${instrucao}` },
      ],
      { maxTokens: 600 },
    );
    await registrarUso(service, inst.company_id, `agent-runner:${inst.template_key}`, {
      modelo: resposta.modelo,
      promptTokens: resposta.promptTokens,
      completionTokens: resposta.completionTokens,
      custoCentavos: resposta.custoCentavos,
      erro: resposta.erro,
    });
    if (resposta.dados?.texto) {
      avisos.push({
        titulo: inst.template_key === "resumo_semanal" ? "Resumo semanal do CFO" : inst.nome,
        corpo: resposta.dados.texto,
        dedupeKey: `${inst.template_key}:${hoje}`,
      });
    }
  }

  let enviados = 0;
  for (const aviso of avisos) {
    if (await jaAvisado(service, inst.company_id, aviso.dedupeKey, template.dedupeDias)) continue;
    await despachar(service, inst, aviso, template.link);
    enviados += 1;
  }

  await service
    .from("agent_instances")
    .update({ last_run_at: new Date().toISOString(), last_result: { avisos: avisos.length, enviados } })
    .eq("id", inst.id);

  return `${enviados} aviso(s)`;
}

async function rodarLote(service: Service, apiKey: string | undefined, instancias: Instancia[]) {
  const resultados: Record<string, string> = {};
  for (const inst of instancias) {
    try {
      resultados[`${inst.company_id}:${inst.template_key}`] = await rodarInstancia(service, apiKey, inst);
    } catch (err) {
      console.error(`[agent-runner] instância ${inst.id} falhou`, err);
      resultados[`${inst.company_id}:${inst.template_key}`] = `erro: ${err}`;
    }
  }
  return resultados;
}

Deno.serve(async (req) => {
  const preflight = corsPreflightResponse(req);
  if (preflight) return preflight;
  const corsHeaders = getCorsHeaders(req);

  const service = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const apiKey = Deno.env.get("LOVABLE_API_KEY") ?? undefined;

  const cronSecret = Deno.env.get("CRON_SECRET");
  if (cronSecret && req.headers.get("x-cron-secret") === cronSecret) {
    try {
      const { data } = await service
        .from("agent_instances")
        .select("id, company_id, template_key, nome, config, canais")
        .eq("ativo", true);
      const resultados = await rodarLote(service, apiKey, (data ?? []) as Instancia[]);
      return jsonResp({ ok: true, instancias: (data ?? []).length, resultados }, 200, corsHeaders);
    } catch (err) {
      console.error("[agent-runner] cron error", err);
      return jsonResp({ error: String(err) }, 500, corsHeaders);
    }
  }

  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;

  try {
    const body = await req.json().catch(() => ({}));
    const companyId = body.company_id as string | undefined;
    if (!companyId) return jsonResp({ error: "company_id é obrigatório" }, 400, auth.corsHeaders);
    const forbidden = await assertMembership(auth.supabase, auth.user.id, companyId, auth.corsHeaders);
    if (forbidden) return forbidden;

    const { data } = await service
      .from("agent_instances")
      .select("id, company_id, template_key, nome, config, canais")
      .eq("company_id", companyId)
      .eq("ativo", true);
    const resultados = await rodarLote(service, apiKey, (data ?? []) as Instancia[]);
    return jsonResp({ ok: true, instancias: (data ?? []).length, resultados }, 200, auth.corsHeaders);
  } catch (err) {
    console.error("[agent-runner] error", err);
    return jsonResp({ error: String(err) }, 500, auth.corsHeaders);
  }
});
