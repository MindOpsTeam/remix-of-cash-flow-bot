/**
 * Smoke test HTTP contra a edge function MCP publicada.
 *
 * Pulado por padrão (requer rede + função implantada). Ative com:
 *   MCP_E2E=1 MCP_URL=https://<ref>.supabase.co/functions/v1/mcp pnpm test
 *
 * Verifica só o que dá para verificar sem token OAuth válido (mcp-js exige
 * claim `client_id` em produção, que só sai do fluxo de authorization code):
 *  - Sem Authorization → 401.
 *  - Com bearer inválido → 401.
 * As invocações autenticadas ficam cobertas pelos testes unitários dos
 * handlers, que exercitam a mesma régua de RLS/negócio.
 */
import { describe, it, expect } from "vitest";

const ENABLED = process.env.MCP_E2E === "1";
const MCP_URL = process.env.MCP_URL ?? "";

const d = ENABLED && MCP_URL ? describe : describe.skip;

d("mcp edge function — auth boundary", () => {
  it("sem Authorization retorna 401", async () => {
    const res = await fetch(`${MCP_URL}/.mcp/list-tools`, { method: "GET" });
    await res.text();
    expect(res.status).toBe(401);
  });

  it("com bearer inválido retorna 401", async () => {
    const res = await fetch(`${MCP_URL}/.mcp/list-tools`, {
      method: "GET",
      headers: { Authorization: "Bearer not-a-real-token" },
    });
    await res.text();
    expect(res.status).toBe(401);
  });
});
