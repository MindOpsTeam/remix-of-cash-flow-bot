import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";
import { parseJsonBody, validate, validateRequired, validateEnum } from "../_shared/validate.ts";
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
    const { action } = body;

    const validationError = validate(
      validateRequired(body, ["action"]),
      validateEnum(action, "action", ["test-connection", "create-webhook", "reactivate-webhook", "get-webhook-status", "sync-payments", "sync-transfers", "sync-bills", "sync-subscriptions"]),
    );
    if (validationError) {
      return new Response(JSON.stringify({ error: validationError }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get Asaas config by user_id
    const { data: config } = await serviceClient
      .from("asaas_config")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (!config) {
      return new Response(
        JSON.stringify({ error: "Asaas not configured" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const env = config.environment || "sandbox";
    // Priority: 1) Deno secret, 2) DB config
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
        if (!resp.ok) {
          return new Response(JSON.stringify({ error: "Asaas API error", details: result }), {
            status: resp.status,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        break;
      }

      case "create-webhook": {
        const webhookUrl = `${supabaseUrl}/functions/v1/asaas-webhook`;
        const webhookPayload: Record<string, unknown> = {
          name: "FinanceAI - Webhook Automático",
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
            .from("asaas_config")
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
          .from("asaas_config")
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
          .from("asaas_config")
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
              .from("asaas_payments")
              .upsert({
                user_id: userId,
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
              }, { onConflict: "user_id,asaas_id" });
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
            await serviceClient.from("asaas_transfers").upsert(mapTransferData("user_id", userId, t), { onConflict: "user_id,asaas_id" });
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
            await serviceClient.from("asaas_bills").upsert(mapBillData("user_id", userId, b), { onConflict: "user_id,asaas_id" });
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
            await serviceClient.from("asaas_subscriptions").upsert(mapSubscriptionData("user_id", userId, s), { onConflict: "user_id,asaas_id" });
            totalSynced++;
          }
          if (!data.totalCount || offset + limit >= data.totalCount) break;
          offset += limit;
        }
        result = { synced: totalSynced };
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
    console.error("Asaas API error:", err);
    return new Response(
      JSON.stringify({ error: "Internal error", message: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
