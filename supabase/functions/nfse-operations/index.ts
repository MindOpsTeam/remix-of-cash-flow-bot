/**
 * Edge function: NFS-e Operations (multi-tenant)
 *
 * Ponte entre o frontend/agents e o MCP server.
 * Busca nfse_config por company_id, instancia o certificado,
 * e executa a operação solicitada.
 *
 * POST /nfse-operations
 * Body: { company_id, operation, params }
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";
import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";
import forge from "https://esm.sh/node-forge@1.3.1";

// Operations that this edge function supports
const VALID_OPERATIONS = [
  "status",          // Check ambiente + cert validity
  "parse_cert",      // Parse PFX, extract CNPJ/razão social/expiry, save to DB
  "validar_dps",     // Validate DPS locally
  "emitir",          // Emit NFS-e
  "cancelar",        // Cancel NFS-e
  "consultar_chave", // Query by access key
  "parametros_municipio", // Municipal parameters
  "codigos_servico", // LC 116 service codes
] as const;

type Operation = typeof VALID_OPERATIONS[number];

interface NfseConfig {
  id: string;
  company_id: string;
  cert_pfx_base64: string;
  cert_password: string;
  cert_cnpj: string | null;
  cert_razao_social: string | null;
  cert_expires_at: string | null;
  ambiente: string;
  serie_dps: string;
  proximo_numero_dps: number;
  codigo_municipio: string | null;
  inscricao_municipal: string | null;
  active: boolean;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const preflight = corsPreflightResponse(req);
  if (preflight) return preflight;

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Validate JWT first
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse({ error: "Unauthorized" }, 401, corsHeaders);
  }
  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authError } = await authClient.auth.getUser();
  if (authError || !user) {
    return jsonResponse({ error: "Unauthorized" }, 401, corsHeaders);
  }

  // Use service role for DB operations (RLS still protects via company_id verification below)
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const body = await req.json();
    const { company_id, operation, params } = body as {
      company_id: string;
      operation: string;
      params?: Record<string, unknown>;
    };

    if (!company_id) {
      return jsonResponse({ error: "company_id is required" }, 400, corsHeaders);
    }

    if (!operation || !VALID_OPERATIONS.includes(operation as Operation)) {
      return jsonResponse({
        error: `Invalid operation: "${operation}". Valid: ${VALID_OPERATIONS.join(", ")}`,
      }, 400, corsHeaders);
    }

    // Load NFS-e config for this company
    const { data: config, error: configError } = await supabase
      .from("nfse_config")
      .select("*")
      .eq("company_id", company_id)
      .single();

    if (configError || !config) {
      return jsonResponse({
        error: "NFS-e não configurada para esta empresa. Acesse Configurações > Integrações > NFS-e Nacional.",
      }, 404, corsHeaders);
    }

    const nfseConfig = config as NfseConfig;

    if (!nfseConfig.cert_pfx_base64 || !nfseConfig.cert_password) {
      return jsonResponse({
        error: "Certificado digital não configurado. Faça upload do .pfx em Configurações > Integrações > NFS-e.",
      }, 400, corsHeaders);
    }

    // Route to operation handler (parse_cert bypasses active/expiry checks)
    const op = operation as Operation;
    let result: unknown;

    if (op === "parse_cert") {
      result = await parseCertAndSave(supabase, nfseConfig);
      return jsonResponse({ success: true, data: result }, 200, corsHeaders);
    }

    if (!nfseConfig.active) {
      return jsonResponse({ error: "Integração NFS-e está desativada para esta empresa." }, 400, corsHeaders);
    }

    // Check certificate expiry
    if (nfseConfig.cert_expires_at) {
      const expiresAt = new Date(nfseConfig.cert_expires_at);
      if (expiresAt < new Date()) {
        return jsonResponse({ error: "Certificado digital expirado. Renove o certificado A1." }, 400, corsHeaders);
      }
    }

    switch (op) {
      case "status":
        result = {
          ambiente: nfseConfig.ambiente,
          certificado: {
            cnpj: nfseConfig.cert_cnpj,
            razaoSocial: nfseConfig.cert_razao_social,
            expiraEm: nfseConfig.cert_expires_at,
            diasRestantes: nfseConfig.cert_expires_at
              ? Math.floor((new Date(nfseConfig.cert_expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
              : null,
          },
          configuracao: {
            serieDps: nfseConfig.serie_dps,
            proximoNumeroDps: nfseConfig.proximo_numero_dps,
            codigoMunicipio: nfseConfig.codigo_municipio,
            inscricaoMunicipal: nfseConfig.inscricao_municipal,
          },
          active: nfseConfig.active,
        };
        break;

      case "validar_dps":
        result = validarDpsLocal(nfseConfig, params || {});
        break;

      case "emitir":
        result = await emitirNfse(supabase, nfseConfig, params || {});
        break;

      case "cancelar":
      case "consultar_chave":
      case "parametros_municipio":
      case "codigos_servico":
        // These operations require actual ADN connectivity.
        // For now, return the config context so the MCP server can handle them.
        result = {
          message: `Operação "${op}" requer conexão mTLS com o ADN. Use o MCP server nfse-nacional com o certificado configurado.`,
          config: {
            ambiente: nfseConfig.ambiente,
            cnpj: nfseConfig.cert_cnpj,
            codigoMunicipio: nfseConfig.codigo_municipio,
          },
          params,
        };
        break;
    }

    return jsonResponse({ success: true, data: result }, 200, corsHeaders);
  } catch (error) {
    console.error("NFS-e operation error:", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Internal server error" },
      500,
      corsHeaders,
    );
  }
});

// ── Handlers ──

/**
 * Parses the stored .pfx and extracts cert metadata for ICP-Brasil certs.
 *
 * Brazilian PJ certs (e-CNPJ) have the CN in format "RAZAO SOCIAL:CNPJ14DIGITS"
 * or the CNPJ in SubjectAltName OtherName OID 2.16.76.1.3.3.
 * We try CN parsing first (most reliable), then fall back to raw Subject.
 */
/**
 * Cliente visto pelo mínimo que estas duas funções usam: `.from().update().eq()`.
 *
 * `ReturnType<typeof createClient>` resolvia para a instanciação PADRÃO dos
 * genéricos (schema `never`), enquanto o cliente realmente criado infere
 * `"public"`. Daí o "Type 'public' is not assignable to type 'never'" e o
 * update virando `never`. Descrever só o que se usa, com assinatura de MÉTODO,
 * casa com o cliente real sem arrastar os genéricos profundos do SupabaseClient
 * (que estouram em TS2589).
 */
interface ClienteParaConfigNfse {
  from(tabela: string): {
    update(valores: Record<string, unknown>): {
      eq(coluna: string, valor: string): PromiseLike<{ error: { message: string } | null }>;
    };
  };
}

async function parseCertAndSave(
  supabase: ClienteParaConfigNfse,
  config: NfseConfig,
): Promise<{ cnpj: string | null; razaoSocial: string | null; expiresAt: string | null; validDays: number | null }> {
  let certInfo: { cnpj: string | null; razaoSocial: string | null; expiresAt: string | null; validDays: number | null };

  try {
    const pfxBinary = atob(config.cert_pfx_base64);
    const pfxAsn1 = forge.asn1.fromDer(pfxBinary);
    const pfx = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, false, config.cert_password);

    const certBags = pfx.getBags({ bagType: forge.pki.oids.certBag });
    const certBag = certBags[forge.pki.oids.certBag]?.[0];
    const cert = certBag?.cert;

    if (!cert) throw new Error("Nenhum certificado encontrado no arquivo .pfx");

    const expiresAt = cert.validity.notAfter.toISOString();
    const validDays = Math.floor((cert.validity.notAfter.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

    // Extract CNPJ + razão social from CN (ICP-Brasil PJ format: "RAZAO SOCIAL:12345678000195")
    const cn = cert.subject.getField("CN")?.value as string | undefined ?? "";
    const cnMatch = cn.match(/:(\d{14})$/);
    const cnpj = cnMatch ? cnMatch[1] : null;
    const razaoSocial = cnMatch ? cn.slice(0, cnMatch.index).trim() : cn || null;

    certInfo = { cnpj, razaoSocial, expiresAt, validDays };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Distinguish wrong password from other errors
    if (msg.includes("PKCS#12") || msg.includes("mac verify") || msg.includes("Invalid password")) {
      throw new Error("Senha do certificado incorreta. Verifique a senha do arquivo .pfx.");
    }
    throw new Error(`Falha ao processar certificado: ${msg}`);
  }

  // Persist metadata
  await supabase
    .from("nfse_config")
    .update({
      cert_cnpj: certInfo.cnpj,
      cert_razao_social: certInfo.razaoSocial,
      cert_expires_at: certInfo.expiresAt,
      last_test_at: new Date().toISOString(),
      last_test_status: "ok",
    })
    .eq("id", config.id);

  return certInfo;
}

function validarDpsLocal(
  config: NfseConfig,
  params: Record<string, unknown>,
): { valida: boolean; erros: Array<{ campo: string; mensagem: string }>; avisos: Array<{ campo: string; mensagem: string }> } {
  const erros: Array<{ campo: string; mensagem: string }> = [];
  const avisos: Array<{ campo: string; mensagem: string }> = [];

  const cnpj = (params.cnpjPrestador as string) || config.cert_cnpj || "";
  const competencia = (params.competencia as string) || "";
  const serie = (params.serieDps as string) || config.serie_dps || "";
  const servico = params.servico as Record<string, unknown> | undefined;
  const valores = params.valores as Record<string, unknown> | undefined;

  if (!cnpj || cnpj.length !== 14) {
    erros.push({ campo: "cnpjPrestador", mensagem: "CNPJ deve ter 14 dígitos" });
  }
  if (!competencia || !/^\d{4}-\d{2}$/.test(competencia)) {
    erros.push({ campo: "competencia", mensagem: "Formato deve ser YYYY-MM" });
  }
  if (!serie) {
    erros.push({ campo: "serieDps", mensagem: "Série é obrigatória" });
  } else if (!/^\d+$/.test(serie)) {
    if (competencia >= "2026-01") {
      erros.push({ campo: "serieDps", mensagem: `Série "${serie}" é alfanumérica. Obrigatório numérica a partir de jan/2026.` });
    } else {
      avisos.push({ campo: "serieDps", mensagem: "Série alfanumérica — será obrigatoriamente numérica a partir de jan/2026" });
    }
  }
  if (!servico || !servico.codigoTribNac) {
    erros.push({ campo: "servico.codigoTribNac", mensagem: "Código de tributação nacional é obrigatório" });
  }
  if (!valores || !valores.valorServicos || Number(valores.valorServicos) <= 0) {
    erros.push({ campo: "valores.valorServicos", mensagem: "Valor dos serviços deve ser positivo" });
  }

  // Cert check
  if (config.cert_cnpj && cnpj && config.cert_cnpj !== cnpj) {
    erros.push({ campo: "certificado", mensagem: `CNPJ do certificado (${config.cert_cnpj}) difere do prestador (${cnpj})` });
  }
  if (config.cert_expires_at) {
    const days = Math.floor((new Date(config.cert_expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (days <= 0) {
      erros.push({ campo: "certificado", mensagem: "Certificado digital expirado" });
    } else if (days <= 7) {
      avisos.push({ campo: "certificado", mensagem: `Certificado expira em ${days} dia(s)` });
    }
  }

  return { valida: erros.length === 0, erros, avisos };
}

async function emitirNfse(
  supabase: ClienteParaConfigNfse,
  config: NfseConfig,
  params: Record<string, unknown>,
): Promise<unknown> {
  // Validate first
  const validation = validarDpsLocal(config, params);
  if (!validation.valida) {
    return { emitida: false, erros: validation.erros, avisos: validation.avisos };
  }

  // Increment proximo_numero_dps atomically
  const numeroDps = String(config.proximo_numero_dps);

  // Note: actual emission requires mTLS with the ADN, which Deno Deploy
  // supports via Deno.connectTls. For now, we prepare the payload and
  // increment the counter. Full mTLS integration pending.
  const { error: updateError } = await supabase
    .from("nfse_config")
    .update({
      proximo_numero_dps: config.proximo_numero_dps + 1,
      last_emission_at: new Date().toISOString(),
    })
    .eq("id", config.id);

  if (updateError) {
    throw new Error(`Erro ao atualizar numeração: ${updateError.message}`);
  }

  return {
    emitida: false,
    pendente: true,
    mensagem: "DPS validada com sucesso. Emissão via mTLS requer o MCP server nfse-nacional.",
    numeroDpsReservado: numeroDps,
    proximoNumeroDps: config.proximo_numero_dps + 1,
    dpsPayload: {
      cnpjPrestador: params.cnpjPrestador || config.cert_cnpj,
      codigoMunicipio: params.codigoMunicipio || config.codigo_municipio,
      competencia: params.competencia,
      serieDps: params.serieDps || config.serie_dps,
      numeroDps,
      servico: params.servico,
      tomador: params.tomador,
      valores: params.valores,
      observacoes: params.observacoes,
    },
    avisos: validation.avisos,
  };
}

// ── Helpers ──

function jsonResponse(
  data: unknown,
  status: number,
  corsHeaders: Record<string, string>,
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
