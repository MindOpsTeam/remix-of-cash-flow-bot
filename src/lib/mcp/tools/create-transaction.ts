import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function db(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "create_transaction",
  title: "Create company transaction",
  description:
    "Register a new manual PJ (empresa) transaction. Type must be 'revenue' or 'expense'. Amount is BRL, always positive. Date is ISO YYYY-MM-DD. The entry is created as status='confirmed' and source='mcp', so it counts in the DRE exactly like a manual entry typed in the app.",
  inputSchema: {
    company_id: z.string().uuid().describe("Company UUID (see list_companies)."),
    type: z.enum(["revenue", "expense"]).describe("revenue = receita, expense = despesa."),
    amount: z.number().positive().describe("Amount in BRL, positive."),
    date: z.string().describe("Transaction date, ISO YYYY-MM-DD."),
    description: z.string().min(1).describe("Human-readable description."),
    account_id: z.string().uuid().optional().describe("Chart-of-accounts UUID (optional)."),
    bank_account_id: z.string().uuid().optional().describe("Bank account UUID (optional)."),
    cost_center_id: z.string().uuid().optional().describe("Cost center UUID (optional)."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Não autenticado" }], isError: true };

    const { data, error } = await db(ctx)
      .from("transactions")
      .insert({
        company_id: input.company_id,
        // NOT NULL na tabela e exigido pela policy de INSERT (user_id = auth.uid()).
        user_id: ctx.getUserId(),
        type: input.type,
        amount: input.amount,
        date: input.date,
        description: input.description,
        account_id: input.account_id ?? null,
        bank_account_id: input.bank_account_id ?? null,
        cost_center_id: input.cost_center_id ?? null,
        // Mesma régua do lançamento manual da UI: só status='confirmed' entra no DRE.
        status: "confirmed",
        source: "mcp",
      })
      .select()
      .single();

    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Transação criada (id: ${data.id})` }],
      structuredContent: { transaction: data },
    };
  },
});
