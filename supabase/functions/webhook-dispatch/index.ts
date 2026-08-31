/**
 * Entrega dos webhooks de saída.
 *
 * O gatilho em `transactions` enfileira; esta função drena. Chamada pelo
 * `pg_cron` a cada minuto, ou à mão pela tela de webhooks.
 *
 * ─── AS TRÊS GARANTIAS ─────────────────────────────────────────────────────
 *
 * 1. **O corpo é assinado.** HMAC-SHA256 do corpo CRU, hexadecimal, em
 *    `x-financeai-signature`. Assinar o objeto reserializado não funcionaria:
 *    quem recebe verifica sobre os bytes que chegaram, e `JSON.stringify` não
 *    garante a mesma ordem de chaves dos dois lados.
 *
 * 2. **Entrega é pelo-menos-uma-vez.** Destino que responde 500 continua na
 *    fila. O id da transação vai no corpo justamente para o destinatário
 *    deduplicar — é o que faz reentrega ser barata em vez de perigosa.
 *
 * 3. **Destino morto é desligado.** Dez falhas seguidas desativam o webhook, e
 *    o motivo fica gravado. Sem teto, um endpoint que sumiu gera uma tentativa
 *    por minuto para sempre, e a conta de egress é de quem hospeda o ERP.
 *
 * Segurança: só o `x-cron-secret` abre a porta, e o segredo vem do Vault (ver
 * `_shared/cron.ts`). É uma função que dispara requisições para FORA — sem o
 * segredo, qualquer um poderia usá-la para mandar tráfego a um destino que ele
 * mesmo cadastrou.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";
import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";
import { getCronSecret } from "../_shared/cron.ts";

/** Quantos eventos por chamada. Mais que isto estoura o tempo da função. */
const LOTE = 50;
/** Tentativas por evento antes de desistir dele. */
const TENTATIVAS_MAXIMAS = 8;
/** Falhas seguidas que desligam o destino inteiro. */
const FALHAS_ATE_DESLIGAR = 10;
const TEMPO_LIMITE_MS = 10_000;

export async function assinar(corpo: string, segredo: string): Promise<string> {
  const chave = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(segredo),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const assinatura = await crypto.subtle.sign("HMAC", chave, new TextEncoder().encode(corpo));
  return [...new Uint8Array(assinatura)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req, "x-cron-secret");
  const preflight = corsPreflightResponse(req, "x-cron-secret");
  if (preflight) return preflight;

  // O segredo vem do VAULT, não do ambiente. É contrato da casa
  // (`src/test/credenciais-vault.test.ts`): toda `Deno.env.get` nova vira uma
  // linha na tela "Update secrets" que o Lovable monta para quem remixa o
  // whitelabel — fricção para todo cliente por causa de uma chave interna.
  const esperado = await getCronSecret();
  if (!esperado || req.headers.get("x-cron-secret") !== esperado) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: pendentes } = await supabase
    .from("webhooks_fila")
    .select("id, webhook_id, evento, payload, tentativas")
    .is("entregue_em", null)
    .lt("tentativas", TENTATIVAS_MAXIMAS)
    .order("criado_em", { ascending: true })
    .limit(LOTE);

  const resultado = { lidos: 0, entregues: 0, falhas: 0, desligados: 0 };

  for (const evento of pendentes ?? []) {
    resultado.lidos++;

    const { data: destino } = await supabase
      .from("webhooks_saida")
      .select("id, url, segredo, ativo, falhas_seguidas")
      .eq("id", evento.webhook_id)
      .maybeSingle();

    // Destino desligado no meio da fila: o evento sai dela em vez de ficar
    // preso para sempre consumindo lote.
    if (!destino || !destino.ativo) {
      await supabase
        .from("webhooks_fila")
        .update({ entregue_em: new Date().toISOString(), ultimo_erro: "destino desligado" })
        .eq("id", evento.id);
      continue;
    }

    // O corpo é montado UMA vez e assinado exatamente como será enviado.
    const corpo = JSON.stringify(evento.payload);
    const assinatura = await assinar(corpo, destino.segredo);

    let ok = false;
    let erro = "";
    const controle = new AbortController();
    const relogio = setTimeout(() => controle.abort(), TEMPO_LIMITE_MS);

    try {
      const r = await fetch(destino.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-financeai-signature": assinatura,
          "x-financeai-event": evento.evento,
        },
        body: corpo,
        signal: controle.signal,
      });
      ok = r.ok;
      if (!ok) erro = `HTTP ${r.status}`;
    } catch (e) {
      erro = e instanceof Error ? e.message : String(e);
    } finally {
      clearTimeout(relogio);
    }

    if (ok) {
      resultado.entregues++;
      await supabase
        .from("webhooks_fila")
        .update({ entregue_em: new Date().toISOString(), ultimo_erro: null })
        .eq("id", evento.id);
      await supabase
        .from("webhooks_saida")
        .update({
          ultima_entrega_em: new Date().toISOString(),
          falhas_seguidas: 0,
          ultimo_erro: null,
        })
        .eq("id", destino.id);
    } else {
      resultado.falhas++;
      const seguidas = (destino.falhas_seguidas ?? 0) + 1;
      await supabase
        .from("webhooks_fila")
        .update({ tentativas: evento.tentativas + 1, ultimo_erro: erro })
        .eq("id", evento.id);
      await supabase
        .from("webhooks_saida")
        .update({
          falhas_seguidas: seguidas,
          ultimo_erro: erro,
          ...(seguidas >= FALHAS_ATE_DESLIGAR ? { ativo: false } : {}),
        })
        .eq("id", destino.id);
      if (seguidas >= FALHAS_ATE_DESLIGAR) resultado.desligados++;
    }
  }

  return new Response(JSON.stringify({ success: true, data: resultado, error: null }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
