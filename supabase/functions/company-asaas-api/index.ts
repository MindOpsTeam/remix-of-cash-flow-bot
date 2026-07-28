import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";
import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";
import { parseJsonBody, validate, validateRequired, validateEnum, validateUUID } from "../_shared/validate.ts";
import { mapTransferData, mapBillData, mapSubscriptionData } from "../_shared/asaas-processor.ts";

const EXTRA_HEADERS = "x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version";

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req, EXTRA_HEADERS);
  const preflight = corsPreflightResponse(req, EXTRA_HEADERS);
  if (preflight) return preflight;

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceClient = createClient(
    supabaseUrl,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const userClient = createClient(supabaseUrl, supabaseAnon, {
    global: { headers: { Authorization: authHeader } },
  });

  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
  if (claimsError || !claimsData?.claims) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userId = claimsData.claims.sub;

  try {
    const parsed = await parseJsonBody(req);
    if ("error" in parsed) {
      return new Response(JSON.stringify({ error: parsed.error }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const body = parsed.data;
    const { action, company_id } = body;

    const validationError = validate(
      validateRequired(body, ["action", "company_id"]),
      validateEnum(action, "action", ["test-connection", "create-webhook", "reactivate-webhook", "get-webhook-status", "sync-payments", "sync-transfers", "sync-bills", "sync-subscriptions", "create-customer", "create-subscription", "create-payment"]),
      validateUUID(company_id, "company_id"),
    );
    if (validationError) {
      return new Response(JSON.stringify({ error: validationError }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate user is a member of the company
    const { data: membership } = await serviceClient
      .from("company_members")
      .select("id")
      .eq("company_id", company_id)
      .eq("user_id", userId)
      .maybeSingle();

    if (!membership) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get Asaas config by company_id
    const { data: config } = await serviceClient
      .from("company_asaas_config")
      .select("*")
      .eq("company_id", company_id)
      .maybeSingle();

    if (!config) {
      return new Response(
        JSON.stringify({ error: "Asaas not configured" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const env = config.environment || "sandbox";
    const secretKey = env === "production"
      ? Deno.env.get("ASAAS_API_KEY_PRODUCTION")
      : Deno.env.get("ASAAS_API_KEY_SANDBOX");
    const dbKey = env === "production" ? config.api_key_production : config.api_key_sandbox;
    const apiKey = secretKey || dbKey;

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: `API key not configured for environment: ${env}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const baseUrl = env === "production"
      ? "https://api.asaas.com"
      : "https://api-sandbox.asaas.com";

    const asaasHeaders = {
      accept: "application/json",
      "content-type": "application/json",
      access_token: apiKey,
    };

    let result: unknown;

    switch (action) {
      case "test-connection": {
        const resp = await fetch(`${baseUrl}/v3/finance/getCurrentBalance`, {
          headers: asaasHeaders,
        });
        result = await resp.json();

        // External credential errors should not break frontend runtime flow.
        // Return 200 with ok=false so callers can handle gracefully.
        if (!resp.ok) {
          return new Response(
            JSON.stringify({
              ok: false,
              error: "Asaas API error",
              asaas_status: resp.status,
              details: result,
            }),
            {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
        break;
      }

      case "create-webhook": {
        const webhookUrl = `${supabaseUrl}/functions/v1/company-asaas-webhook`;
        const webhookPayload: Record<string, unknown> = {
          name: "FinanceAI Empresa - Webhook Automático",
          url: webhookUrl,
          email: config.webhook_email || config.notification_email || undefined,
          enabled: true,
          interrupted: false,
          authToken: config.webhook_auth_token || undefined,
          apiVersion: 3,
          sendType: config.webhook_send_type || "SEQUENTIALLY",
          events: (config.enabled_events as string[])?.length > 0
            ? config.enabled_events
            : undefined,
        };

        if (config.webhook_id) {
          const resp = await fetch(`${baseUrl}/v3/webhooks/${config.webhook_id}`, {
            method: "PUT",
            headers: asaasHeaders,
            body: JSON.stringify(webhookPayload),
          });
          result = await resp.json();
        } else {
          const resp = await fetch(`${baseUrl}/v3/webhooks`, {
            method: "POST",
            headers: asaasHeaders,
            body: JSON.stringify(webhookPayload),
          });
          result = await resp.json();
        }

        const webhookResult = result as Record<string, unknown>;
        if (webhookResult.id) {
          await serviceClient
            .from("company_asaas_config")
            .update({
              webhook_id: webhookResult.id as string,
              webhook_url: webhookUrl,
              webhook_status: webhookResult.enabled ? "active" : "inactive",
            })
            .eq("id", config.id);
        }
        break;
      }

      case "reactivate-webhook": {
        if (!config.webhook_id) {
          return new Response(JSON.stringify({ error: "No webhook configured" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const resp = await fetch(`${baseUrl}/v3/webhooks/${config.webhook_id}`, {
          method: "PUT",
          headers: asaasHeaders,
          body: JSON.stringify({ interrupted: false, enabled: true }),
        });
        result = await resp.json();

        await serviceClient
          .from("company_asaas_config")
          .update({ webhook_status: "active" })
          .eq("id", config.id);
        break;
      }

      case "get-webhook-status": {
        if (!config.webhook_id) {
          result = { status: "not_configured" };
          break;
        }

        const resp = await fetch(`${baseUrl}/v3/webhooks/${config.webhook_id}`, {
          headers: asaasHeaders,
        });
        result = await resp.json();

        const webhookData = result as Record<string, unknown>;
        let newStatus = "inactive";
        if (webhookData.enabled && !webhookData.interrupted) newStatus = "active";
        else if (webhookData.interrupted) newStatus = "interrupted";

        await serviceClient
          .from("company_asaas_config")
          .update({ webhook_status: newStatus })
          .eq("id", config.id);
        break;
      }

      case "sync-payments": {
        let offset = 0;
        const limit = 100;
        let totalSynced = 0;

        while (true) {
          const resp = await fetch(
            `${baseUrl}/v3/payments?offset=${offset}&limit=${limit}`,
            { headers: asaasHeaders }
          );
          const data = await resp.json() as { data?: Record<string, unknown>[]; totalCount?: number };

          if (!data.data || data.data.length === 0) break;

          for (const p of data.data) {
            await serviceClient
              .from("company_asaas_payments")
              .upsert({
                company_id,
                asaas_id: p.id as string,
                customer_id: p.customer as string || null,
                subscription_id: p.subscription as string || null,
                installment_id: p.installment as string || null,
                payment_link: p.paymentLink as string || null,
                billing_type: p.billingType as string || null,
                status: p.status as string,
                value: p.value as number || null,
                net_value: p.netValue as number || null,
                description: p.description as string || null,
                external_reference: p.externalReference as string || null,
                due_date: p.dueDate as string || null,
                payment_date: p.paymentDate as string || null,
                confirmed_date: p.confirmedDate as string || null,
                credit_date: p.creditDate as string || null,
                invoice_url: p.invoiceUrl as string || null,
                bank_slip_url: p.bankSlipUrl as string || null,
                pix_transaction: p.pixTransaction || null,
                credit_card: p.creditCard || null,
                discount: p.discount || null,
                fine: p.fine || null,
                interest: p.interest || null,
                split: p.split || null,
                chargeback: p.chargeback || null,
                refunds: p.refunds || null,
                raw_payload: p,
              }, { onConflict: "company_id,asaas_id" });
            totalSynced++;
          }

          if (!data.totalCount || offset + limit >= data.totalCount) break;
          offset += limit;
        }

        result = { synced: totalSynced };
        break;
      }

      case "sync-transfers": {
        let offset = 0;
        const limit = 100;
        let totalSynced = 0;
        while (true) {
          const resp = await fetch(`${baseUrl}/v3/transfers?offset=${offset}&limit=${limit}`, { headers: asaasHeaders });
          const data = await resp.json() as { data?: Record<string, unknown>[]; totalCount?: number };
          if (!data.data || data.data.length === 0) break;
          for (const t of data.data) {
            await serviceClient.from("company_asaas_transfers").upsert(mapTransferData(company_id as string, t), { onConflict: "company_id,asaas_id" });
            totalSynced++;
          }
          if (!data.totalCount || offset + limit >= data.totalCount) break;
          offset += limit;
        }
        result = { synced: totalSynced };
        break;
      }

      case "sync-bills": {
        let offset = 0;
        const limit = 100;
        let totalSynced = 0;
        while (true) {
          const resp = await fetch(`${baseUrl}/v3/bill?offset=${offset}&limit=${limit}`, { headers: asaasHeaders });
          const data = await resp.json() as { data?: Record<string, unknown>[]; totalCount?: number };
          if (!data.data || data.data.length === 0) break;
          for (const b of data.data) {
            await serviceClient.from("company_asaas_bills").upsert(mapBillData(company_id as string, b), { onConflict: "company_id,asaas_id" });
            totalSynced++;
          }
          if (!data.totalCount || offset + limit >= data.totalCount) break;
          offset += limit;
        }
        result = { synced: totalSynced };
        break;
      }

      case "sync-subscriptions": {
        let offset = 0;
        const limit = 100;
        let totalSynced = 0;
        while (true) {
          const resp = await fetch(`${baseUrl}/v3/subscriptions?offset=${offset}&limit=${limit}`, { headers: asaasHeaders });
          const data = await resp.json() as { data?: Record<string, unknown>[]; totalCount?: number };
          if (!data.data || data.data.length === 0) break;
          for (const s of data.data) {
            await serviceClient.from("company_asaas_subscriptions").upsert(mapSubscriptionData(company_id as string, s), { onConflict: "company_id,asaas_id" });
            totalSynced++;
          }
          if (!data.totalCount || offset + limit >= data.totalCount) break;
          offset += limit;
        }
        result = { synced: totalSynced };
        break;
      }

      // ---- Escrita no Asaas (Contratos / Contas a Receber) ----
      // Erro de credencial/validação do Asaas volta 200 com ok:false + details,
      // pro front tratar sem quebrar (mesma filosofia do test-connection).
      case "create-customer": {
        const customer = body.customer as Record<string, unknown> | undefined;
        if (!customer || !customer.name || !customer.cpfCnpj) {
          return new Response(
            JSON.stringify({ error: "customer.name e customer.cpfCnpj são obrigatórios" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const externalReference =
          (customer.externalReference as string) || (body.external_reference as string) || undefined;

        // find-or-create por externalReference (evita cliente duplicado no Asaas)
        if (externalReference) {
          const findResp = await fetch(
            `${baseUrl}/v3/customers?externalReference=${encodeURIComponent(externalReference)}`,
            { headers: asaasHeaders }
          );
          const found = await findResp.json() as { data?: Record<string, unknown>[] };
          if (found.data && found.data.length > 0) {
            result = found.data[0];
            break;
          }
        }

        const resp = await fetch(`${baseUrl}/v3/customers`, {
          method: "POST",
          headers: asaasHeaders,
          body: JSON.stringify({ ...customer, externalReference }),
        });
        result = await resp.json();
        if (!resp.ok) {
          return new Response(
            JSON.stringify({ ok: false, error: "Asaas API error", asaas_status: resp.status, details: result }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        break;
      }

      case "create-subscription": {
        const sub = body.subscription as Record<string, unknown> | undefined;
        if (!sub || !sub.customer || !sub.value || !sub.nextDueDate) {
          return new Response(
            JSON.stringify({ error: "subscription.customer, value e nextDueDate são obrigatórios" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const payload: Record<string, unknown> = {
          customer: sub.customer,
          billingType: sub.billingType || "BOLETO",
          value: sub.value,
          nextDueDate: sub.nextDueDate,
          cycle: sub.cycle || "MONTHLY",
          description: sub.description || undefined,
          externalReference: sub.externalReference || undefined,
          endDate: sub.endDate || undefined,
          maxPayments: sub.maxPayments || undefined,
        };
        const resp = await fetch(`${baseUrl}/v3/subscriptions`, {
          method: "POST",
          headers: asaasHeaders,
          body: JSON.stringify(payload),
        });
        result = await resp.json();
        if (!resp.ok) {
          return new Response(
            JSON.stringify({ ok: false, error: "Asaas API error", asaas_status: resp.status, details: result }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        // espelha a assinatura recém-criada na tabela local
        const s = result as Record<string, unknown>;
        if (s.id) {
          await serviceClient
            .from("company_asaas_subscriptions")
            .upsert(mapSubscriptionData(company_id as string, s), { onConflict: "company_id,asaas_id" });
        }
        break;
      }

      case "create-payment": {
        const pay = body.payment as Record<string, unknown> | undefined;
        if (!pay || !pay.customer || !pay.value || !pay.dueDate) {
          return new Response(
            JSON.stringify({ error: "payment.customer, value e dueDate são obrigatórios" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const payload: Record<string, unknown> = {
          customer: pay.customer,
          billingType: pay.billingType || "BOLETO",
          value: pay.value,
          dueDate: pay.dueDate,
          description: pay.description || undefined,
          externalReference: pay.externalReference || undefined,
        };
        const resp = await fetch(`${baseUrl}/v3/payments`, {
          method: "POST",
          headers: asaasHeaders,
          body: JSON.stringify(payload),
        });
        result = await resp.json();
        if (!resp.ok) {
          return new Response(
            JSON.stringify({ ok: false, error: "Asaas API error", asaas_status: resp.status, details: result }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        break;
      }

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    return new Response(JSON.stringify({ ok: true, data: result }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Company Asaas API error:", err);
    return new Response(
      JSON.stringify({ error: "Internal error", message: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
