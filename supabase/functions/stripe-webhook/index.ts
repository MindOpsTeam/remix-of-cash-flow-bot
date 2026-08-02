/**
 * Webhook do Stripe — entradas por cartão/link e repasse em lote.
 *
 * POST /stripe-webhook?config=<config_id>   (endereço novo, por CANAL)
 * POST /stripe-webhook?company=<uuid>        (compatibilidade, só com 1 canal)
 *
 * Multi-tenant e multi-canal: o Stripe não sabe de empresa nem de canal, então o
 * destino vem na URL e a ASSINATURA é conferida contra o webhook secret DAQUELE
 * CANAL. É isso que impede evento forjado de entrar na empresa dos outros — e
 * também que o canal "Loja SP" receba o que era do "Checkout site".
 *
 * O endereço por empresa continua aceito enquanto a empresa tiver um canal só:
 * webhooks já cadastrados no dashboard do Stripe não podem parar no dia do
 * deploy. A partir do segundo canal a empresa vira ambígua e o endereço precisa
 * apontar o canal — recusar aí é melhor do que adivinhar.
 *
 * Eventos tratados:
 *   checkout.session.completed / payment_intent.succeeded / charge.succeeded
 *     → título baixado e receita reconhecida pelo BRUTO.
 *   payout.* → compõe e confere o lote (N cobranças + taxas = 1 crédito), que é o
 *     que a conciliação bancária precisa para casar N:1.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";
import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";
import { assinaturaStripeConfere } from "../_shared/stripe-reconcile.ts";
import { stripeGet, reconheceCobranca, componhoRepasse } from "../_shared/stripe-sync.ts";

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req, "stripe-signature");
  const preflight = corsPreflightResponse(req, "stripe-signature");
  if (preflight) return preflight;

  const responde = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  if (req.method !== "POST") return responde({ error: "Method not allowed" }, 405);

  const service = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const params = new URL(req.url).searchParams;
    let configId = params.get("config");
    const companyParam = params.get("company");

    if (!configId && companyParam) {
      // Compatibilidade: resolve a empresa para o canal único dela. Devolve nulo
      // quando há mais de um — aí o endereço é genuinamente ambíguo.
      const { data } = await service.rpc("resolver_canal_stripe_unico", { p_company_id: companyParam });
      configId = (data as string | null) ?? null;
      if (!configId) {
        return responde({
          error: "Esta empresa tem mais de um canal Stripe. Aponte o webhook para ?config=<id do canal>.",
        }, 400);
      }
    }
    if (!configId) return responde({ error: "config (ou company) ausente na URL" }, 400);

    // Corpo CRU: a assinatura é sobre os bytes exatos. Fazer req.json() e depois
    // re-serializar muda a string e derruba a conferência.
    const corpoCru = await req.text();

    const { data: cred } = await service.rpc("get_stripe_credentials", { p_config_id: configId });
    const companyId = (cred?.company_id as string) ?? null;
    if (!companyId) return responde({ error: "canal Stripe não encontrado" }, 404);
    const secretKey = (cred?.secret_key as string) ?? Deno.env.get("STRIPE_SECRET_KEY") ?? "";
    const webhookSecret = (cred?.webhook_secret as string) ?? Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";

    // Sem segredo configurado não existe como provar autenticidade. Recusar é a
    // única resposta honesta: aceitar seria abrir escrita anônima na empresa.
    if (!webhookSecret) {
      return responde({ error: "webhook do Stripe não configurado para este canal" }, 401);
    }
    if (!(await assinaturaStripeConfere(req.headers.get("stripe-signature"), corpoCru, webhookSecret))) {
      return responde({ error: "assinatura inválida" }, 401);
    }

    const evento = JSON.parse(corpoCru) as Record<string, unknown>;
    const eventoId = evento.id as string;
    const tipo = (evento.type as string) ?? "";

    // Idempotência: o Stripe reenvia até receber 2xx. O UNIQUE do id do evento é
    // que impede o reenvio de lançar a mesma receita duas vezes.
    const { error: dupErr } = await service
      .from("stripe_events")
      .insert({ company_id: companyId, stripe_event_id: eventoId, type: tipo, raw: evento });
    if (dupErr) {
      if ((dupErr.code as string) === "23505") return responde({ ok: true, repetido: true });
      throw dupErr;
    }

    const objeto = ((evento.data as Record<string, unknown>)?.object ?? {}) as Record<string, unknown>;

    try {
      switch (tipo) {
        case "charge.succeeded":
        case "charge.updated":
          await reconheceCobranca(service, companyId, objeto, secretKey, configId);
          break;

        case "payment_intent.succeeded": {
          // charges[] saiu da API em 2022-11-15; hoje o intent aponta uma única
          // latest_charge. Aceitar as duas formas evita quebrar conforme a versão
          // de API configurada na conta do cliente.
          const embutidas = ((objeto.charges as Record<string, unknown>)?.data ??
            []) as Record<string, unknown>[];
          if (embutidas.length > 0) {
            for (const c of embutidas) {
              await reconheceCobranca(
                service, companyId, { ...c, payment_intent: objeto.id }, secretKey, configId,
              );
            }
            break;
          }
          const latest = objeto.latest_charge;
          if (typeof latest === "string" && secretKey) {
            const charge = await stripeGet(secretKey, `/charges/${latest}`);
            await reconheceCobranca(
              service, companyId,
              { ...charge, payment_intent: objeto.id, metadata: objeto.metadata ?? charge.metadata },
              secretKey, configId,
            );
          } else if (latest && typeof latest === "object") {
            await reconheceCobranca(
              service, companyId,
              { ...(latest as Record<string, unknown>), payment_intent: objeto.id, metadata: objeto.metadata },
              secretKey, configId,
            );
          }
          break;
        }

        case "checkout.session.completed": {
          const pi = objeto.payment_intent as string | null;
          if (pi && secretKey) {
            const intent = await stripeGet(secretKey, `/payment_intents/${pi}`, {
              "expand[]": "latest_charge",
            });
            const charge = intent.latest_charge as Record<string, unknown> | null;
            if (charge) {
              await reconheceCobranca(
                service, companyId,
                { ...charge, payment_intent: pi, metadata: objeto.metadata ?? charge.metadata },
                secretKey, configId,
              );
            }
          }
          break;
        }

        case "payout.paid":
        case "payout.reconciliation_completed":
        case "payout.updated":
          if (!secretKey) throw new Error("secret key do Stripe não configurada");
          await componhoRepasse(service, companyId, secretKey, objeto, configId);
          break;

        default:
          break; // registrado em stripe_events, sem efeito colateral
      }
    } catch (falha) {
      // A marca de idempotência já está gravada. Se o processamento morreu no meio,
      // manter a marca faria o reenvio do Stripe ser descartado como "repetido" e o
      // evento sumiria para sempre. Apaga a marca e devolve 500 para ele reenviar.
      await service.from("stripe_events").delete().eq("stripe_event_id", eventoId);
      throw falha;
    }

    return responde({ ok: true, tipo });
  } catch (err) {
    console.error("[stripe-webhook] erro", err);
    // 500 faz o Stripe reenviar — é o que queremos numa falha transitória, e a
    // trava de idempotência garante que o reenvio não duplique nada.
    return responde({ error: String(err) }, 500);
  }
});
