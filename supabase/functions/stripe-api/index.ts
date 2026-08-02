/**
 * Stripe — ações que a tela dispara.
 *
 * POST /stripe-api
 *   { action: "testar", company_id, config_id? }               → a chave funciona?
 *   { action: "cobrar", company_id, receivable_id, config_id? } → link de pagamento do título
 *   { action: "sincronizar", company_id, dias?, config_id? }    → puxa repasses e cobranças
 *   { action: "conciliar", company_id, payout_id, config_id? }  → casa o repasse N:1
 *
 * Uma empresa pode ter N canais Stripe ("Loja SP", "Checkout site"). `config_id`
 * escolhe o canal; quando a empresa tem um só, ele pode ser omitido e o canal é
 * resolvido sozinho. Com dois ou mais, omitir é ambíguo e a chamada é recusada —
 * adivinhar o canal moveria dinheiro na conta errada.
 *
 * A secret key nunca sai do Vault: quem lê é o service_role aqui dentro. O browser
 * só conhece a publishable key, que é pública por definição.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";
import { authenticate, assertMembership, assertCanWrite, jsonResp } from "../_shared/auth.ts";
import {
  stripeGet,
  stripePost,
  componhoRepasse,
  conciliaRepasse,
  reconheceCobranca,
} from "../_shared/stripe-sync.ts";
import { paraCentavos } from "../_shared/stripe-reconcile.ts";

/** Quantos dias de repasse a sincronização olha para trás por padrão. */
const DIAS_PADRAO = 30;
/** Teto do intervalo: além disso a chamada estoura o tempo da edge function. */
const DIAS_MAXIMO = 180;

Deno.serve(async (req) => {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const { user, supabase, corsHeaders } = auth;

  const service = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action as string;
    const companyId = body.company_id as string | undefined;
    if (!companyId) return jsonResp({ error: "company_id é obrigatório" }, 400, corsHeaders);

    const forbidden = await assertMembership(supabase, user.id, companyId, corsHeaders);
    if (forbidden) return forbidden;
    // Toda ação aqui mexe em dinheiro ou em credencial: papel de leitura não passa.
    const readonly = await assertCanWrite(supabase, user.id, companyId, corsHeaders);
    if (readonly) return readonly;

    // Qual canal? O informado, ou o único da empresa. Com N canais e nenhum
    // informado, recusar é a única saída honesta: escolher por conta própria
    // cobraria na conta errada.
    let configId = (body.config_id as string | undefined) ?? null;
    if (!configId) {
      const { data } = await service.rpc("resolver_canal_stripe_unico", { p_company_id: companyId });
      configId = (data as string | null) ?? null;
    }
    if (!configId) {
      const { count } = await service
        .from("stripe_config").select("id", { count: "exact", head: true })
        .eq("company_id", companyId);
      return jsonResp(
        {
          error: (count ?? 0) > 1
            ? "Esta empresa tem mais de um canal Stripe. Escolha o canal antes de continuar."
            : "Stripe não configurado: informe a chave secreta em Configurações.",
        },
        400,
        corsHeaders,
      );
    }

    // O canal informado tem que ser DESTA empresa. Sem esta checagem, um membro
    // da empresa A poderia operar o canal da empresa B passando o id dele.
    const { data: canal } = await service
      .from("stripe_config").select("id, apelido")
      .eq("id", configId).eq("company_id", companyId).maybeSingle();
    if (!canal) return jsonResp({ error: "Canal Stripe não pertence a esta empresa." }, 403, corsHeaders);

    // Conciliar só lê o que já foi guardado e escreve no ERP: não fala com o
    // Stripe. Exigir a chave aí travaria a conciliação de um repasse já
    // sincronizado sempre que a credencial fosse rotacionada ou removida.
    const precisaDaChave = action !== "conciliar";

    const { data: cred } = await service.rpc("get_stripe_credentials", { p_config_id: configId });
    const secretKey = (cred?.secret_key as string) ?? Deno.env.get("STRIPE_SECRET_KEY") ?? "";
    if (precisaDaChave && !secretKey) {
      return jsonResp(
        { error: `Canal "${canal.apelido}" sem chave secreta. Informe em Configurações.` },
        400,
        corsHeaders,
      );
    }

    if (action === "testar") {
      const saldo = await stripeGet(secretKey, "/balance");
      const disponivel = ((saldo.available as Record<string, unknown>[]) ?? [])[0] ?? {};
      await service
        .from("stripe_config")
        .update({ last_test_at: new Date().toISOString(), last_test_status: "ok" })
        .eq("id", configId);
      return jsonResp(
        {
          ok: true,
          modo: saldo.livemode ? "live" : "test",
          moeda: (disponivel.currency as string) ?? "brl",
          saldo_disponivel: Number(disponivel.amount ?? 0),
        },
        200,
        corsHeaders,
      );
    }

    if (action === "cobrar") {
      const receivableId = body.receivable_id as string;
      if (!receivableId) return jsonResp({ error: "receivable_id é obrigatório" }, 400, corsHeaders);

      const { data: titulo } = await service
        .from("receivables")
        .select("id, description, amount, status, stripe_checkout_url, contact_id")
        .eq("company_id", companyId)
        .eq("id", receivableId)
        .maybeSingle();
      if (!titulo) return jsonResp({ error: "Título não encontrado" }, 404, corsHeaders);
      if (titulo.status === "recebido") {
        return jsonResp({ error: "Este título já foi recebido." }, 400, corsHeaders);
      }
      // Link já gerado é reaproveitado: gerar outro criaria dois payment_intents
      // para o mesmo título e a baixa poderia acontecer duas vezes.
      if (titulo.stripe_checkout_url) {
        return jsonResp({ ok: true, url: titulo.stripe_checkout_url, reaproveitado: true }, 200, corsHeaders);
      }

      let email: string | null = null;
      if (titulo.contact_id) {
        const { data: contato } = await service
          .from("contacts").select("email").eq("id", titulo.contact_id).maybeSingle();
        email = (contato?.email as string) ?? null;
      }

      const origem = req.headers.get("origin") ?? "";
      const form: Record<string, string> = {
        mode: "payment",
        "line_items[0][price_data][currency]": "brl",
        "line_items[0][price_data][unit_amount]": String(paraCentavos(Number(titulo.amount))),
        "line_items[0][price_data][product_data][name]":
          (titulo.description as string) || "Cobrança",
        "line_items[0][quantity]": "1",
        // metadata é o que amarra a cobrança ao título quando o webhook chegar.
        "metadata[receivable_id]": receivableId,
        "metadata[company_id]": companyId,
        "payment_intent_data[metadata][receivable_id]": receivableId,
        success_url: `${origem}/recebiveis?pago=1`,
        cancel_url: `${origem}/recebiveis?pago=0`,
      };
      if (email) form.customer_email = email;

      const sessao = await stripePost(secretKey, "/checkout/sessions", form);

      await service
        .from("receivables")
        .update({
          stripe_payment_intent_id: (sessao.payment_intent as string) ?? null,
          stripe_checkout_url: (sessao.url as string) ?? null,
        })
        .eq("id", receivableId);

      return jsonResp({ ok: true, url: sessao.url, session_id: sessao.id }, 200, corsHeaders);
    }

    if (action === "sincronizar") {
      const dias = Math.min(Number(body.dias ?? DIAS_PADRAO) || DIAS_PADRAO, DIAS_MAXIMO);
      const desde = Math.floor(Date.now() / 1000) - dias * 86400;

      // Cobranças primeiro: sem elas o repasse não tem do que ser composto.
      const cobrancas = await stripeGet(secretKey, "/charges", {
        limit: "100",
        "created[gte]": String(desde),
      });
      let cobrancasVistas = 0;
      for (const c of ((cobrancas.data as Record<string, unknown>[]) ?? [])) {
        await reconheceCobranca(service, companyId, c, secretKey, configId);
        cobrancasVistas += 1;
      }

      const repasses = await stripeGet(secretKey, "/payouts", {
        limit: "100",
        "created[gte]": String(desde),
      });
      const resultados: Record<string, unknown>[] = [];
      for (const p of ((repasses.data as Record<string, unknown>[]) ?? [])) {
        const r = await componhoRepasse(service, companyId, secretKey, p, configId);
        resultados.push({ payout_id: p.id, ...r });
      }

      await service
        .from("stripe_config")
        .update({ last_sync_at: new Date().toISOString() })
        .eq("id", configId);

      return jsonResp(
        {
          ok: true,
          dias,
          cobrancas: cobrancasVistas,
          repasses: resultados.length,
          nao_fecham: resultados.filter((r) => !r.fecha).length,
          detalhe: resultados,
        },
        200,
        corsHeaders,
      );
    }

    if (action === "conciliar") {
      const payoutId = body.payout_id as string;
      if (!payoutId) return jsonResp({ error: "payout_id é obrigatório" }, 400, corsHeaders);
      const r = await conciliaRepasse(service, companyId, payoutId, configId);
      // Só "conciliado" é sucesso; o resto o usuário precisa ver como pendência.
      return jsonResp({ ok: r.status === "conciliado", ...r }, 200, corsHeaders);
    }

    return jsonResp({ error: `Ação inválida: ${action}` }, 400, corsHeaders);
  } catch (err) {
    console.error("[stripe-api] erro", err);
    return jsonResp({ error: String(err) }, 500, corsHeaders);
  }
});
