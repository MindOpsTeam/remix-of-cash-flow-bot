#!/usr/bin/env node
/**
 * MCP server para a API Pluggy (Open Finance Brasil).
 * Ferramentas de leitura + operação de conexões, contas e transações.
 * Auth via env PLUGGY_CLIENT_ID / PLUGGY_CLIENT_SECRET.
 *
 * Sandbox: use PLUGGY_API_URL padrão + connector 2 ("Pluggy Bank") com
 * credenciais user-ok / password-ok. Ver README.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { pluggyRequest, qs } from "./client.js";

const server = new McpServer({ name: "pluggy", version: "1.0.0" });

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}
function fail(e: unknown) {
  return { isError: true, content: [{ type: "text" as const, text: String(e instanceof Error ? e.message : e) }] };
}

server.tool(
  "pluggy_list_connectors",
  "Lista os conectores (bancos/instituições) disponíveis. Filtra por país e nome.",
  {
    country: z.string().optional().describe("Código do país, ex.: BR"),
    name: z.string().optional().describe("Filtra por nome da instituição"),
    isOpenFinance: z.boolean().optional().describe("Só conectores regulados Open Finance"),
    sandbox: z.boolean().optional().describe("Inclui conectores sandbox"),
  },
  async (a) => {
    try {
      return ok(await pluggyRequest("GET", `/connectors${qs({ countries: a.country, name: a.name, isOpenFinance: a.isOpenFinance, sandbox: a.sandbox })}`));
    } catch (e) { return fail(e); }
  },
);

server.tool(
  "pluggy_create_connect_token",
  "Cria um connect token para inicializar o widget Pluggy Connect no frontend.",
  {
    clientUserId: z.string().optional().describe("Identificador do usuário/empresa"),
    webhookUrl: z.string().optional().describe("URL para notificações do item"),
    itemId: z.string().optional().describe("Para atualizar/reconectar um item existente"),
  },
  async (a) => {
    try {
      const opts: Record<string, unknown> = { avoidDuplicates: true };
      if (a.clientUserId) opts.clientUserId = a.clientUserId;
      if (a.webhookUrl) opts.webhookUrl = a.webhookUrl;
      const body: Record<string, unknown> = { options: opts };
      if (a.itemId) body.itemId = a.itemId;
      return ok(await pluggyRequest("POST", "/connect_token", body));
    } catch (e) { return fail(e); }
  },
);

server.tool(
  "pluggy_create_item",
  "Cria um item (conexão) server-side com credenciais diretas. Útil no SANDBOX (connectorId 2, parameters {user:'user-ok', password:'password-ok'}).",
  {
    connectorId: z.number().describe("Id do conector (2 = Pluggy Bank sandbox)"),
    parameters: z.record(z.string()).describe("Credenciais, ex.: {user:'user-ok', password:'password-ok'}"),
    webhookUrl: z.string().optional(),
  },
  async (a) => {
    try {
      return ok(await pluggyRequest("POST", "/items", { connectorId: a.connectorId, parameters: a.parameters, webhookUrl: a.webhookUrl }));
    } catch (e) { return fail(e); }
  },
);

server.tool(
  "pluggy_get_item",
  "Recupera o status e detalhes de um item (conexão).",
  { itemId: z.string() },
  async (a) => {
    try { return ok(await pluggyRequest("GET", `/items/${a.itemId}`)); } catch (e) { return fail(e); }
  },
);

server.tool(
  "pluggy_delete_item",
  "Remove um item (revoga a conexão/consentimento).",
  { itemId: z.string() },
  async (a) => {
    try { await pluggyRequest("DELETE", `/items/${a.itemId}`); return ok({ deleted: a.itemId }); } catch (e) { return fail(e); }
  },
);

server.tool(
  "pluggy_list_accounts",
  "Lista as contas de um item.",
  { itemId: z.string(), type: z.enum(["BANK", "CREDIT"]).optional() },
  async (a) => {
    try { return ok(await pluggyRequest("GET", `/accounts${qs({ itemId: a.itemId, type: a.type })}`)); } catch (e) { return fail(e); }
  },
);

server.tool(
  "pluggy_get_account_balance",
  "Saldo em tempo real de uma conta.",
  { accountId: z.string() },
  async (a) => {
    try { return ok(await pluggyRequest("GET", `/accounts/${a.accountId}/balance`)); } catch (e) { return fail(e); }
  },
);

server.tool(
  "pluggy_list_transactions",
  "Lista transações de uma conta (uma página; use 'after' para paginar).",
  {
    accountId: z.string(),
    dateFrom: z.string().optional().describe("YYYY-MM-DD"),
    dateTo: z.string().optional().describe("YYYY-MM-DD"),
    after: z.string().optional().describe("Cursor da página seguinte"),
  },
  async (a) => {
    try { return ok(await pluggyRequest("GET", `/v2/transactions${qs({ accountId: a.accountId, dateFrom: a.dateFrom, dateTo: a.dateTo, after: a.after })}`)); } catch (e) { return fail(e); }
  },
);

server.tool(
  "pluggy_list_webhooks",
  "Lista os webhooks registrados.",
  {},
  async () => { try { return ok(await pluggyRequest("GET", "/webhooks")); } catch (e) { return fail(e); } },
);

server.tool(
  "pluggy_create_webhook",
  "Registra um webhook para eventos (item/updated, transactions/created, etc.).",
  { url: z.string(), event: z.string().default("all").describe("Evento ou 'all'") },
  async (a) => {
    try { return ok(await pluggyRequest("POST", "/webhooks", { url: a.url, event: a.event })); } catch (e) { return fail(e); }
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("[mcp-pluggy] ready");
