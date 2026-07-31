#!/usr/bin/env node
/**
 * MCP server da Conta Azul (API v2). Espelha o padrão de mcp-servers/pluggy:
 * stdio, tools finas sobre o cliente REST, ok/fail padronizados.
 *
 * Recursos cobertos: pessoas (clientes/fornecedores), produtos, serviços,
 * vendas, contas a receber/pagar, parcelas, contas financeiras, categorias e
 * um escape hatch genérico para o resto da API.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { caRequest, qs } from "./client.js";

const server = new McpServer({ name: "contaazul", version: "1.0.0" });

const ok = (data: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] });
const fail = (e: unknown) => ({
  content: [{ type: "text" as const, text: `ERRO: ${e instanceof Error ? e.message : String(e)}` }],
  isError: true as const,
});

const paginacao = {
  pagina: z.number().optional().describe("Página (1-based)"),
  tamanho_pagina: z.number().optional().describe("Itens por página (máx. usual 100)"),
};

server.tool(
  "ca_status",
  "Testa a autenticação e mostra o que a credencial enxerga (1 pessoa, 1 serviço).",
  {},
  async () => {
    try {
      const pessoas = await caRequest("GET", `/v1/pessoas${qs({ pagina: 1, tamanho_pagina: 1 })}`);
      return ok({ autenticado: true, amostra_pessoas: pessoas });
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  "ca_list_pessoas",
  "Lista pessoas (clientes e fornecedores). Filtra por nome/documento e tipo de perfil.",
  {
    busca: z.string().optional().describe("Nome, razão social ou documento"),
    tipo_perfil: z.string().optional().describe("CLIENTE | FORNECEDOR | TRANSPORTADORA"),
    ...paginacao,
  },
  async (a) => {
    try {
      return ok(await caRequest("GET", `/v1/pessoas${qs({ busca: a.busca, tipo_perfil: a.tipo_perfil, pagina: a.pagina, tamanho_pagina: a.tamanho_pagina })}`));
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  "ca_get_pessoa",
  "Detalha uma pessoa pelo id.",
  { id: z.string().describe("UUID da pessoa") },
  async (a) => {
    try {
      return ok(await caRequest("GET", `/v1/pessoas/${a.id}`));
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  "ca_create_pessoa",
  "Cria uma pessoa (cliente/fornecedor). Passe o corpo no formato da API v2.",
  { corpo: z.record(z.unknown()).describe("Payload JSON de POST /v1/pessoas") },
  async (a) => {
    try {
      return ok(await caRequest("POST", "/v1/pessoas", a.corpo));
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  "ca_list_produtos",
  "Lista produtos cadastrados.",
  { busca: z.string().optional(), ...paginacao },
  async (a) => {
    try {
      return ok(await caRequest("GET", `/v1/produtos${qs({ busca: a.busca, pagina: a.pagina, tamanho_pagina: a.tamanho_pagina })}`));
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  "ca_list_servicos",
  "Lista serviços cadastrados.",
  { busca: z.string().optional(), ...paginacao },
  async (a) => {
    try {
      return ok(await caRequest("GET", `/v1/servicos${qs({ busca: a.busca, pagina: a.pagina, tamanho_pagina: a.tamanho_pagina })}`));
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  "ca_list_vendas",
  "Lista vendas por período/situação.",
  {
    data_inicial: z.string().optional().describe("YYYY-MM-DD"),
    data_final: z.string().optional().describe("YYYY-MM-DD"),
    situacao: z.string().optional().describe("Situação da venda na API v2"),
    ...paginacao,
  },
  async (a) => {
    try {
      return ok(await caRequest("GET", `/v1/venda${qs({ data_inicial: a.data_inicial, data_final: a.data_final, situacao: a.situacao, pagina: a.pagina, tamanho_pagina: a.tamanho_pagina })}`));
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  "ca_get_venda",
  "Detalha uma venda pelo id (itens, parcelas, cliente).",
  { id: z.string().describe("UUID da venda") },
  async (a) => {
    try {
      return ok(await caRequest("GET", `/v1/venda/${a.id}`));
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  "ca_list_contas_receber",
  "Lista contas a receber por período de vencimento e situação.",
  {
    data_vencimento_de: z.string().optional().describe("YYYY-MM-DD"),
    data_vencimento_ate: z.string().optional().describe("YYYY-MM-DD"),
    situacao: z.string().optional().describe("EM_ABERTO | RECEBIDO | ..."),
    ...paginacao,
  },
  async (a) => {
    try {
      return ok(await caRequest("GET", `/v1/financeiro/eventos-financeiros/contas-a-receber/buscar${qs({ data_vencimento_de: a.data_vencimento_de, data_vencimento_ate: a.data_vencimento_ate, situacao: a.situacao, pagina: a.pagina, tamanho_pagina: a.tamanho_pagina })}`));
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  "ca_list_contas_pagar",
  "Lista contas a pagar por período de vencimento e situação.",
  {
    data_vencimento_de: z.string().optional().describe("YYYY-MM-DD"),
    data_vencimento_ate: z.string().optional().describe("YYYY-MM-DD"),
    situacao: z.string().optional(),
    ...paginacao,
  },
  async (a) => {
    try {
      return ok(await caRequest("GET", `/v1/financeiro/eventos-financeiros/contas-a-pagar/buscar${qs({ data_vencimento_de: a.data_vencimento_de, data_vencimento_ate: a.data_vencimento_ate, situacao: a.situacao, pagina: a.pagina, tamanho_pagina: a.tamanho_pagina })}`));
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  "ca_list_parcelas",
  "Lista parcelas de um evento financeiro (conta a pagar/receber).",
  { evento_id: z.string().describe("UUID do evento financeiro") },
  async (a) => {
    try {
      return ok(await caRequest("GET", `/v1/financeiro/eventos-financeiros/${a.evento_id}/parcelas`));
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  "ca_list_contas_financeiras",
  "Lista as contas financeiras (bancos/caixas) da empresa.",
  { ...paginacao },
  async (a) => {
    try {
      return ok(await caRequest("GET", `/v1/conta-financeira${qs({ pagina: a.pagina, tamanho_pagina: a.tamanho_pagina })}`));
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  "ca_list_categorias",
  "Lista as categorias financeiras (plano de categorias da Conta Azul).",
  { ...paginacao },
  async (a) => {
    try {
      return ok(await caRequest("GET", `/v1/categorias${qs({ pagina: a.pagina, tamanho_pagina: a.tamanho_pagina })}`));
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  "ca_api",
  "Escape hatch: chamada crua à API v2 da Conta Azul. Use quando nenhuma tool específica cobrir o endpoint.",
  {
    method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
    path: z.string().describe("Caminho começando com /v1/…"),
    body: z.record(z.unknown()).optional().describe("Corpo JSON quando aplicável"),
  },
  async (a) => {
    try {
      return ok(await caRequest(a.method, a.path, a.body));
    } catch (e) {
      return fail(e);
    }
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("[mcp-contaazul] servidor pronto (stdio)");
