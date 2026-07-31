import { corsPreflightResponse } from "../_shared/cors.ts";
import { authenticate, assertMembership, assertCanWrite, jsonResp } from "../_shared/auth.ts";
import { parseJsonBody, validate, validateRequired, validateEnum, validateUUID } from "../_shared/validate.ts";

const TRANSACTION_TYPES = [
  "retirada",       // PJ → PF (owner draw)
  "aporte",         // PF → PJ (owner investment)
  "pro_labore",     // PJ → PF (salary)
  "dividendo",      // PJ → PF (dividend)
  "emprestimo_pf_pj", // PF → PJ (loan from owner)
  "emprestimo_pj_pf", // PJ → PF (loan to owner)
];

// Direction: which side is the source (expense) and which is the destination (revenue)
function getDirection(type: string): { pjType: "expense" | "revenue"; pfType: "expense" | "revenue" } {
  switch (type) {
    case "retirada":
    case "pro_labore":
    case "dividendo":
    case "emprestimo_pj_pf":
      return { pjType: "expense", pfType: "revenue" };
    case "aporte":
    case "emprestimo_pf_pj":
      return { pjType: "revenue", pfType: "expense" };
    default:
      return { pjType: "expense", pfType: "revenue" };
  }
}

const TYPE_LABELS: Record<string, string> = {
  retirada: "Retirada de sócio",
  aporte: "Aporte de sócio",
  pro_labore: "Pró-labore",
  dividendo: "Distribuição de dividendos",
  emprestimo_pf_pj: "Empréstimo do sócio para empresa",
  emprestimo_pj_pf: "Empréstimo da empresa para sócio",
};

Deno.serve(async (req) => {
  const preflight = corsPreflightResponse(req);
  if (preflight) return preflight;

  // Auth obrigatório: o user_id de query string vinha sendo aceito sem validação.
  // Agora forçamos o user a vir do JWT — query param é ignorado.
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const { user, supabase, corsHeaders } = auth;

  try {
    if (req.method === "GET") {
      // Lista owner_transactions do user autenticado.
      // company_id, se passado, restringe — mas sempre exige membership.
      const url = new URL(req.url);
      const companyId = url.searchParams.get("company_id");

      let query = supabase
        .from("owner_transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("date", { ascending: false });

      if (companyId) {
        const forbidden = await assertMembership(supabase, user.id, companyId, corsHeaders);
        if (forbidden) return forbidden;
        query = query.eq("company_id", companyId);
      }

      const { data, error } = await query;
      if (error) throw error;

      return jsonResp({ data }, 200, corsHeaders);
    }

    if (req.method !== "POST") {
      return jsonResp({ error: "Method not allowed" }, 405, corsHeaders);
    }

    // POST: Create owner transaction with dual-side entries
    const parsed = await parseJsonBody(req);
    if ("error" in parsed) {
      return jsonResp({ error: parsed.error }, 400, corsHeaders);
    }

    const body = parsed.data;
    // user_id NÃO vem do body — vem do JWT autenticado
    const validationError = validate(
      validateRequired(body, ["transaction_type", "amount", "date", "company_id"]),
      validateEnum(body.transaction_type, "transaction_type", TRANSACTION_TYPES),
      validateUUID(body.company_id as string, "company_id"),
    );

    if (validationError) {
      return jsonResp({ error: validationError }, 400, corsHeaders);
    }

    const transactionType = body.transaction_type as string;
    const amount = Number(body.amount);
    const date = body.date as string;
    const description = (body.description as string) || TYPE_LABELS[transactionType] || transactionType;
    const companyId = body.company_id as string;
    const userId = user.id; // do JWT — nunca do body
    const pjBankAccountId = (body.pj_bank_account_id as string) || null;

    if (amount <= 0) {
      return jsonResp({ error: "amount must be greater than zero" }, 400, corsHeaders);
    }

    // Confirma que o user autenticado é membro da empresa e pode escrever
    const forbidden = await assertMembership(supabase, userId, companyId, corsHeaders);
    if (forbidden) return forbidden;
    const readonly = await assertCanWrite(supabase, userId, companyId, corsHeaders);
    if (readonly) return readonly;

    const { pjType } = getDirection(transactionType);
    const label = TYPE_LABELS[transactionType] || transactionType;
    const pjDescription = `${label}${description !== label ? ` - ${description}` : ""}`;

    // 0. Idempotency: check for duplicate within 5 minutes
    const { data: existingTx } = await supabase
      .from("owner_transactions")
      .select("id, pj_transaction_id")
      .eq("user_id", userId)
      .eq("company_id", companyId)
      .eq("transaction_type", transactionType)
      .eq("amount", amount)
      .eq("date", date)
      .gte("created_at", new Date(Date.now() - 5 * 60 * 1000).toISOString())
      .limit(1)
      .maybeSingle();

    if (existingTx) {
      return jsonResp({
        success: true,
        data: {
          id: existingTx.id,
          pj_transaction_id: existingTx.pj_transaction_id,
        },
        deduplicated: true,
      }, 200, corsHeaders);
    }

    // 1. Insert owner_transaction record
    const { data: ownerTx, error: ownerError } = await supabase
      .from("owner_transactions")
      .insert({
        transaction_type: transactionType,
        amount,
        date,
        description,
        company_id: companyId,
        user_id: userId,
        pj_bank_account_id: pjBankAccountId,
        status: "confirmed",
      })
      .select("id")
      .single();

    if (ownerError) throw ownerError;

    // 2. Insert PJ transaction
    const { data: pjTx, error: pjError } = await supabase
      .from("transactions")
      .insert({
        company_id: companyId,
        user_id: userId,
        date,
        description: pjDescription,
        amount,
        type: pjType,
        status: "confirmed",
        source: "owner_transfer",
        bank_account_id: pjBankAccountId,
      })
      .select("id")
      .single();

    if (pjError) {
      // Rollback owner_transaction
      await supabase.from("owner_transactions").delete().eq("id", ownerTx.id);
      throw pjError;
    }

    // 3. Update owner_transaction with PJ reference
    const { error: updateError } = await supabase
      .from("owner_transactions")
      .update({
        pj_transaction_id: pjTx.id,
      })
      .eq("id", ownerTx.id);

    if (updateError) {
      await supabase.from("transactions").delete().eq("id", pjTx.id);
      await supabase.from("owner_transactions").delete().eq("id", ownerTx.id);
      throw updateError;
    }

    return jsonResp({
      success: true,
      data: {
        id: ownerTx.id,
        pj_transaction_id: pjTx.id,
      },
    }, 201, corsHeaders);
  } catch (error) {
    console.error("Owner transaction error:", error);
    return jsonResp(
      { error: error instanceof Error ? error.message : "Internal server error" },
      500,
      corsHeaders,
    );
  }
});
