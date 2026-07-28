import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";
import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";

const EXTRA_HEADERS = "x-webhook-token";

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req, EXTRA_HEADERS);
  const preflight = corsPreflightResponse(req, EXTRA_HEADERS);
  if (preflight) return preflight;

  try {
    const url = new URL(req.url);
    // Extract webhook ID from path: /webhook-receiver/{webhookId}
    const pathParts = url.pathname.split("/").filter(Boolean);
    const webhookId = pathParts[pathParts.length - 1];

    if (!webhookId || webhookId === "webhook-receiver") {
      return new Response(JSON.stringify({ error: "Webhook ID required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Find webhook config
    const { data: webhook, error: whError } = await supabase
      .from("webhooks")
      .select("*")
      .eq("id", webhookId)
      .eq("direction", "inbound")
      .eq("active", true)
      .single();

    if (whError || !webhook) {
      return new Response(JSON.stringify({ error: "Webhook not found or inactive" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate token
    const token = req.headers.get("x-webhook-token") || url.searchParams.get("token");
    if (token !== webhook.secret_token) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse payload
    let payload: Record<string, unknown> = {};
    if (req.method === "POST" || req.method === "PUT") {
      try {
        payload = await req.json();
      } catch {
        payload = { raw: await req.text() };
      }
    }

    // Log the webhook
    const logEntry: Record<string, unknown> = {
      webhook_id: webhook.id,
      company_id: webhook.company_id,
      direction: "inbound",
      payload,
      status: "received",
    };

    // Auto-create transaction if enabled
    if (webhook.auto_create_transaction) {
      try {
        const amount = Number(payload.amount || payload.valor || payload.value || 0);
        const description =
          String(payload.description || payload.descricao || payload.memo || "Webhook automático");
        const date =
          String(payload.date || payload.data || new Date().toISOString().split("T")[0]);
        const type = webhook.default_type || "expense";

        if (amount > 0) {
          // We need a user_id for the transaction — use the first admin member
          const { data: member } = await supabase
            .from("company_members")
            .select("user_id")
            .eq("company_id", webhook.company_id)
            .eq("role", "admin")
            .limit(1)
            .single();

          if (member) {
            const { data: tx, error: txError } = await supabase
              .from("transactions")
              .insert({
                company_id: webhook.company_id,
                user_id: member.user_id,
                description,
                amount,
                type,
                date,
                source: "webhook",
                status: "pending",
                account_id: webhook.default_account_id || null,
                cost_center_id: webhook.default_cost_center_id || null,
              })
              .select("id")
              .single();

            if (txError) {
              logEntry.status = "failed";
              logEntry.error_message = txError.message;
            } else {
              logEntry.status = "processed";
              logEntry.transaction_id = tx?.id;
            }
          } else {
            logEntry.status = "failed";
            logEntry.error_message = "No admin member found";
          }
        } else {
          logEntry.status = "processed";
          logEntry.error_message = "Amount is zero or missing, skipped transaction";
        }
      } catch (err) {
        logEntry.status = "failed";
        logEntry.error_message = err instanceof Error ? err.message : "Unknown error";
      }
    } else {
      logEntry.status = "processed";
    }

    await supabase.from("webhook_logs").insert(logEntry);

    return new Response(
      JSON.stringify({ success: true, status: logEntry.status }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
