import { corsPreflightResponse } from "../_shared/cors.ts";
import { authenticate, assertMembership, assertCanWrite, jsonResp } from "../_shared/auth.ts";
import { parseJsonBody, validate, validateRequired, validateString, sanitizeForPrompt } from "../_shared/validate.ts";
import { conhecimentoContabilParaPrompt } from "../_shared/contabil-br.ts";

Deno.serve(async (req) => {
  const preflight = corsPreflightResponse(req);
  if (preflight) return preflight;

  // Auth obrigatório — antes qualquer um chamava e queimava a quota Lovable AI
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const { user, supabase, corsHeaders } = auth;

  try {
    const parsed = await parseJsonBody(req);
    if ("error" in parsed) {
      return jsonResp({ error: parsed.error }, 400, corsHeaders);
    }
    const { image_base64, mimetype, company_id } = parsed.data;

    const validationError = validate(
      validateRequired(parsed.data, ["image_base64", "mimetype", "company_id"]),
      validateString(image_base64, "image_base64"),
      validateString(mimetype, "mimetype"),
    );
    if (validationError) {
      return jsonResp({ error: validationError }, 400, corsHeaders);
    }

    // company_id é OBRIGATÓRIO: sem ele, qualquer JWT válido queimava a quota
    // de IA sem escopo. Exigir membresia e papel de escrita (o scan cria
    // lançamento — viewer/demo não abre esse custo).
    const forbidden = await assertMembership(supabase, user.id, company_id as string, corsHeaders);
    if (forbidden) return forbidden;
    const readonly = await assertCanWrite(supabase, user.id, company_id as string, corsHeaders);
    if (readonly) return readonly;

    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) {
      return jsonResp({ error: "AI not configured" }, 500, corsHeaders);
    }

    // ── Step 1: Extract document data via Gemini Vision ─────────────────────
    const extractionPrompt = `Você é um especialista em análise de documentos financeiros brasileiros.
Analise a imagem e extraia os dados em JSON puro (sem markdown, sem \`\`\`):

{
  "document_type": "boleto|nota_fiscal|nfse|cupom_fiscal|recibo|comprovante_pix|extrato|outro",
  "value": numero_decimal_ou_null,
  "date": "YYYY-MM-DD ou null",
  "issuer": "nome emitente ou null",
  "issuer_document": "CNPJ ou CPF formatado ou null",
  "beneficiary": "nome beneficiário/tomador ou null",
  "beneficiary_document": "CNPJ ou CPF do beneficiário/tomador formatado ou null",
  "description": "descrição resumida do documento",
  "barcode": "linha digitável se boleto ou null",
  "document_number": "número do documento ou null",
  "transaction_type": "revenue ou expense",
  "items": [{"description": "item", "value": 10.00}]
}

Regras para transaction_type:
- Boleto recebido para PAGAR → sempre "expense"
- Cupom fiscal de compra → sempre "expense"
- Comprovante PIX enviado (pagamento) → "expense"
- Comprovante PIX recebido → "revenue"
- Nota Fiscal / NFS-e EMITIDA pela empresa (prestação de serviço) → "revenue"
- Nota Fiscal / NFS-e RECEBIDA de fornecedor (compra/serviço contratado) → "expense"
- Recibo de pagamento feito → "expense"
- Recibo de recebimento → "revenue"
- Se não for possível determinar, use "expense" como padrão

Campos não identificados = null. Responda APENAS com JSON válido.`;

    const dataUrl = `data:${mimetype};base64,${image_base64}`;
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
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        }],
        temperature: 0.1,
      }),
    });

    if (!visionRes.ok) {
      const errText = await visionRes.text();
      console.error("Vision AI error:", visionRes.status, errText);
      const label = mimetype === "application/pdf" ? "PDF" : "imagem";
      return jsonResp({ error: `Falha ao analisar ${label}` }, 500, corsHeaders);
    }

    const visionResult = await visionRes.json();
    const visionContent = visionResult.choices?.[0]?.message?.content || "";

    const jsonMatch = visionContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return jsonResp({ error: "Não foi possível extrair dados da imagem" }, 422, corsHeaders);
    }

    let extracted: any;
    try {
      extracted = JSON.parse(jsonMatch[0]);
    } catch {
      return jsonResp({ error: "Resposta da IA em formato inválido" }, 422, corsHeaders);
    }

    // Apply document-type heuristics as fallback
    if (!extracted.transaction_type || extracted.transaction_type === "null") {
      const docType = extracted.document_type;
      if (docType === "boleto" || docType === "cupom_fiscal") {
        extracted.transaction_type = "expense";
      } else {
        extracted.transaction_type = "expense"; // safe default
      }
    }

    // ── Step 2: Classify using chart of accounts + cost centers + bank accounts + history ──
    let classification: any = { account_id: null, cost_center_id: null, bank_account_id: null, confidence: "low" };

    if (company_id && extracted.description) {
      // supabase já vem do bootstrap auth — não precisa recriar
      const txType = extracted.transaction_type || "expense";
      const [accountsRes, centersRes, banksRes, historyRes] = await Promise.all([
        supabase.from("chart_of_accounts").select("id, name, code, type").eq("company_id", company_id),
        supabase.from("cost_centers").select("id, name, category").eq("company_id", company_id).eq("active", true),
        supabase.from("bank_accounts").select("id, name, bank_name").eq("company_id", company_id),
        supabase.from("transactions")
          .select("description, type, account_id, cost_center_id, bank_account_id")
          .eq("company_id", company_id)
          .not("account_id", "is", null)
          .order("created_at", { ascending: false })
          .limit(50),
      ]);

      const allAccounts = accountsRes.data || [];
      const filteredAccounts = allAccounts.filter((a: any) =>
        txType === "revenue" ? a.type === "revenue" : a.type === "expense"
      );
      const centers = centersRes.data || [];
      const banks = banksRes.data || [];
      const history = historyRes.data || [];

      // Build valid ID sets for validation
      const validAccountIds = new Set(filteredAccounts.map((a: any) => a.id));
      const validCenterIds = new Set(centers.map((c: any) => c.id));
      const validBankIds = new Set(banks.map((b: any) => b.id));

      if (filteredAccounts.length > 0 || centers.length > 0) {
        const accountsList = filteredAccounts.map((a: any) => `- ${a.code || "?"} ${a.name} [id:${a.id}]`).join("\n");
        const centersList = centers.map((c: any) => `- ${c.name} (${c.category}) [id:${c.id}]`).join("\n");
        const banksList = banks.map((b: any) => `- ${b.name}${b.bank_name ? ` (${b.bank_name})` : ""} [id:${b.id}]`).join("\n");

        // Build learning context from recent transactions
        let learningContext = "";
        if (history.length > 0) {
          // Map IDs to names for better context
          const accountMap = Object.fromEntries(allAccounts.map((a: any) => [a.id, `${a.code || ""} ${a.name}`]));
          const centerMap = Object.fromEntries(centers.map((c: any) => [c.id, c.name]));
          const bankMap = Object.fromEntries(banks.map((b: any) => [b.id, b.name]));

          const examples = history.slice(0, 25).map((h: any) =>
            `"${h.description}" (${h.type}) → conta: ${accountMap[h.account_id] || "N/A"}, centro: ${centerMap[h.cost_center_id] || "N/A"}, banco: ${bankMap[h.bank_account_id] || "N/A"}`
          ).join("\n");
          learningContext = `\n\nHistórico de classificações anteriores (aprenda os padrões do usuário):\n${examples}`;
        }

        const classifyPrompt = `Você é um contador brasileiro classificando um documento fiscal no plano de contas da empresa.

${conhecimentoContabilParaPrompt()}


CONTAS CONTÁBEIS (${txType === "revenue" ? "receitas" : "despesas"} disponíveis):
${accountsList}

CENTROS DE CUSTO disponíveis:
${centersList}

CONTAS BANCÁRIAS disponíveis:
${banksList}${learningContext}

REGRAS:
1. Escolha a conta contábil mais específica para o tipo de gasto/receita
2. Escolha o centro de custo pelo departamento responsável
3. Se houver padrão claro no histórico, siga-o
4. confidence = "high" se o match é óbvio, "medium" se razoável, "low" se incerto
5. Use null se nenhuma opção se encaixa bem

Responda APENAS com JSON puro (sem markdown):
{"account_id": "uuid_ou_null", "cost_center_id": "uuid_ou_null", "bank_account_id": "uuid_ou_null", "confidence": "high|medium|low"}`;

        const classifyRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${lovableApiKey}`,
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: classifyPrompt },
              {
                role: "user",
                content: `Tipo: ${txType === "revenue" ? "Receita" : "Despesa"}
Documento: ${extracted.document_type || "desconhecido"}
Descrição: ${sanitizeForPrompt(extracted.description)}
Emitente: ${sanitizeForPrompt(extracted.issuer || "Não identificado")}
CNPJ/CPF: ${extracted.issuer_document || "N/A"}
Valor: R$ ${extracted.value != null ? extracted.value.toFixed(2) : "N/A"}
Itens: ${extracted.items?.map((i: any) => i.description).join(", ") || "N/A"}`,
              },
            ],
            temperature: 0.1,
          }),
        });

        if (classifyRes.ok) {
          const classifyResult = await classifyRes.json();
          const classContent = classifyResult.choices?.[0]?.message?.content || "";
          // Use greedy regex to capture full JSON object including newlines
          const classJson = classContent.match(/\{[\s\S]*\}/);
          if (classJson) {
            try {
              const parsed = JSON.parse(classJson[0]);
              // Validate that returned IDs actually exist
              classification = {
                account_id: parsed.account_id && validAccountIds.has(parsed.account_id) ? parsed.account_id : null,
                cost_center_id: parsed.cost_center_id && validCenterIds.has(parsed.cost_center_id) ? parsed.cost_center_id : null,
                bank_account_id: parsed.bank_account_id && validBankIds.has(parsed.bank_account_id) ? parsed.bank_account_id : null,
                confidence: ["high", "medium", "low"].includes(parsed.confidence) ? parsed.confidence : "low",
              };
            } catch { /* keep defaults */ }
          }
        }
      }
    }

    return jsonResp({
      ...extracted,
      suggested_account_id: classification.account_id,
      suggested_cost_center_id: classification.cost_center_id,
      suggested_bank_account_id: classification.bank_account_id,
      classification_confidence: classification.confidence,
    }, 200, corsHeaders);
  } catch (error) {
    console.error("OCR error:", error);
    return jsonResp({ error: "Internal server error" }, 500, corsHeaders);
  }
});
