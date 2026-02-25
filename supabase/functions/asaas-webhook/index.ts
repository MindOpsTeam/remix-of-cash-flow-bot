import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, asaas-access-token",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const accessToken = req.headers.get("asaas-access-token");
    if (!accessToken) {
      return new Response(JSON.stringify({ error: "Missing access token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find company config by webhook auth token
    const { data: config, error: configError } = await supabase
      .from("asaas_config")
      .select("id, company_id, enabled_events")
      .eq("webhook_auth_token", accessToken)
      .maybeSingle();

    if (configError || !config) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const event = body.event as string;
    const payment = body.payment || body.transfer || body.bill || body.invoice || body.anticipation || {};
    const entityId = payment?.id || body.id || null;
    const dateCreated = payment?.dateCreated || body.dateCreated || new Date().toISOString();

    // Check if event is enabled
    const enabledEvents = (config.enabled_events as string[]) || [];
    if (enabledEvents.length > 0 && !enabledEvents.includes(event)) {
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate idempotency key
    const idempotencyKey = `${event}_${entityId || "unknown"}_${dateCreated}`;

    // Check for duplicate
    const { data: existing } = await supabase
      .from("asaas_webhook_logs")
      .select("id")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({ ok: true, duplicate: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert log
    const { error: insertError } = await supabase
      .from("asaas_webhook_logs")
      .insert({
        company_id: config.company_id,
        asaas_event: event,
        entity_id: entityId,
        payload: body,
        http_status_returned: 200,
        idempotency_key: idempotencyKey,
        processed: false,
      });

    if (insertError) {
      // If duplicate key constraint, it's fine
      if (insertError.code === "23505") {
        return new Response(JSON.stringify({ ok: true, duplicate: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.error("Insert error:", insertError);
      return new Response(JSON.stringify({ error: "Failed to log" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
