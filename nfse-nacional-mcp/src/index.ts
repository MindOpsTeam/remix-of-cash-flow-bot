#!/usr/bin/env node
/**
 * MCP Server — NFS-e Nacional (ADN - Receita Federal)
 *
 * Integra com a API do ADN para emissão, cancelamento, consulta
 * e parametrização de NFS-e no padrão nacional.
 *
 * Transporte: stdio
 * Autenticação: mTLS com certificado ICP-Brasil A1 (.pfx)
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { CertManager } from "./auth/cert-manager.js";
import { AdnHttpClient } from "./auth/http-client.js";
import { loadConfig, getAdnUrl, getSefinUrl, type Ambiente } from "./config.js";
import { NfseError, NfseValidationError, NfseCertificateError } from "./errors/nfse-errors.js";

// Tools
import { nfseEmitir, nfseEmitirLote } from "./tools/emissao.js";
import { nfseCancelar, nfseSubstituir } from "./tools/eventos.js";
import { nfseConsultarChave, nfseConsultarDfe, nfseConsultarLote } from "./tools/consultas.js";
import { nfseGerarDanfse } from "./tools/documentos.js";
import {
  nfseParametrosMunicipio,
  nfseParametrosContribuinte,
  nfseCncConsultar,
  nfseCodigosServico,
} from "./tools/parametros.js";
import { nfseValidarDps, nfseStatusAmbiente } from "./tools/utils.js";

// ── Shared Zod schemas ──

const dpsServicoSchema = z.object({
  codigoTribNac: z.string().describe("Código de tributação nacional (LC 116/2003)"),
  descricao: z.string().describe("Descrição do serviço prestado"),
  quantidade: z.number().optional(),
  valorUnitario: z.number().optional(),
  codigoCnae: z.string().optional(),
  codigoNbs: z.string().optional(),
});

const dpsTomadorSchema = z.object({
  cpfCnpj: z.string().describe("CPF (11 dígitos) ou CNPJ (14 dígitos) do tomador"),
  razaoSocial: z.string().optional(),
  nomeFantasia: z.string().optional(),
  email: z.string().optional(),
  telefone: z.string().optional(),
  endereco: z.object({
    logradouro: z.string().optional(),
    numero: z.string().optional(),
    complemento: z.string().optional(),
    bairro: z.string().optional(),
    codigoMunicipio: z.string().optional(),
    uf: z.string().optional(),
    cep: z.string().optional(),
    codigoPais: z.string().optional(),
  }).optional(),
}).optional();

const dpsValoresSchema = z.object({
  valorServicos: z.number().describe("Valor total dos serviços"),
  deducoes: z.number().optional(),
  descontoIncondicionado: z.number().optional(),
  descontoCondicionado: z.number().optional(),
  aliquotaIss: z.number().optional().describe("Alíquota do ISS (%)"),
  issRetido: z.boolean().optional(),
  valorIss: z.number().optional(),
  valorLiquido: z.number().optional(),
  outrasRetencoes: z.number().optional(),
  valorIr: z.number().optional(),
  valorPis: z.number().optional(),
  valorCofins: z.number().optional(),
  valorCsll: z.number().optional(),
  valorInss: z.number().optional(),
});

const dpsInputSchema = z.object({
  cnpjPrestador: z.string().describe("CNPJ do prestador (14 dígitos, sem pontuação)"),
  inscricaoMunicipal: z.string().optional(),
  codigoMunicipio: z.string().describe("Código IBGE do município (7 dígitos)"),
  competencia: z.string().describe("Competência no formato YYYY-MM"),
  serieDps: z.string().describe("Série da DPS (numérica a partir de jan/2026)"),
  numeroDps: z.string().describe("Número sequencial da DPS"),
  servico: dpsServicoSchema,
  tomador: dpsTomadorSchema,
  valores: dpsValoresSchema,
  observacoes: z.string().optional(),
  regimeEspecial: z.string().optional(),
  naturezaTributacao: z.string().optional(),
  optanteSimplesNacional: z.boolean().optional(),
});

// ── Error wrapper ──

function formatError(err: unknown): { content: Array<{ type: "text"; text: string }>; isError: true } {
  let message: string;

  if (err instanceof NfseValidationError) {
    message = `Erro de validação:\n${err.errors.map((e) => `  • ${e.field}: ${e.message}`).join("\n")}`;
  } else if (err instanceof NfseCertificateError) {
    message = `Erro de certificado: ${err.message}`;
  } else if (err instanceof NfseError) {
    message = `Erro NFS-e [${err.code}]: ${err.message}`;
  } else if (err instanceof Error) {
    message = err.message;
  } else {
    message = String(err);
  }

  return { content: [{ type: "text", text: message }], isError: true };
}

function jsonResult(data: unknown): { content: Array<{ type: "text"; text: string }> } {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

// ── Main ──

async function main() {
  const config = loadConfig();
  const ambiente = config.ambiente;

  // Load certificate
  const certManager = new CertManager(config.certPath, config.certPassword);
  await certManager.load();

  const certInfo = certManager.getCertInfo();
  const expiry = certManager.checkExpiry();
  console.error(
    `[nfse-mcp] Certificado carregado: ${certInfo.razaoSocial || certInfo.subject} | ` +
    `CNPJ: ${certInfo.cnpj || "N/A"} | Expira em: ${expiry.daysLeft} dias | ` +
    `Ambiente: ${ambiente}`,
  );
  for (const w of expiry.warnings) console.error(`[nfse-mcp] ⚠ ${w}`);

  // HTTP client with mTLS (ADN for distribution/DANFSE, SEFIN for emission)
  const client = new AdnHttpClient(getAdnUrl(ambiente), certManager, getSefinUrl(ambiente));

  // Create MCP server
  const server = new McpServer({
    name: "nfse-nacional",
    version: "1.0.0",
  });

  // ────────────────────────────────────────────
  // EMISSÃO
  // ────────────────────────────────────────────

  server.tool(
    "nfse_emitir",
    "Emite uma NFS-e no padrão nacional. Constrói a DPS (Declaração de Prestação de Serviço), assina com certificado digital e envia ao ADN.",
    dpsInputSchema.shape,
    async (params) => {
      try {
        const result = await nfseEmitir(client, certManager, params);
        return jsonResult(result);
      } catch (err) {
        return formatError(err);
      }
    },
  );

  server.tool(
    "nfse_emitir_lote",
    "Emite um lote de até 50 NFS-e de forma assíncrona. Retorna um protocolo para consulta posterior.",
    {
      cnpjPrestador: z.string().describe("CNPJ do prestador (14 dígitos)"),
      lote: z.array(dpsInputSchema).describe("Array de DPS para emissão em lote (máx. 50)"),
    },
    async (params) => {
      try {
        const result = await nfseEmitirLote(client, certManager, params.cnpjPrestador, params.lote);
        return jsonResult(result);
      } catch (err) {
        return formatError(err);
      }
    },
  );

  // ────────────────────────────────────────────
  // EVENTOS
  // ────────────────────────────────────────────

  server.tool(
    "nfse_cancelar",
    "Cancela uma NFS-e autorizada (prazo de 35 dias). Gera evento de cancelamento assinado digitalmente.",
    {
      chaveAcesso: z.string().describe("Chave de acesso da NFS-e (50 caracteres)"),
      motivo: z.enum(["ERRO_EMISSAO", "SERVICO_NAO_PRESTADO", "OUTRO"]).describe("Motivo do cancelamento"),
      descricaoMotivo: z.string().optional().describe("Descrição detalhada do motivo"),
    },
    async (params) => {
      try {
        const result = await nfseCancelar(client, certManager, params);
        return jsonResult(result);
      } catch (err) {
        return formatError(err);
      }
    },
  );

  server.tool(
    "nfse_substituir",
    "Substitui uma NFS-e por outra. Cancela a original e emite uma nova em uma única operação.",
    {
      chaveAcessoOriginal: z.string().describe("Chave de acesso da NFS-e a substituir (50 caracteres)"),
      motivoSubstituicao: z.string().optional().describe("Motivo da substituição"),
      novaDps: dpsInputSchema.describe("Dados da nova NFS-e"),
    },
    async (params) => {
      try {
        const result = await nfseSubstituir(client, certManager, params);
        return jsonResult(result);
      } catch (err) {
        return formatError(err);
      }
    },
  );

  // ────────────────────────────────────────────
  // CONSULTAS
  // ────────────────────────────────────────────

  server.tool(
    "nfse_consultar_chave",
    "Consulta uma NFS-e pela chave de acesso. Retorna dados completos: prestador, tomador, serviço, valores e status.",
    {
      chaveAcesso: z.string().describe("Chave de acesso da NFS-e (50 caracteres)"),
      formato: z.enum(["xml", "json"]).optional().describe("Formato de retorno"),
    },
    async (params) => {
      try {
        const result = await nfseConsultarChave(client, params);
        return jsonResult(result);
      } catch (err) {
        return formatError(err);
      }
    },
  );

  server.tool(
    "nfse_consultar_dfe",
    "Consulta documentos fiscais por distribuição (DFe). Retorna NFS-e emitidas/recebidas a partir de um NSU.",
    {
      cnpj: z.string().describe("CNPJ do contribuinte (14 dígitos)"),
      ultimoNsu: z.string().describe("Último NSU processado (iniciar com '0' para primeira consulta)"),
      tipo: z.enum(["emitidas", "recebidas", "todas"]).optional().describe("Filtro por tipo de documento"),
    },
    async (params) => {
      try {
        const result = await nfseConsultarDfe(client, params);
        return jsonResult(result);
      } catch (err) {
        return formatError(err);
      }
    },
  );

  server.tool(
    "nfse_consultar_lote",
    "Consulta o resultado de um lote de NFS-e enviado via nfse_emitir_lote.",
    {
      protocolo: z.string().describe("Número do protocolo retornado pelo envio do lote"),
      cnpjPrestador: z.string().describe("CNPJ do prestador (14 dígitos)"),
    },
    async (params) => {
      try {
        const result = await nfseConsultarLote(client, params);
        return jsonResult(result);
      } catch (err) {
        return formatError(err);
      }
    },
  );

  // ────────────────────────────────────────────
  // DOCUMENTOS
  // ────────────────────────────────────────────

  server.tool(
    "nfse_gerar_danfse",
    "Gera o DANFSE (PDF) de uma NFS-e autorizada. Pode retornar em base64 e/ou salvar em disco.",
    {
      chaveAcesso: z.string().describe("Chave de acesso da NFS-e (50 caracteres)"),
      retornarBase64: z.boolean().optional().describe("Retornar PDF em base64 (default: true)"),
      salvarPath: z.string().optional().describe("Caminho para salvar o PDF em disco"),
    },
    async (params) => {
      try {
        const result = await nfseGerarDanfse(client, params);
        return jsonResult(result);
      } catch (err) {
        return formatError(err);
      }
    },
  );

  // ────────────────────────────────────────────
  // PARÂMETROS
  // ────────────────────────────────────────────

  server.tool(
    "nfse_parametros_municipio",
    "Consulta parâmetros fiscais de um município (aderência ao ADN, alíquotas, regimes especiais, benefícios).",
    {
      codigoMunicipio: z.string().describe("Código IBGE do município (7 dígitos)"),
      cpfCnpj: z.string().optional().describe("CPF/CNPJ para consulta personalizada"),
    },
    async (params) => {
      try {
        const result = await nfseParametrosMunicipio(client, params);
        return jsonResult(result);
      } catch (err) {
        return formatError(err);
      }
    },
  );

  server.tool(
    "nfse_parametros_contribuinte",
    "Consulta parâmetros fiscais de um contribuinte em um município (Simples Nacional, alíquota ISS, benefícios).",
    {
      codigoMunicipio: z.string().describe("Código IBGE do município (7 dígitos)"),
      cpfCnpj: z.string().describe("CPF ou CNPJ do contribuinte"),
    },
    async (params) => {
      try {
        const result = await nfseParametrosContribuinte(client, params);
        return jsonResult(result);
      } catch (err) {
        return formatError(err);
      }
    },
  );

  server.tool(
    "nfse_cnc_consultar",
    "Consulta o Cadastro Nacional de Contribuintes (CNC). Retorna dados cadastrais e inscrições municipais.",
    {
      cpfCnpj: z.string().describe("CPF ou CNPJ do contribuinte"),
      codigoMunicipio: z.string().optional().describe("Código IBGE do município para filtrar inscrições"),
    },
    async (params) => {
      try {
        const result = await nfseCncConsultar(client, params);
        return jsonResult(result);
      } catch (err) {
        return formatError(err);
      }
    },
  );

  server.tool(
    "nfse_codigos_servico",
    "Pesquisa códigos de serviço da LC 116/2003 (tributação nacional). Busca por texto ou código específico.",
    {
      busca: z.string().optional().describe("Texto para busca na descrição ou grupo"),
      codigo: z.string().optional().describe("Código específico (ex: '01.01.01')"),
    },
    async (params) => {
      try {
        const result = await nfseCodigosServico(client, params);
        return jsonResult(result);
      } catch (err) {
        return formatError(err);
      }
    },
  );

  // ────────────────────────────────────────────
  // UTILITÁRIOS
  // ────────────────────────────────────────────

  server.tool(
    "nfse_validar_dps",
    "Valida uma DPS localmente sem enviar ao ADN. Verifica campos obrigatórios, formatos, CNPJ/CPF e certificado.",
    dpsInputSchema.shape,
    async (params) => {
      try {
        const result = nfseValidarDps(certManager, params);
        return jsonResult(result);
      } catch (err) {
        return formatError(err);
      }
    },
  );

  server.tool(
    "nfse_status_ambiente",
    "Verifica status do ambiente ADN (produção/homologação) e validade do certificado digital.",
    {},
    async () => {
      try {
        const result = await nfseStatusAmbiente(client, certManager, ambiente);
        return jsonResult(result);
      } catch (err) {
        return formatError(err);
      }
    },
  );

  // ── Start server ──

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[nfse-mcp] Servidor MCP iniciado (${ambiente}) — 14 tools registradas`);
}

main().catch((err) => {
  console.error("[nfse-mcp] Falha ao iniciar:", err);
  process.exit(1);
});
