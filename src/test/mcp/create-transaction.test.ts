/**
 * MCP tool: create_transaction
 *
 * Cobre:
 *  - Guard de autenticação.
 *  - Payload obrigatório: user_id vem do token (nunca do input), status
 *    'confirmed' e source 'mcp' (para casar com a régua da UI que alimenta o DRE).
 *  - RLS de INSERT: quando a policy nega (usuário não-membro), o Postgres
 *    devolve erro 42501 e o handler propaga como isError — sem inventar
 *    escalonamento (nada de service_role, nada de bypass).
 *  - Sucesso retorna id na mensagem e o registro em structuredContent.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { installSupabaseMock, makeCtx } from "./helpers";

const COMPANY = "22222222-2222-2222-2222-222222222222";
const USER = "11111111-1111-1111-1111-111111111111";

const { setNextFixtures, getLastCalls } = installSupabaseMock();

async function loadTool() {
  vi.resetModules();
  return (await import("@/lib/mcp/tools/create-transaction")).default;
}

beforeEach(() => {
  process.env.SUPABASE_URL = "https://fake.supabase.co";
  process.env.SUPABASE_PUBLISHABLE_KEY = "fake-anon-key";
});

const baseInput = {
  company_id: COMPANY,
  type: "revenue" as const,
  amount: 150.5,
  date: "2026-07-10",
  description: "Consultoria — parcela 1",
};

describe("mcp/create_transaction", () => {
  it("bloqueia chamada não autenticada", async () => {
    setNextFixtures({});
    const tool = await loadTool();
    const res: any = await tool.handler(baseInput as any, makeCtx({ authenticated: false }));

    expect(res.isError).toBe(true);
    expect(getLastCalls()).toEqual([]);
  });

  it("insere com user_id do token, status=confirmed e source=mcp (não confia no input)", async () => {
    setNextFixtures({
      transactions: {
        insert: {
          data: { id: "new-tx-1", ...baseInput, user_id: USER, status: "confirmed", source: "mcp" },
          error: null,
        },
      },
    });
    const tool = await loadTool();
    // Tentativa maliciosa: injetar user_id "de outra pessoa" no input. Deve ser ignorado.
    const res: any = await tool.handler(
      { ...baseInput, ...({ user_id: "attacker" } as any) },
      makeCtx({ userId: USER }),
    );

    expect(res.isError).toBeUndefined();
    expect(res.content[0].text).toMatch(/new-tx-1/);
    expect(res.structuredContent.transaction.id).toBe("new-tx-1");

    const call = getLastCalls().find((c) => c.op === "insert" && c.table === "transactions")!;
    const values = call.args.values as Record<string, unknown>;
    expect(values.user_id).toBe(USER);
    expect(values.company_id).toBe(COMPANY);
    expect(values.status).toBe("confirmed");
    expect(values.source).toBe("mcp");
    expect(values.type).toBe("revenue");
    expect(values.amount).toBe(150.5);
    // Sem escalonamento: nenhum campo perigoso extra
    expect(values).not.toHaveProperty("is_intercompany");
    expect(call.args.single).toBe(true);
  });

  it("RLS negando o INSERT (não-membro) → erro propagado, nenhum bypass", async () => {
    setNextFixtures({
      transactions: {
        insert: {
          data: null,
          error: {
            message: 'new row violates row-level security policy for table "transactions"',
            code: "42501",
          },
        },
      },
    });
    const tool = await loadTool();
    const res: any = await tool.handler(baseInput as any, makeCtx());

    expect(res.isError).toBe(true);
    expect(res.content[0].text).toMatch(/row-level security/i);
  });
});
