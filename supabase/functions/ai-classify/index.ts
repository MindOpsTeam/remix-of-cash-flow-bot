import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";
import { parseJsonBody, validate, validateRequired, validateString, validateEnum, validateUUID, sanitizeForPrompt } from "../_shared/validate.ts";

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const preflight = corsPreflightResponse(req);
  if (preflight) return preflight;

  try {
    // --- JWT verification ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify the caller's JWT by creating a client with their token
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = await parseJsonBody(req);
    if ("error" in parsed) {
      return new Response(JSON.stringify({ error: parsed.error }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { description, type, company_id } = parsed.data;

    const validationError = validate(
      validateRequired(parsed.data, ["description", "company_id"]),
      validateString(description, "description", 2000),
      validateUUID(company_id, "company_id"),
      type != null ? validateEnum(type, "type", ["revenue", "expense"]) : null,
    );
    if (validationError) {
      return new Response(JSON.stringify({ error: validationError }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user is a member of the company
    const adminClient = createClient(supabaseUrl, serviceKey);
    const { data: membership } = await adminClient
      .from("company_members")
      .select("id")
      .eq("company_id", company_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!membership) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [accountsRes, centersRes] = await Promise.all([
      adminClient.from("chart_of_accounts").select("id, name, code, type").eq("company_id", company_id),
      adminClient.from("cost_centers").select("id, name, category").eq("company_id", company_id).eq("active", true),
    ]);

    const accounts = (accountsRes.data || []).filter((a: any) => 
      type === "revenue" ? a.type === "revenue" : a.type === "expense"
    );
    const centers = centersRes.data || [];

    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accountsList = accounts.map((a: any) => `${a.code} ${a.name} [id:${a.id}]`).join("\n");
    const centersList = centers.map((c: any) => `${c.name} (${c.category}) [id:${c.id}]`).join("\n");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableApiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: `Você é um classificador financeiro. Dado a descrição de um lançamento, sugira a conta contábil e o centro de custo mais adequados.

Contas contábeis disponíveis:
${accountsList}

Centros de custo disponíveis:
${centersList}

Responda APENAS com JSON válido no formato:
{"account_id": "uuid", "cost_center_id": "uuid", "confidence": "high|medium|low"}

Escolha a classificação mais provável. Se não tiver certeza, use confidence "low".`,
          },
          {
            role: "user",
            content: `Tipo: ${type === "revenue" ? "Receita" : "Despesa"}\nDescrição: ${sanitizeForPrompt(description as string)}`,
          },
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI error:", response.status, errText);
      return new Response(JSON.stringify({ error: "AI classification failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || "";

    const jsonMatch = content.match(/\{[^}]+\}/);
    if (!jsonMatch) {
      return new Response(JSON.stringify({ account_id: null, cost_center_id: null, confidence: "low" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const classification = JSON.parse(jsonMatch[0]);
    return new Response(JSON.stringify(classification), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Classify error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
