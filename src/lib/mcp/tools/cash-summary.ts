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
  name: "cash_summary",
  title: "Cash summary (revenue vs expense)",
  description:
    "Summary of a company's revenue, expenses and net result in a date range. Dates ISO YYYY-MM-DD. Uses the same rule as the app's DRE: only confirmed entries, intercompany transfers excluded — so the numbers match what the user sees on screen.",
  inputSchema: {
    company_id: z.string().uuid().describe("Company UUID."),
    from: z.string().describe("Start date, inclusive."),
    to: z.string().describe("End date, inclusive."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ company_id, from, to }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Não autenticado" }], isError: true };

    const { data, error } = await db(ctx)
      .from("transactions")
      .select("type, amount")
      .eq("company_id", company_id)
      // Régua do DRE: só lançamento confirmado conta, e transferência entre
      // empresas do grupo não é receita/despesa (igual à v_company_margin).
      .eq("status", "confirmed")
      .eq("is_intercompany", false)
      .gte("date", from)
      .lte("date", to);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const rows = (data ?? []) as { type: string; amount: number }[];
    let revenue = 0;
    let expense = 0;
    for (const r of rows) {
      const v = Number(r.amount) || 0;
      if (r.type === "revenue") revenue += v;
      else if (r.type === "expense") expense += v;
    }
    const net = revenue - expense;
    const fmt = (n: number) =>
      n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

    return {
      content: [
        {
          type: "text",
          text: `Período ${from} → ${to}\nReceitas: ${fmt(revenue)}\nDespesas: ${fmt(expense)}\nResultado líquido: ${fmt(net)}\n(${rows.length} lançamentos)`,
        },
      ],
      structuredContent: { revenue, expense, net, count: rows.length, from, to },
    };
  },
});
