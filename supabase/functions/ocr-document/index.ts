import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";
import { parseJsonBody, validate, validateRequired, validateString, sanitizeForPrompt } from "../_shared/validate.ts";

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
    const { image_base64, mimetype, company_id, mode } = parsed.data;

    const validationError = validate(
      validateRequired(parsed.data, ["image_base64", "mimetype"]),
      validateString(image_base64, "image_base64"),
      validateString(mimetype, "mimetype"),
    );
    if (validationError) {
      return new Response(JSON.stringify({ error: validationError }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Step 1: Extract document data via Gemini Vision ─────────────────────
    const extractionPrompt = `Você é um especialista em análise de documentos financeiros brasileiros.
Analise a imagem e extraia os dados em JSON:
{
  "document_type": "boleto|nota_fiscal|nfse|cupom_fiscal|recibo|comprovante_pix|extrato|outro",
  "value": numero_decimal_ou_null,
  "date": "YYYY-MM-DD ou null",
  "issuer": "nome emitente ou null",
  "issuer_document": "CNPJ ou CPF ou null",
  "beneficiary": "nome beneficiário ou null",
  "description": "descrição resumida do documento",
  "barcode": "linha digitável se boleto ou null",
  "document_number": "número do documento ou null",
  "transaction_type": "revenue ou expense",
  "items": [{"description": "item", "value": 10.00}]
}
Campos não identificados = null. Responda APENAS com JSON válido, sem markdown.`;

    const isPdf = mimetype === "application/pdf";
    let visionContent: string;

    if (isPdf) {
      // For PDFs: use Gemini with inline_data for PDF
      const visionRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${lovableApiKey}`,
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [{
            role: "user",
            content: [
              { type: "text", text: extractionPrompt },
              { type: "image_url", image_url: { url: `data:application/pdf;base64,${image_base64}` } },
            ],
          }],
          temperature: 0.1,
        }),
      });

      if (!visionRes.ok) {
        const errText = await visionRes.text();
        console.error("Vision AI error (PDF):", visionRes.status, errText);
        return new Response(JSON.stringify({ error: "Falha ao analisar PDF" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const visionResult = await visionRes.json();
      visionContent = visionResult.choices?.[0]?.message?.content || "";
    } else {
      // For images: standard vision
      const imageUrl = `data:${mimetype};base64,${image_base64}`;
      const visionRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${lovableApiKey}`,
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [{
            role: "user",
            content: [
              { type: "text", text: extractionPrompt },
              { type: "image_url", image_url: { url: imageUrl } },
            ],
          }],
          temperature: 0.1,
        }),
      });

      if (!visionRes.ok) {
        const errText = await visionRes.text();
        console.error("Vision AI error:", visionRes.status, errText);
        return new Response(JSON.stringify({ error: "Falha ao analisar imagem" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const visionResult = await visionRes.json();
      visionContent = visionResult.choices?.[0]?.message?.content || "";
    }

    const jsonMatch = visionContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return new Response(JSON.stringify({ error: "Não foi possível extrair dados da imagem" }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let extracted: any;
    try {
      extracted = JSON.parse(jsonMatch[0]);
    } catch {
      return new Response(JSON.stringify({ error: "Resposta da IA em formato inválido" }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Step 2: Classify using chart of accounts + cost centers + bank accounts + history ──
    let classification = { account_id: null, cost_center_id: null, bank_account_id: null, confidence: "low" };

    if (company_id && extracted.description) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, serviceKey);

      const txType = extracted.transaction_type || "expense";
      const [accountsRes, centersRes, banksRes, historyRes] = await Promise.all([
        supabase.from("chart_of_accounts").select("id, name, code, type").eq("company_id", company_id),
        supabase.from("cost_centers").select("id, name, category").eq("company_id", company_id).eq("active", true),
        supabase.from("bank_accounts").select("id, name, bank_name").eq("company_id", company_id),
        // Fetch recent similar transactions for learning context
        supabase.from("transactions")
          .select("description, type, account_id, cost_center_id, bank_account_id")
          .eq("company_id", company_id)
          .not("account_id", "is", null)
          .order("created_at", { ascending: false })
          .limit(50),
      ]);

      const accounts = (accountsRes.data || []).filter((a: any) =>
        txType === "revenue" ? a.type === "revenue" : a.type === "expense"
      );
      const centers = centersRes.data || [];
      const banks = banksRes.data || [];
      const history = historyRes.data || [];

      if (accounts.length > 0 || centers.length > 0) {
        const accountsList = accounts.map((a: any) => `${a.code} ${a.name} [id:${a.id}]`).join("\n");
        const centersList = centers.map((c: any) => `${c.name} (${c.category}) [id:${c.id}]`).join("\n");
        const banksList = banks.map((b: any) => `${b.name}${b.bank_name ? ` (${b.bank_name})` : ""} [id:${b.id}]`).join("\n");

        // Build learning context from recent transactions
        let learningContext = "";
        if (history.length > 0) {
          const examples = history.slice(0, 20).map((h: any) =>
            `"${h.description}" → account:${h.account_id || "null"}, center:${h.cost_center_id || "null"}, bank:${h.bank_account_id || "null"}`
          ).join("\n");
          learningContext = `\n\nExemplos de classificações anteriores do usuário (use como referência para padrões):\n${examples}`;
        }

        const classifyRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
                content: `Você é um classificador financeiro. Dado a descrição de um documento, sugira a conta contábil, centro de custo e conta bancária mais adequados.\n\nContas contábeis:\n${accountsList}\n\nCentros de custo:\n${centersList}\n\nContas bancárias:\n${banksList}${learningContext}\n\nResponda APENAS com JSON: {"account_id": "uuid ou null", "cost_center_id": "uuid ou null", "bank_account_id": "uuid ou null", "confidence": "high|medium|low"}`,
              },
              {
                role: "user",
                content: `Tipo: ${txType === "revenue" ? "Receita" : "Despesa"}\nDocumento: ${extracted.document_type}\nDescrição: ${sanitizeForPrompt(extracted.description)}\nEmitente: ${extracted.issuer || "Não identificado"}\nValor: ${extracted.value || "Não identificado"}`,
              },
            ],
            temperature: 0.1,
          }),
        });

        if (classifyRes.ok) {
          const classifyResult = await classifyRes.json();
          const classContent = classifyResult.choices?.[0]?.message?.content || "";
          const classJson = classContent.match(/\{[^}]+\}/);
          if (classJson) {
            try { classification = JSON.parse(classJson[0]); } catch { /* keep defaults */ }
          }
        }
      }
    }

    return new Response(JSON.stringify({
      ...extracted,
      suggested_account_id: classification.account_id,
      suggested_cost_center_id: classification.cost_center_id,
      suggested_bank_account_id: classification.bank_account_id,
      classification_confidence: classification.confidence,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("OCR error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
