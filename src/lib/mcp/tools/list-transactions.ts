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
  name: "list_transactions",
  title: "List company transactions",
  description:
    "List PJ (empresa) financial transactions for a given company_id. Optional date range (ISO YYYY-MM-DD) and limit (max 200). Requires the caller to be a member of the company.",
  inputSchema: {
    company_id: z.string().uuid().describe("Company UUID (see list_companies)."),
    from: z.string().optional().describe("Start date, inclusive, ISO YYYY-MM-DD."),
    to: z.string().optional().describe("End date, inclusive, ISO YYYY-MM-DD."),
    limit: z.number().int().positive().optional().describe("Max rows to return (default 50, cap 200)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ company_id, from, to, limit }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Não autenticado" }], isError: true };

    const capped = Math.min(Math.max(limit ?? 50, 1), 200);
    let q = db(ctx)
      .from("transactions")
      .select(
        "id, date, type, description, amount, status, source, account_id, cost_center_id, is_intercompany",
      )
      .eq("company_id", company_id)
      .order("date", { ascending: false })
      .limit(capped);
    if (from) q = q.gte("date", from);
    if (to) q = q.lte("date", to);

    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { transactions: data ?? [] },
    };
  },
});
