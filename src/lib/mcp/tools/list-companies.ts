import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";

function db(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "list_companies",
  title: "List companies (CNPJs)",
  description:
    "List all companies (CNPJs) the signed-in user belongs to, with id, org_id, name and CNPJ.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Não autenticado" }], isError: true };

    const supabase = db(ctx);
    const { data: members, error: mErr } = await supabase
      .from("company_members")
      .select("company_id, role")
      .eq("user_id", ctx.getUserId());
    if (mErr) return { content: [{ type: "text", text: mErr.message }], isError: true };

    const ids = (members ?? []).map((m: { company_id: string }) => m.company_id);
    if (ids.length === 0)
      return {
        content: [{ type: "text", text: "Nenhuma empresa vinculada a este usuário." }],
        structuredContent: { companies: [] },
      };

    const { data: companies, error: cErr } = await supabase
      .from("companies")
      .select("id, org_id, name, cnpj")
      .in("id", ids);
    if (cErr) return { content: [{ type: "text", text: cErr.message }], isError: true };

    return {
      content: [{ type: "text", text: JSON.stringify(companies, null, 2) }],
      structuredContent: { companies: companies ?? [] },
    };
  },
});
