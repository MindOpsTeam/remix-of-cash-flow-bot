import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";
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
  const corsHeaders = getCorsHeaders(req);
  const preflight = corsPreflightResponse(req);
  if (preflight) return preflight;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    if (req.method === "GET") {
      // List owner transactions for a user
      const url = new URL(req.url);
      const userId = url.searchParams.get("user_id");
      const companyId = url.searchParams.get("company_id");

      if (!userId) {
        return new Response(JSON.stringify({ error: "user_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let query = supabase
        .from("owner_transactions")
        .select("*")
        .eq("user_id", userId)
        .order("date", { ascending: false });

      if (companyId) {
        query = query.eq("company_id", companyId);
      }

      const { data, error } = await query;
      if (error) throw error;

      return new Response(JSON.stringify({ data }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST: Create owner transaction with dual-side entries
    const parsed = await parseJsonBody(req);
    if ("error" in parsed) {
      return new Response(JSON.stringify({ error: parsed.error }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = parsed.data;
    const validationError = validate(
      validateRequired(body, ["transaction_type", "amount", "date", "company_id", "user_id"]),
      validateEnum(body.transaction_type, "transaction_type", TRANSACTION_TYPES),
      validateUUID(body.company_id as string, "company_id"),
      validateUUID(body.user_id as string, "user_id"),
    );

    if (validationError) {
      return new Response(JSON.stringify({ error: validationError }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const transactionType = body.transaction_type as string;
    const amount = Number(body.amount);
    const date = body.date as string;
    const description = (body.description as string) || TYPE_LABELS[transactionType] || transactionType;
    const companyId = body.company_id as string;
    const userId = body.user_id as string;
    const pfAccountId = (body.pf_account_id as string) || null;
    const pjBankAccountId = (body.pj_bank_account_id as string) || null;

    if (amount <= 0) {
      return new Response(JSON.stringify({ error: "amount must be greater than zero" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user is a member of the company
    const { data: membership, error: memError } = await supabase
      .from("company_members")
      .select("role")
      .eq("company_id", companyId)
      .eq("user_id", userId)
      .single();

    if (memError || !membership) {
      return new Response(JSON.stringify({ error: "User is not a member of this company" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { pjType, pfType } = getDirection(transactionType);
    const label = TYPE_LABELS[transactionType] || transactionType;
    const pjDescription = `${label}${description !== label ? ` - ${description}` : ""}`;
    const pfTitle = pjDescription;

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
        pf_account_id: pfAccountId,
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

    // 3. Insert PF transaction
    const { data: pfTx, error: pfError } = await supabase
      .from("personal_transactions")
      .insert({
        user_id: userId,
        date,
        title: pfTitle,
        amount,
        type: pfType === "revenue" ? "receita" : "despesa",
        status: "confirmed",
        source: "owner_transfer",
        account_id: pfAccountId,
      })
      .select("id")
      .single();

    if (pfError) {
      // Rollback both
      await supabase.from("transactions").delete().eq("id", pjTx.id);
      await supabase.from("owner_transactions").delete().eq("id", ownerTx.id);
      throw pfError;
    }

    // 4. Update owner_transaction with references
    await supabase
      .from("owner_transactions")
      .update({
        pj_transaction_id: pjTx.id,
        pf_transaction_id: pfTx.id,
      })
      .eq("id", ownerTx.id);

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          id: ownerTx.id,
          pj_transaction_id: pjTx.id,
          pf_transaction_id: pfTx.id,
        },
      }),
      {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Owner transaction error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
