#!/usr/bin/env node
/**
 * MCP server para a API Belvo (Open Finance LATAM/Brasil).
 * Auth via env BELVO_SECRET_ID / BELVO_SECRET_PASSWORD (HTTP Basic).
 * Ambiente: BELVO_ENV=sandbox|production (padrão sandbox).
 *
 * Nota: shapes de resposta seguem a documentação estável da Belvo; validar
 * contra o sandbox antes de produção. Ver ../../docs/reference/openfinance-apis.md.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { belvoRequest, qs } from "./client.js";

const server = new McpServer({ name: "belvo", version: "1.0.0" });

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}
function fail(e: unknown) {
  return { isError: true, content: [{ type: "text" as const, text: String(e instanceof Error ? e.message : e) }] };
}

server.tool(
  "belvo_list_institutions",
  "Lista as instituições disponíveis. Filtra por país (country_code=BR) e tipo.",
  {
    country_code: z.string().optional().describe("Ex.: BR"),
    type: z.string().optional().describe("bank | fiscal | employment ..."),
  },
  async (a) => {
    try { return ok(await belvoRequest("GET", `/api/institutions/${qs({ country_code: a.country_code, type: a.type })}`)); } catch (e) { return fail(e); }
  },
);

server.tool(
  "belvo_create_widget_token",
  "Cria o access token para inicializar o Connect Widget da Belvo.",
  {
    scopes: z.string().default("read_institutions,write_links,read_links").describe("Escopos do widget"),
    link: z.string().optional().describe("Para reconexão de um link existente"),
  },
  async (a) => {
    try {
      const id = process.env.BELVO_SECRET_ID;
      const password = process.env.BELVO_SECRET_PASSWORD;
      const body: Record<string, unknown> = { id, password, scopes: a.scopes };
      if (a.link) body.link = a.link;
      return ok(await belvoRequest("POST", "/api/token/", body));
    } catch (e) { return fail(e); }
  },
);

server.tool(
  "belvo_list_links",
  "Lista os links (conexões cliente↔banco).",
  {},
  async () => { try { return ok(await belvoRequest("GET", "/api/links/")); } catch (e) { return fail(e); } },
);

server.tool(
  "belvo_delete_link",
  "Remove um link (revoga a conexão).",
  { link: z.string() },
  async (a) => {
    try { await belvoRequest("DELETE", `/api/links/${a.link}/`); return ok({ deleted: a.link }); } catch (e) { return fail(e); }
  },
);

server.tool(
  "belvo_list_accounts",
  "Lista contas já coletadas de um link.",
  { link: z.string() },
  async (a) => {
    try { return ok(await belvoRequest("GET", `/api/accounts/${qs({ link: a.link })}`)); } catch (e) { return fail(e); }
  },
);

server.tool(
  "belvo_retrieve_accounts",
  "Força a coleta das contas de um link (POST).",
  { link: z.string() },
  async (a) => {
    try { return ok(await belvoRequest("POST", "/api/accounts/", { link: a.link })); } catch (e) { return fail(e); }
  },
);

server.tool(
  "belvo_list_transactions",
  "Lista transações já coletadas de um link.",
  {
    link: z.string(),
    page_size: z.number().optional().describe("Itens por página (padrão 100)"),
  },
  async (a) => {
    try { return ok(await belvoRequest("GET", `/api/transactions/${qs({ link: a.link, page_size: a.page_size })}`)); } catch (e) { return fail(e); }
  },
);

server.tool(
  "belvo_retrieve_transactions",
  "Força a coleta de transações de um link num intervalo de datas (POST).",
  {
    link: z.string(),
    date_from: z.string().describe("YYYY-MM-DD"),
    date_to: z.string().optional().describe("YYYY-MM-DD (padrão hoje)"),
  },
  async (a) => {
    try { return ok(await belvoRequest("POST", "/api/transactions/", { link: a.link, date_from: a.date_from, date_to: a.date_to })); } catch (e) { return fail(e); }
  },
);

server.tool(
  "belvo_list_webhooks",
  "Lista os webhooks registrados.",
  {},
  async () => { try { return ok(await belvoRequest("GET", "/api/webhooks/")); } catch (e) { return fail(e); } },
);

server.tool(
  "belvo_create_webhook",
  "Registra um webhook para eventos (ACCOUNTS, TRANSACTIONS, ...).",
  {
    url: z.string(),
    auth_token: z.string().describe("Token que a Belvo devolve no header para validação"),
    events: z.array(z.string()).default(["TRANSACTIONS"]),
  },
  async (a) => {
    try { return ok(await belvoRequest("POST", "/api/webhooks/", { url: a.url, auth_token: a.auth_token, events: a.events })); } catch (e) { return fail(e); }
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("[mcp-belvo] ready");
