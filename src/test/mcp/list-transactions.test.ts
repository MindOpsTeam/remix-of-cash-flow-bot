/**
 * MCP tool: list_transactions
 *
 * Cobre:
 *  - Guard de autenticação (sem token → erro amigável, nenhum acesso ao DB).
 *  - Query montada corretamente: escopo por company_id, ordem por data desc,
 *    limite default e cap em 200, filtros opcionais from/to.
 *  - RLS: quando o usuário não é membro, PostgREST devolve `[]` — o handler
 *    passa isso pra frente sem quebrar (não vaza dados de outra empresa).
 *  - Erro de DB propagado como `isError: true`.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { installSupabaseMock, makeCtx } from "./helpers";

const COMPANY = "22222222-2222-2222-2222-222222222222";

// Instala o mock antes de qualquer import da ferramenta.
const { setNextFixtures, getLastCalls } = installSupabaseMock();

async function loadTool() {
  vi.resetModules();
  return (await import("@/lib/mcp/tools/list-transactions")).default;
}

beforeEach(() => {
  process.env.SUPABASE_URL = "https://fake.supabase.co";
  process.env.SUPABASE_PUBLISHABLE_KEY = "fake-anon-key";
});

describe("mcp/list_transactions", () => {
  it("bloqueia chamada não autenticada e não toca no DB", async () => {
    setNextFixtures({});
    const tool = await loadTool();
    const res: any = await tool.handler({ company_id: COMPANY } as any, makeCtx({ authenticated: false }));

    expect(res.isError).toBe(true);
    expect(res.content[0].text).toMatch(/autenticado/i);
    // Nenhuma query deve ter sido montada.
    expect(getLastCalls()).toEqual([]);
  });

  it("monta a query com limite default 50, filtro por company_id e ordem por data desc", async () => {
    setNextFixtures({
      transactions: {
        select: {
          data: [{ id: "t1", type: "revenue", amount: 100, date: "2026-07-01" }],
          error: null,
        },
      },
    });
    const tool = await loadTool();
    const res: any = await tool.handler({ company_id: COMPANY } as any, makeCtx());

    expect(res.isError).toBeUndefined();
    expect(res.structuredContent.transactions).toHaveLength(1);

    const call = getLastCalls().find((c) => c.table === "transactions" && c.op === "select")!;
    expect(call).toBeDefined();
    expect(call.args.filters).toEqual([{ op: "eq", column: "company_id", value: COMPANY }]);
    expect(call.args.order).toEqual({ column: "date", ascending: false });
    expect(call.args.limit).toBe(50);
  });

  it("aplica filtros from/to e faz cap do limite em 200", async () => {
    setNextFixtures({ transactions: { select: { data: [], error: null } } });
    const tool = await loadTool();
    await tool.handler(
      { company_id: COMPANY, from: "2026-01-01", to: "2026-01-31", limit: 9999 } as any,
      makeCtx(),
    );

    const call = getLastCalls().find((c) => c.table === "transactions")!;
    expect(call.args.limit).toBe(200);
    expect(call.args.filters).toEqual(
      expect.arrayContaining([
        { op: "eq", column: "company_id", value: COMPANY },
        { op: "gte", column: "date", value: "2026-01-01" },
        { op: "lte", column: "date", value: "2026-01-31" },
      ]),
    );
  });

  it("com RLS negando (não-membro), devolve lista vazia sem erro", async () => {
    // Simula a resposta que RLS produz: array vazio, sem `error`.
    setNextFixtures({ transactions: { select: { data: [], error: null } } });
    const tool = await loadTool();
    const res: any = await tool.handler({ company_id: COMPANY } as any, makeCtx());

    expect(res.isError).toBeUndefined();
    expect(res.structuredContent.transactions).toEqual([]);
  });

  it("propaga erro do DB como isError", async () => {
    setNextFixtures({
      transactions: { select: { data: null, error: { message: "boom", code: "42501" } } },
    });
    const tool = await loadTool();
    const res: any = await tool.handler({ company_id: COMPANY } as any, makeCtx());

    expect(res.isError).toBe(true);
    expect(res.content[0].text).toBe("boom");
  });
});
