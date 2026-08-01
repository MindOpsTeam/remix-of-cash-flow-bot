/**
 * Webhook do Stripe — entradas por cartão/link e repasse em lote.
 *
 * POST /stripe-webhook?company=<uuid>
 *
 * Multi-tenant: o Stripe não sabe qual empresa é, então a empresa vem na URL e a
 * ASSINATURA é conferida contra o webhook secret DAQUELA empresa. Isso é o que
 * impede evento forjado apontando para a empresa dos outros: sem o segredo da
 * empresa certa, a assinatura não fecha.
 *
 * Eventos tratados:
 *   checkout.session.completed / payment_intent.succeeded / charge.succeeded
 *     → título baixado e receita reconhecida pelo BRUTO.
 *   payout.* → compõe e confere o lote (N cobranças + taxas = 1 crédito), que é o
 *     que a conciliação bancária precisa para casar N:1.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";
import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";
import {
  leAssinaturaStripe,
  assinaturaDentroDaJanela,
  cargaAssinada,
  comparaEmTempoConstante,
} from "../_shared/stripe-reconcile.ts";
import { stripeGet, reconheceCobranca, componhoRepasse } from "../_shared/stripe-sync.ts";

function hex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacSha256(segredo: string, mensagem: string): Promise<string> {
  const chave = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(segredo),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return hex(await crypto.subtle.sign("HMAC", chave, new TextEncoder().encode(mensagem)));
}

/**
 * Confere a assinatura do Stripe. Só passa se alguma assinatura v1 bater E o
 * timestamp estiver na janela — assinatura válida mas antiga é replay.
 */
async function assinaturaConfere(
  header: string | null,
  corpoCru: string,
  webhookSecret: string,
): Promise<boolean> {
  const sig = leAssinaturaStripe(header);
  if (!sig) return false;
  if (!assinaturaDentroDaJanela(sig.timestamp, Math.floor(Date.now() / 1000))) return false;
  const esperado = await hmacSha256(webhookSecret, cargaAssinada(sig.timestamp, corpoCru));
  return sig.assinaturas.some((a) => comparaEmTempoConstante(a, esperado));
}

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
    const companyId = new URL(req.url).searchParams.get("company");
    if (!companyId) return responde({ error: "company ausente na URL" }, 400);

    // Corpo CRU: a assinatura é sobre os bytes exatos. Fazer req.json() e depois
    // re-serializar muda a string e derruba a conferência.
    const corpoCru = await req.text();

    const { data: cred } = await service.rpc("get_stripe_credentials", { p_company_id: companyId });
    const secretKey = (cred?.secret_key as string) ?? Deno.env.get("STRIPE_SECRET_KEY") ?? "";
    const webhookSecret = (cred?.webhook_secret as string) ?? Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";

    // Sem segredo configurado não existe como provar autenticidade. Recusar é a
    // única resposta honesta: aceitar seria abrir escrita anônima na empresa.
    if (!webhookSecret) {
      return responde({ error: "webhook do Stripe não configurado para esta empresa" }, 401);
    }
    if (!(await assinaturaConfere(req.headers.get("stripe-signature"), corpoCru, webhookSecret))) {
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
          await reconheceCobranca(service, companyId, objeto, secretKey);
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
                service, companyId, { ...c, payment_intent: objeto.id }, secretKey,
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
              secretKey,
            );
          } else if (latest && typeof latest === "object") {
            await reconheceCobranca(
              service, companyId,
              { ...(latest as Record<string, unknown>), payment_intent: objeto.id, metadata: objeto.metadata },
              secretKey,
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
                secretKey,
              );
            }
          }
          break;
        }

        case "payout.paid":
        case "payout.reconciliation_completed":
        case "payout.updated":
          if (!secretKey) throw new Error("secret key do Stripe não configurada");
          await componhoRepasse(service, companyId, secretKey, objeto);
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
