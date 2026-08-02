/**
 * Executor do catálogo de configuração: salvar, testar e ler status.
 *
 * Usa EXATAMENTE os mesmos contratos das telas dedicadas (mesmas RPCs do Vault,
 * mesmas tabelas, mesmas edge functions de teste) — o wizard é outro caminho
 * para a mesma configuração, nunca uma segunda régua. Segredo de verdade vai
 * para o Vault via RPC; o resto vai na tabela de config da integração.
 */

import { supabase } from "@/integrations/supabase/client";

export interface ResultadoAcao {
  ok: boolean;
  mensagem: string;
}

type Valores = Record<string, string>;

/* ------------------------------------------------------------------ */
/* Salvar                                                              */
/* ------------------------------------------------------------------ */

export async function salvarIntegracao(
  id: string,
  companyId: string,
  v: Valores,
): Promise<ResultadoAcao> {
  try {
    switch (id) {
      case "openfinance": {
        const { error } = await supabase.rpc("set_pluggy_credentials", {
          p_company_id: companyId,
          p_client_id: v.client_id ?? "",
          p_client_secret: v.client_secret ?? "",
        });
        if (error) throw error;
        // O ambiente mora na tabela de config, não no cofre.
        await supabase
          .from("openfinance_config")
          .update({ sandbox: v.sandbox !== "false" })
          .eq("company_id", companyId)
          .eq("provider", "pluggy");
        return { ok: true, mensagem: "Credenciais da Pluggy guardadas no cofre." };
      }

      case "asaas": {
        const producao = (v.environment ?? "sandbox") === "production";
        const base = {
          company_id: companyId,
          environment: v.environment ?? "sandbox",
          notification_email: v.notification_email || null,
        };
        const payload = producao
          ? { ...base, api_key_production: v.api_key || null }
          : { ...base, api_key_sandbox: v.api_key || null };
        const { error } = await supabase
          .from("company_asaas_config")
          .upsert(payload, { onConflict: "company_id" });
        if (error) throw error;
        return { ok: true, mensagem: `Chave do Asaas salva no ambiente de ${producao ? "produção" : "sandbox"}.` };
      }

      case "stripe": {
        // A secret e o segredo do webhook vão para o cofre; modo e chave
        // publicável ficam na tabela porque não são segredo e a tela precisa deles.
        // O apelido é a identidade do canal: reenviar o mesmo apelido edita o
        // canal existente, um apelido novo cria outro canal na mesma empresa.
        const apelido = (v.apelido ?? "").trim() || "Principal";
        const { error } = await supabase.rpc("set_stripe_credentials", {
          p_company_id: companyId,
          p_secret_key: v.secret_key ?? "",
          p_webhook_secret: v.webhook_secret ?? "",
          p_publishable_key: v.publishable_key ?? "",
          p_mode: v.mode === "live" ? "live" : "test",
          p_apelido: apelido,
        });
        if (error) throw error;
        const aviso = v.webhook_secret
          ? ""
          : " Falta o segredo do webhook: sem ele o recebimento não baixa sozinho.";
        return { ok: true, mensagem: `Canal "${apelido}" guardado no cofre.${aviso}` };
      }

      case "inter": {
        const { error } = await supabase.from("inter_config").upsert(
          {
            company_id: companyId,
            client_id: v.client_id || undefined,
            client_secret: v.client_secret || undefined,
            account_number: v.account_number || null,
            environment: v.environment ?? "sandbox",
          },
          { onConflict: "company_id" },
        );
        if (error) throw error;
        return { ok: true, mensagem: "Credenciais do Inter salvas. O certificado sobe na tela do Inter." };
      }

      case "whatsapp": {
        // Conflito por (empresa, instância): uma empresa tem N canais, e o que
        // identifica cada um é o nome da instância. Antes o conflito era só por
        // company_id — constraint que nem existia, então o salvamento falhava
        // com 42P10 e a integração não gravava nunca.
        const instancia = v.instance_name || "financeai";
        const { error } = await supabase.from("whatsapp_configs").upsert(
          {
            company_id: companyId,
            evolution_api_url: v.evolution_api_url || null,
            evolution_api_key: v.evolution_api_key || null,
            instance_name: instancia,
            notify_number: (v.notify_number ?? "").replace(/\D/g, "") || null,
            active: true,
          },
          { onConflict: "company_id,instance_name" },
        );
        if (error) throw error;
        return {
          ok: true,
          mensagem: `Canal "${instancia}" salvo. Leia o QR Code em Inteligência → WhatsApp.`,
        };
      }

      case "contaazul": {
        const { error } = await supabase.rpc("set_contaazul_credentials", {
          p_company_id: companyId,
          p_client_id: v.client_id ?? "",
          p_client_secret: v.client_secret ?? "",
          p_refresh_token: v.refresh_token ?? "",
        });
        if (error) throw error;
        return { ok: true, mensagem: "Credenciais do Conta Azul guardadas no cofre." };
      }

      case "plugnotas": {
        const { error } = await supabase.from("plugnotas_config").upsert(
          {
            company_id: companyId,
            api_key: v.api_key || undefined,
            environment: v.environment ?? "sandbox",
            serie_padrao: v.serie_padrao || "1",
            active: true,
          },
          { onConflict: "company_id" },
        );
        if (error) throw error;
        return { ok: true, mensagem: "API key do PlugNotas salva." };
      }

      case "focus": {
        const ambiente = v.environment ?? "homologacao";
        const { error } = await supabase.rpc("set_focus_token", {
          p_company_id: companyId,
          p_environment: ambiente,
          p_token: v.token ?? "",
        });
        if (error) throw error;
        await supabase
          .from("focus_config")
          .update({ environment: ambiente, active: true })
          .eq("company_id", companyId);
        return { ok: true, mensagem: `Token da Focus (${ambiente}) guardado no cofre.` };
      }

      case "nfse": {
        // O arquivo chega já em base64 (sem o prefixo data:).
        const { error } = await supabase.from("nfse_config").upsert(
          {
            company_id: companyId,
            ambiente: v.ambiente ?? "homologacao",
            inscricao_municipal: v.inscricao_municipal || null,
            active: true,
            cert_pfx_base64: v.cert_pfx || undefined,
            cert_password: v.cert_password || undefined,
          },
          { onConflict: "company_id" },
        );
        if (error) throw error;
        return { ok: true, mensagem: "Certificado e dados da NFS-e salvos." };
      }

      default:
        return { ok: false, mensagem: "Integração desconhecida." };
    }
  } catch (e) {
    return { ok: false, mensagem: (e as Error).message || "Não foi possível salvar." };
  }
}

/* ------------------------------------------------------------------ */
/* Testar conexão                                                      */
/* ------------------------------------------------------------------ */

/** Cada provedor tem o seu contrato de teste — os mesmos das telas dedicadas. */
export async function testarIntegracao(id: string, companyId: string): Promise<ResultadoAcao> {
  const chamadas: Record<string, { fn: string; body: Record<string, unknown> }> = {
    openfinance: { fn: "openfinance-connect", body: { action: "status", company_id: companyId } },
    asaas: { fn: "company-asaas-api", body: { action: "test-connection", company_id: companyId } },
    stripe: { fn: "stripe-api", body: { action: "testar", company_id: companyId } },
    inter: { fn: "inter-banking", body: { action: "test", company_id: companyId } },
    contaazul: { fn: "contaazul-import", body: { action: "test", company_id: companyId } },
    plugnotas: { fn: "plugnotas-status", body: { company_id: companyId, operation: "ping" } },
    // A Focus usa companyId em camelCase (contrato da própria função).
    focus: { fn: "focus-nfe", body: { action: "test", companyId } },
    nfse: { fn: "nfse-operations", body: { company_id: companyId, operation: "parse_cert" } },
  };

  if (id === "whatsapp") return testarWhatsapp(companyId);

  const chamada = chamadas[id];
  if (!chamada) return { ok: false, mensagem: "Esta integração não tem teste automático." };

  try {
    const { data, error } = await supabase.functions.invoke(chamada.fn, { body: chamada.body });
    if (error) throw error;
    const resposta = data as Record<string, unknown> | null;
    if (resposta && resposta.error) {
      return { ok: false, mensagem: String(resposta.detalhe ?? resposta.error) };
    }
    // openfinance-connect responde status sem "ok": configured diz a verdade.
    if (id === "openfinance" && resposta && resposta.configured === false) {
      return { ok: false, mensagem: "As credenciais não foram aceitas pela Pluggy." };
    }
    return { ok: true, mensagem: "Conexão bem-sucedida." };
  } catch (e) {
    return { ok: false, mensagem: (e as Error).message || "A conexão falhou." };
  }
}

async function testarWhatsapp(companyId: string): Promise<ResultadoAcao> {
  try {
    // Com N canais, maybeSingle() sem limite estoura ("multiple rows"). A
    // central testa o primeiro canal; a tela dedicada testa um a um.
    const { data: config, error } = await supabase
      .from("whatsapp_configs")
      .select("id, instance_name")
      .eq("company_id", companyId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!config) return { ok: false, mensagem: "Salve a configuração antes de testar." };

    const { data, error: fnErr } = await supabase.functions.invoke(
      `evolution-proxy/${config.id}/instance/connectionState/${config.instance_name}`,
      { method: "GET" },
    );
    if (fnErr) throw fnErr;
    const estado = (data as { instance?: { state?: string } })?.instance?.state;
    if (estado === "open") return { ok: true, mensagem: "Servidor respondeu e o número está conectado." };
    return {
      ok: true,
      mensagem: `Servidor respondeu (estado: ${estado ?? "desconhecido"}). Leia o QR Code em Inteligência → WhatsApp para conectar o número.`,
    };
  } catch (e) {
    return { ok: false, mensagem: (e as Error).message || "O servidor Evolution não respondeu." };
  }
}

/* ------------------------------------------------------------------ */
/* Status: o que já está configurado                                   */
/* ------------------------------------------------------------------ */

/** Ids das integrações que já têm credencial gravada para esta empresa. */
export async function carregarConfiguradas(companyId: string): Promise<string[]> {
  const checagens: Array<[string, () => Promise<boolean>]> = [
    ["openfinance", async () => {
      const { data } = await supabase.from("openfinance_config").select("client_id_preview")
        .eq("company_id", companyId).not("client_id_preview", "is", null).maybeSingle();
      return !!data;
    }],
    ["asaas", async () => {
      const { data } = await supabase.from("company_asaas_config").select("api_key_sandbox, api_key_production")
        .eq("company_id", companyId).maybeSingle();
      return !!(data?.api_key_sandbox || data?.api_key_production);
    }],
    ["inter", async () => {
      const { data } = await supabase.from("inter_config").select("client_id")
        .eq("company_id", companyId).not("client_id", "is", null).maybeSingle();
      return !!data;
    }],
    ["stripe", async () => {
      // A chave vive no Vault; o que a tela pode ver é o preview gravado ao salvar.
      const { data } = await supabase.from("stripe_config").select("secret_key_preview")
        .eq("company_id", companyId).not("secret_key_preview", "is", null).maybeSingle();
      return !!data;
    }],
    ["whatsapp", async () => {
      // Basta UM canal configurado. Sem o limit, duas instâncias fariam o
      // maybeSingle() falhar e a integração apareceria como não configurada
      // justamente na empresa que tem mais canais.
      const { data } = await supabase.from("whatsapp_configs").select("evolution_api_url")
        .eq("company_id", companyId).not("evolution_api_url", "is", null)
        .limit(1).maybeSingle();
      return !!data;
    }],
    ["contaazul", async () => {
      const { data } = await supabase.from("contaazul_config").select("client_id_preview")
        .eq("company_id", companyId).not("client_id_preview", "is", null).maybeSingle();
      return !!data;
    }],
    ["plugnotas", async () => {
      const { data } = await supabase.from("plugnotas_config").select("api_key")
        .eq("company_id", companyId).not("api_key", "is", null).maybeSingle();
      return !!data;
    }],
    ["focus", async () => {
      const { data } = await supabase.from("focus_config").select("token_homologacao_preview, token_producao_preview")
        .eq("company_id", companyId).maybeSingle();
      return !!(data?.token_homologacao_preview || data?.token_producao_preview);
    }],
    ["nfse", async () => {
      const { data } = await supabase.from("nfse_config").select("cert_pfx_base64")
        .eq("company_id", companyId).not("cert_pfx_base64", "is", null).maybeSingle();
      return !!data;
    }],
  ];

  const resultados = await Promise.allSettled(checagens.map(([, checar]) => checar()));
  return checagens
    .filter((_, idx) => {
      const r = resultados[idx];
      return r.status === "fulfilled" && r.value;
    })
    .map(([id]) => id);
}

/**
 * Ids que esta função sabe detectar como "já configurado".
 *
 * Existe para o teste travar o drift que já aconteceu: o Stripe entrou no
 * catálogo e ninguém acrescentou a checagem aqui, então ele apareceria como
 * "não configurado" para sempre, mesmo depois de salvo — e o progresso da
 * plataforma nunca chegaria a 100%.
 */
export const IDS_COM_DETECCAO = [
  "openfinance", "asaas", "inter", "stripe", "whatsapp",
  "contaazul", "plugnotas", "focus", "nfse",
] as const;

/** Lê o arquivo e devolve só o base64 (sem o prefixo data:...). */
export function arquivoParaBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const resultado = String(reader.result ?? "");
      resolve(resultado.includes(",") ? resultado.split(",")[1] : resultado);
    };
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
    reader.readAsDataURL(file);
  });
}
