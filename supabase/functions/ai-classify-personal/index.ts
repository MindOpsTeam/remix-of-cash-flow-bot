import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";
import { parseJsonBody, validate, validateRequired, validateString, validateEnum, sanitizeForPrompt } from "../_shared/validate.ts";

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const preflight = corsPreflightResponse(req);
  if (preflight) return preflight;

  try {
    const parsed = await parseJsonBody(req);
    if ("error" in parsed) {
      return new Response(JSON.stringify({ error: parsed.error }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { description, type, user_id } = parsed.data;

    const validationError = validate(
      validateRequired(parsed.data, ["description", "user_id"]),
      validateString(description, "description", 2000),
      type != null ? validateEnum(type, "type", ["receita", "despesa"]) : null,
    );
    if (validationError) {
      return new Response(JSON.stringify({ error: validationError }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Fetch user's personal categories and rules
    const [categoriesRes, rulesRes] = await Promise.all([
      supabase.from("personal_categories")
        .select("id, name, type, icon, default_kakeibo_group")
        .or(`user_id.eq.${user_id},user_id.is.null`),
      supabase.from("personal_category_rules")
        .select("keyword, category_id, kakeibo_group")
        .or(`user_id.eq.${user_id},is_system.eq.true`),
    ]);

    const categories = (categoriesRes.data || []).filter((c: any) => {
      if (!type) return true;
      if (type === "receita") return c.type === "income" || c.type === "receita";
      return c.type === "expense" || c.type === "despesa";
    });
    const rules = rulesRes.data || [];

    // Quick keyword match first
    const desc = (description as string).toLowerCase();
    for (const rule of rules) {
      if (desc.includes((rule as any).keyword.toLowerCase())) {
        return new Response(JSON.stringify({
          category_id: (rule as any).category_id,
          kakeibo_group: (rule as any).kakeibo_group || null,
          confidence: "high",
          source: "rule",
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // AI classification via Gemini
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const categoriesList = categories
      .map((c: any) => `${c.icon || "•"} ${c.name} [id:${c.id}]${c.default_kakeibo_group ? ` (kakeibo: ${c.default_kakeibo_group})` : ""}`)
      .join("\n");

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
            content: `Você é um classificador de finanças pessoais. Dado a descrição de uma transação, sugira a categoria mais adequada e o grupo Kakeibo.

Categorias disponíveis:
${categoriesList}

Grupos Kakeibo válidos: necessidade, desejo, cultura, extra, investimento

Responda APENAS com JSON válido no formato:
{"category_id": "uuid", "kakeibo_group": "necessidade|desejo|cultura|extra|investimento|null", "confidence": "high|medium|low"}

Escolha a classificação mais provável. Se não tiver certeza, use confidence "low".`,
          },
          {
            role: "user",
            content: `Tipo: ${type === "receita" ? "Receita" : "Despesa"}\nDescrição: ${sanitizeForPrompt(description as string)}`,
          },
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      console.error("AI error:", response.status, await response.text());
      return new Response(JSON.stringify({ error: "AI classification failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || "";

    const jsonMatch = content.match(/\{[^}]+\}/);
    if (!jsonMatch) {
      return new Response(JSON.stringify({ category_id: null, kakeibo_group: null, confidence: "low" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const classification = JSON.parse(jsonMatch[0]);
    classification.source = "ai";
    return new Response(JSON.stringify(classification), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Personal classify error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
