import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, asaas-access-token",
};

function getEventCategory(event: string): string {
  if (event.startsWith("PAYMENT_")) return "PAYMENT";
  if (event.startsWith("TRANSFER_")) return "TRANSFER";
  if (event.startsWith("BILL_")) return "BILL";
  if (event.startsWith("INVOICE_")) return "INVOICE";
  if (event.startsWith("ANTICIPATION_")) return "ANTICIPATION";
  if (event.startsWith("MOBILE_PHONE_RECHARGE_")) return "MOBILE_PHONE_RECHARGE";
  if (event.startsWith("ACCOUNT_STATUS_")) return "ACCOUNT_STATUS";
  return "OTHER";
}

function getEntityFromPayload(body: Record<string, unknown>): { id: string | null; type: string | null } {
  if (body.payment) return { id: (body.payment as any)?.id || null, type: "payment" };
  if (body.transfer) return { id: (body.transfer as any)?.id || null, type: "transfer" };
  if (body.bill) return { id: (body.bill as any)?.id || null, type: "bill" };
  if (body.invoice) return { id: (body.invoice as any)?.id || null, type: "invoice" };
  if (body.anticipation) return { id: (body.anticipation as any)?.id || null, type: "anticipation" };
  return { id: null, type: null };
}

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

    // Find user config by webhook auth token
    const { data: config, error: configError } = await supabase
      .from("asaas_config")
      .select("id, user_id, enabled_events")
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
    const eventId = body.id as string; // Asaas payload id for idempotency
    const eventCategory = getEventCategory(event);
    const entity = getEntityFromPayload(body);

    // Check if event is enabled
    const enabledEvents = (config.enabled_events as string[]) || [];
    if (enabledEvents.length > 0 && !enabledEvents.includes(event)) {
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert event (idempotent via UNIQUE(user_id, event_id))
    const { error: insertError } = await supabase
      .from("asaas_webhook_events")
      .insert({
        user_id: config.user_id,
        event_id: eventId || `${event}_${entity.id || "unknown"}_${Date.now()}`,
        event_type: event,
        event_category: eventCategory,
        entity_id: entity.id,
        entity_type: entity.type,
        payload: body,
      });

    if (insertError) {
      // Duplicate key = already processed, return 200
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

    // For PAYMENT events, upsert into asaas_payments
    if (eventCategory === "PAYMENT" && body.payment) {
      const p = body.payment as Record<string, unknown>;
      const paymentData = {
        user_id: config.user_id,
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
      };

      await supabase
        .from("asaas_payments")
        .upsert(paymentData, { onConflict: "user_id,asaas_id" });
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
