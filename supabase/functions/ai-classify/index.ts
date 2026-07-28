import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";
import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";
import { parseJsonBody, validate, validateRequired, validateString, validateEnum, validateUUID, sanitizeForPrompt } from "../_shared/validate.ts";
import { chamarModelo, registrarUso, normalizarDescricao } from "../_shared/ia.ts";

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

    const idsContas = new Set(accounts.map((a: { id: string }) => a.id));
    const idsCentros = new Set(centers.map((c: { id: string }) => c.id));
    const descricaoNormalizada = normalizarDescricao(description as string);

    // ── CAMINHO 1: REGRA APRENDIDA. Zero token, resposta estável.
    // O boleto de energia chega igual todo mês. Depois que um humano classificou
    // uma vez, o modelo não precisa ser chamado nunca mais para aquele padrão.
    if (descricaoNormalizada) {
      const { data: regra } = await adminClient
        .from("classification_rules")
        .select("id, account_id, cost_center_id, acertos")
        .eq("company_id", company_id)
        .eq("padrao", descricaoNormalizada)
        .maybeSingle();

      if (regra?.account_id && idsContas.has(regra.account_id)) {
        await adminClient
          .from("classification_rules")
          .update({ acertos: (regra.acertos ?? 0) + 1 })
          .eq("id", regra.id);
        return new Response(
          JSON.stringify({
            account_id: regra.account_id,
            cost_center_id: idsCentros.has(regra.cost_center_id) ? regra.cost_center_id : null,
            confidence: "high",
            origem: "regra",
            explicacao: "Você já classificou um lançamento parecido antes.",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accountsList = accounts.map((a: { code: string; name: string; id: string }) => `${a.code} ${a.name} [id:${a.id}]`).join("\n");
    const centersList = centers.map((c: { name: string; category: string; id: string }) => `${c.name} (${c.category}) [id:${c.id}]`).join("\n");

    // ── CAMINHO 2: MODELO, mas ensinado com o histórico DA PRÓPRIA EMPRESA.
    // Mandar só o plano de contas é pedir chute. Mandar como esta empresa já
    // classificou lançamentos parecidos é pedir consistência.
    const { data: exemplos } = await adminClient
      .from("transactions")
      .select("description, account_id")
      .eq("company_id", company_id)
      .not("account_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(40);

    const historico = (exemplos ?? [])
      .filter((e: { account_id: string }) => idsContas.has(e.account_id))
      .slice(0, 20)
      .map((e: { description: string; account_id: string }) => `"${e.description}" -> ${e.account_id}`)
      .join("\n");

    const resposta = await chamarModelo<{
      account_id: string | null;
      cost_center_id: string | null;
      confidence: "high" | "medium" | "low";
      explicacao: string;
    }>(
      lovableApiKey,
      [
        {
          role: "system",
          content: `Você classifica lançamentos financeiros de uma empresa brasileira.

Contas contábeis desta empresa:
${accountsList}

Centros de custo:
${centersList}
${historico ? `\nComo ESTA empresa já classificou antes (siga o padrão dela):\n${historico}` : ""}

Devolva o id EXATO de uma das contas listadas. Se nenhuma servir, devolva account_id nulo com confidence "low". Nunca invente id. A explicação tem no máximo uma frase curta, em português, dizendo por que escolheu.`,
        },
        {
          role: "user",
          content: `Tipo: ${type === "revenue" ? "Receita" : "Despesa"}\nDescrição: ${sanitizeForPrompt(description as string)}`,
        },
      ],
      {
        modelo: "google/gemini-2.5-flash-lite",
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["account_id", "cost_center_id", "confidence", "explicacao"],
          properties: {
            account_id: { type: ["string", "null"] },
            cost_center_id: { type: ["string", "null"] },
            confidence: { type: "string", enum: ["high", "medium", "low"] },
            explicacao: { type: "string" },
          },
        },
      },
    );

    await registrarUso(adminClient, company_id as string, "ai-classify", resposta);

    if (!resposta.dados) {
      // Falha de IA não pode virar "não sei" silencioso: quem chamou precisa
      // saber que foi erro, para oferecer classificação manual.
      return new Response(
        JSON.stringify({ account_id: null, cost_center_id: null, confidence: "low", erro: resposta.erro }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // O modelo devolve id. Antes isso ia direto para o insert: um UUID
    // alucinado virava lançamento numa conta que não existe na empresa.
    const c = resposta.dados;
    if (c.account_id && !idsContas.has(c.account_id)) {
      c.account_id = null;
      c.confidence = "low";
    }
    if (c.cost_center_id && !idsCentros.has(c.cost_center_id)) {
      c.cost_center_id = null;
    }

    return new Response(JSON.stringify({ ...c, origem: "ia" }), {
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
