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
  name: "list_receivables",
  title: "List accounts receivable",
  description:
    "List receivables (contas a receber) for a company. Optional status filter and limit (max 200).",
  inputSchema: {
    company_id: z.string().uuid().describe("Company UUID."),
    status: z.string().optional().describe("Optional status filter (e.g. 'pending', 'received')."),
    limit: z.number().int().positive().optional().describe("Max rows (default 50, cap 200)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ company_id, status, limit }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Não autenticado" }], isError: true };

    const capped = Math.min(Math.max(limit ?? 50, 1), 200);
    let q = db(ctx)
      .from("receivables")
      .select("*")
      .eq("company_id", company_id)
      .order("due_date", { ascending: true })
      .limit(capped);
    if (status) q = q.eq("status", status);

    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { receivables: data ?? [] },
    };
  },
});
