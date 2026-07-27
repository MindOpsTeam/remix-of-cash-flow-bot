/**
 * Test helpers para as ferramentas MCP.
 * - `makeCtx`: mock de ToolContext (autenticado/anônimo, com userId/token).
 * - `makeFakeSupabase`: fake do cliente Supabase que registra chamadas encadeadas
 *   e devolve `{ data, error }` configurados por tabela. Simula RLS retornando
 *   arrays vazios quando o "usuário" não é membro, e permite injetar erros de
 *   permissão para o INSERT.
 *
 * Não temos como emitir um token OAuth Supabase válido em ambiente unitário
 * (mcp-js exige `client_id` no claim), então o teste ataca o handler direto —
 * é onde vive a régua de negócio da ferramenta.
 */
import { vi } from "vitest";

// ---------- ToolContext ----------

export interface FakeCtxOptions {
  authenticated?: boolean;
  userId?: string;
  token?: string;
  claims?: Record<string, unknown>;
}

export function makeCtx(opts: FakeCtxOptions = {}) {
  const {
    authenticated = true,
    userId = "11111111-1111-1111-1111-111111111111",
    token = "fake-oauth-token",
    claims = { sub: userId, client_id: "test-client" },
  } = opts;
  return {
    isAuthenticated: () => authenticated,
    getUserId: () => (authenticated ? userId : null),
    getUserEmail: () => (authenticated ? "tester@example.com" : null),
    getClientId: () => (authenticated ? (claims.client_id as string) : null),
    getClaims: () => (authenticated ? claims : null),
    getToken: () => (authenticated ? token : null),
  } as any;
}

// ---------- Fake Supabase client ----------

export interface QueryResult {
  data: unknown;
  error: { message: string; code?: string } | null;
}

/**
 * Espera fixtures por tabela e operação. As chaves possíveis:
 *   select: default retornado por `.select().then(...)` (thenable no fim da cadeia).
 *   insert: retorno de `.insert(...).select().single()` OU `.insert(...)`.
 * Cada teste passa apenas o que exercita.
 */
export interface TableFixture {
  select?: QueryResult;
  insert?: QueryResult;
}

export interface QueryCall {
  table: string;
  op: "select" | "insert";
  args: {
    columns?: string;
    values?: unknown;
    filters: Array<{ op: string; column: string; value: unknown }>;
    order?: { column: string; ascending: boolean };
    limit?: number;
    single?: boolean;
  };
}

export function makeFakeSupabase(fixtures: Record<string, TableFixture> = {}) {
  const calls: QueryCall[] = [];

  function buildBuilder(table: string, op: "select" | "insert", initial: Partial<QueryCall["args"]> = {}) {
    const state: QueryCall["args"] = { filters: [], ...initial };
    const call: QueryCall = { table, op, args: state };
    calls.push(call);

    const result = () =>
      Promise.resolve(
        fixtures[table]?.[op] ?? { data: op === "select" ? [] : null, error: null },
      );

    const builder: any = {
      select(columns?: string) {
        state.columns = columns;
        // .select() após insert só troca para leitura, mas mantém a fixture do insert
        return builder;
      },
      eq(column: string, value: unknown) {
        state.filters.push({ op: "eq", column, value });
        return builder;
      },
      gte(column: string, value: unknown) {
        state.filters.push({ op: "gte", column, value });
        return builder;
      },
      lte(column: string, value: unknown) {
        state.filters.push({ op: "lte", column, value });
        return builder;
      },
      in(column: string, value: unknown) {
        state.filters.push({ op: "in", column, value });
        return builder;
      },
      order(column: string, opts?: { ascending?: boolean }) {
        state.order = { column, ascending: opts?.ascending ?? true };
        return builder;
      },
      limit(n: number) {
        state.limit = n;
        return builder;
      },
      single() {
        state.single = true;
        return result();
      },
      // Thenable — permite `await builder` sem `.single()`
      then(resolve: (v: QueryResult) => unknown, reject?: (e: unknown) => unknown) {
        return result().then(resolve, reject);
      },
    };
    return builder;
  }

  const client = {
    from(table: string) {
      return {
        select: (columns?: string) => buildBuilder(table, "select", { columns }),
        insert: (values: unknown) => buildBuilder(table, "insert", { values }),
      };
    },
  };

  return { client, calls };
}

// ---------- Mock do módulo @supabase/supabase-js ----------

/**
 * Precisa ser chamado ANTES de importar a ferramenta. Uso:
 *   const { getLastClient, setNextFixtures } = installSupabaseMock();
 *   const tool = (await import("@/lib/mcp/tools/list-transactions")).default;
 */
export function installSupabaseMock() {
  let nextFixtures: Record<string, TableFixture> = {};
  let lastFake: ReturnType<typeof makeFakeSupabase> | null = null;

  vi.doMock("@supabase/supabase-js", () => ({
    createClient: vi.fn(() => {
      lastFake = makeFakeSupabase(nextFixtures);
      return lastFake.client;
    }),
  }));

  return {
    setNextFixtures(f: Record<string, TableFixture>) {
      nextFixtures = f;
    },
    getLastCalls(): QueryCall[] {
      return lastFake?.calls ?? [];
    },
  };
}
