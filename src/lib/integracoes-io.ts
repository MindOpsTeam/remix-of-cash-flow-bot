/**
 * Executor do catálogo de configuração: salvar, testar e ler status.
 *
 * Usa EXATAMENTE os mesmos contratos das telas dedicadas (mesmas RPCs do Vault,
 * mesmas tabelas, mesmas edge functions de teste) — o wizard é outro caminho
 * para a mesma configuração, nunca uma segunda régua. Segredo de verdade vai
 * para o Vault via RPC; o resto vai na tabela de config da integração.
 */

import { supabase } from "@/integrations/supabase/client";
import { mensagemDaEdge, mensagemDoCorpo } from "@/lib/edge-erro";

export interface ResultadoAcao {
  ok: boolean;
  mensagem: string;
}

type Valores = Record<string, string>;

/* ------------------------------------------------------------------ */

/**
 * Grava uma credencial no Vault (migration 20260819180000).
 * As colunas de segredo das tabelas de config foram esvaziadas e o SELECT
 * delas é revogado do cliente: o valor NUNCA volta para o navegador.
 */
async function gravarSegredo(
  companyId: string,
  provider: string,
  campo: string,
  valor: string | undefined,
): Promise<void> {
  const { error } = await supabase.rpc("set_integration_secret", {
    p_company_id: companyId,
    p_provider: provider,
    p_campo: campo,
    p_valor: valor ?? "",
  });
  if (error) throw error;
}

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
        const { error } = await supabase
          .from("company_asaas_config")
          .upsert(base, { onConflict: "company_id" });
        if (error) throw error;
        await gravarSegredo(
          companyId, "asaas",
          producao ? "api_key_production" : "api_key_sandbox", v.api_key,
        );

        // O token do webhook vive no COFRE, porque é lá que a edge
        // company-asaas-webhook procura ao autenticar cada evento. A tela
        // dedicada gravava na coluna: o Asaas enviava e nós recusávamos tudo,
        // com a cobrança paga lá e o título em aberto aqui.
        if (v.webhook_auth_token?.trim()) {
          await gravarSegredo(companyId, "asaas", "webhook_auth_token", v.webhook_auth_token.trim());
        }

        const semWebhook = v.webhook_auth_token?.trim()
          ? ""
          : " Falta o token do webhook: sem ele o recebimento não baixa sozinho.";
        return {
          ok: true,
          mensagem: `Chave do Asaas salva no ambiente de ${producao ? "produção" : "sandbox"}.${semWebhook}`,
        };
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
            account_number: v.account_number || null,
            environment: v.environment ?? "sandbox",
          },
          { onConflict: "company_id" },
        );
        if (error) throw error;
        await gravarSegredo(companyId, "inter", "client_secret", v.client_secret);
        return { ok: true, mensagem: "Credenciais do Inter salvas. O certificado sobe na tela do Inter." };
      }

      case "whatsapp": {
        // Conflito por (empresa, instância): uma empresa tem N canais, e o que
        // identifica cada um é o nome da instância. Antes o conflito era só por
        // company_id — constraint que nem existia, então o salvamento falhava
        // com 42P10 e a integração não gravava nunca.
        const instancia = v.instance_name || "financeai";
        const { data: linha, error } = await supabase
          .from("whatsapp_configs")
          .upsert(
            {
              company_id: companyId,
              evolution_api_url: v.evolution_api_url || null,
              instance_name: instancia,
              notify_number: (v.notify_number ?? "").replace(/\D/g, "") || null,
              active: true,
            },
            { onConflict: "company_id,instance_name" },
          )
          .select("id")
          .single();
        if (error) throw error;
        await gravarSegredo(companyId, "evolution", "api_key", v.evolution_api_key);

        // O guia promete que o sistema cria a instância. Antes, o salvar só
        // gravava a config: quem seguia o passo a passo ia ler o QR Code e
        // esbarrava numa instância que não existia no servidor. Promessa que o
        // código não cumpre é defeito, não detalhe.
        const criacao = await criarInstanciaEvolution(linha.id, instancia);
        return { ok: true, mensagem: `Canal "${instancia}" salvo. ${criacao}` };
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

      case "gcp": {
        // credencial de plataforma: vai inteira para o cofre, nada em tabela
        await gravarSegredo(companyId, "gcp", "service_account", v.service_account);
        await gravarSegredo(companyId, "gcp", "project_id", v.project_id);
        return {
          ok: true,
          mensagem: "Motor de previsão ligado. As próximas projeções usam o TimesFM.",
        };
      }

      case "plugnotas": {
        const { error } = await supabase.from("plugnotas_config").upsert(
          {
            company_id: companyId,
            environment: v.environment ?? "sandbox",
            serie_padrao: v.serie_padrao || "1",
            active: true,
          },
          { onConflict: "company_id" },
        );
        if (error) throw error;
        await gravarSegredo(companyId, "plugnotas", "api_key", v.api_key);
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
            nfse_via: "worker_proprio",
            worker_url: v.worker_url?.trim() || null,
            worker_api_key: v.worker_api_key?.trim() || null,
            ambiente: v.ambiente ?? "homologacao",
            inscricao_municipal: v.inscricao_municipal || null,
            active: true,
            cert_pfx_base64: v.cert_pfx_base64 || undefined,
            cert_password: v.cert_password || undefined,
          },
          { onConflict: "company_id" },
        );
        if (error) throw error;
        return { ok: true, mensagem: "Certificado e dados da NFS-e salvos." };
      }

      case "certificado": {
        // O DEFEITO QUE ISTO CONSERTA: não existia case algum. O admin escolhia
        // o .pfx, digitava a senha, clicava em Salvar e recebia "Integração
        // desconhecida" — ou seja, o certificado não ia para lugar nenhum, e ele
        // só descobria na primeira emissão, quando a nota não assinava.
        //
        // Grava na MESMA tabela que a via NFS-e usa: certificado é um só por
        // empresa, e duas tabelas para a mesma coisa é como uma delas fica para
        // trás. `cert_cnpj` é deixado nulo de propósito: quem preenche é a edge
        // ao abrir o arquivo com a senha, e é justamente isso que prova que o
        // par arquivo/senha está certo.
        if (!v.cert_pfx_base64?.trim()) {
          return { ok: false, mensagem: "Escolha o arquivo .pfx do certificado." };
        }
        if (!v.cert_password?.trim()) {
          return { ok: false, mensagem: "Informe a senha do certificado." };
        }
        const { error } = await supabase.from("nfse_config").upsert(
          {
            company_id: companyId,
            cert_pfx_base64: v.cert_pfx_base64,
            cert_password: v.cert_password,
            // Trocar o arquivo invalida o que foi lido do anterior.
            cert_cnpj: null,
            cert_razao_social: null,
            cert_expires_at: null,
          },
          { onConflict: "company_id" },
        );
        if (error) throw error;
        return {
          ok: true,
          mensagem: "Certificado guardado. Clique em Testar conexão para confirmar que a senha abre o arquivo.",
        };
      }

      default:
        return { ok: false, mensagem: "Integração desconhecida." };
    }
  } catch (e) {
    return { ok: false, mensagem: (e as Error).message || "Não foi possível salvar." };
  }
}

/**
 * Cria a instância no servidor Evolution, se ainda não existir.
 *
 * Tolerante de propósito: a config já foi salva quando chegamos aqui, e derrubar
 * o salvamento porque o servidor do provedor está fora do ar seria trocar um
 * problema pequeno (criar a instância depois) por um grande (perder a
 * configuração inteira). Devolve a frase que explica o que aconteceu.
 */
async function criarInstanciaEvolution(configId: string, instancia: string): Promise<string> {
  try {
    const { error } = await supabase.functions.invoke(`evolution-proxy/${configId}/instance/create`, {
      body: {
        instanceName: instancia,
        integration: "WHATSAPP-BAILEYS",
        qrcode: true,
      },
    });
    if (!error) return "Instância criada no seu servidor. Leia o QR Code em Inteligência → WhatsApp.";

    const m = await mensagemDaEdge(error, "");
    // A Evolution devolve 403 quando a instância já existe. Não é falha: é o
    // caso de quem já tinha criado no painel do provedor, que o guia manda usar.
    if (/already in use|already exists|403/i.test(m)) {
      return "A instância já existia no seu servidor e foi reaproveitada. Leia o QR Code em Inteligência → WhatsApp.";
    }
    return `A configuração foi salva, mas não consegui criar a instância no servidor: ${m || "o servidor não respondeu"}. Confira a URL e a chave e salve de novo.`;
  } catch {
    return "A configuração foi salva, mas o servidor Evolution não respondeu. Confira a URL e a chave e salve de novo.";
  }
}

/* ------------------------------------------------------------------ */
/* Testar conexão                                                      */
/* ------------------------------------------------------------------ */

/** Cada provedor tem o seu contrato de teste — os mesmos das telas dedicadas. */
export async function testarIntegracao(
  id: string,
  companyId: string,
  /** Nome da instância que está na tela. Sem isto o WhatsApp testava o canal
   *  MAIS ANTIGO da empresa, não o que a pessoa acabou de salvar. */
  instanceName?: string,
): Promise<ResultadoAcao> {
  const chamadas: Record<string, { fn: string; body: Record<string, unknown> }> = {
    openfinance: { fn: "openfinance-connect", body: { action: "status", company_id: companyId } },
    asaas: { fn: "company-asaas-api", body: { action: "test-connection", company_id: companyId } },
    stripe: { fn: "stripe-api", body: { action: "testar", company_id: companyId } },
    inter: { fn: "inter-banking", body: { action: "test", company_id: companyId } },
    contaazul: { fn: "contaazul-import", body: { action: "test", company_id: companyId } },
    plugnotas: { fn: "plugnotas-status", body: { company_id: companyId, operation: "ping" } },
    // A Focus usa companyId em camelCase (contrato da própria função).
    focus: { fn: "focus-nfe", body: { action: "test", companyId } },
    // O GCP prometia botão de testar e não tinha chamada nenhuma: o admin
    // colava o JSON e só descobria o erro dias depois, vendo a projeção
    // continuar na média em vez do TimesFM.
    gcp: { fn: "gcp-test", body: { company_id: companyId } },
    // "status" existe na edge e devolve CNPJ, razão social e validade do
    // certificado. O antigo "parse_cert" não existia no switch e, como a função
    // não tinha default, respondia 200 com data indefinido: o teste dizia
    // "conexão bem-sucedida" sem ter testado coisa nenhuma.
    nfse: { fn: "nfse-operations", body: { company_id: companyId, operation: "status" } },
    certificado: { fn: "nfse-operations", body: { company_id: companyId, operation: "status" } },
  };

  if (id === "whatsapp") return testarWhatsapp(companyId, instanceName);

  const chamada = chamadas[id];
  if (!chamada) return { ok: false, mensagem: "Esta integração não tem teste automático." };

  try {
    const { data, error } = await supabase.functions.invoke(chamada.fn, { body: chamada.body });
    // A mensagem útil vive no CORPO da resposta, não no erro que o supabase-js
    // levanta. Sem esta leitura, todo 400 vira "non-2xx status code" na tela.
    if (error) return { ok: false, mensagem: await mensagemDaEdge(error, "A conexão falhou.") };

    const resposta = data as Record<string, unknown> | null;
    const doCorpo = mensagemDoCorpo(resposta);
    if (doCorpo) return { ok: false, mensagem: doCorpo };

    // openfinance-connect responde status sem "ok": configured diz a verdade.
    if (id === "openfinance" && resposta && resposta.configured === false) {
      return { ok: false, mensagem: "As credenciais não foram aceitas pela Pluggy." };
    }
    return { ok: true, mensagem: fraseDeSucesso(id, resposta) };
  } catch (e) {
    return { ok: false, mensagem: await mensagemDaEdge(e, "A conexão falhou.") };
  }
}

/**
 * "Conexão bem-sucedida" não prova nada. Quando a resposta traz um fato
 * verificável (o CNPJ lido do certificado, o saldo da conta), é ele que vai
 * para a tela: é a diferença entre o admin acreditar e o admin conferir.
 */
function fraseDeSucesso(id: string, resposta: Record<string, unknown> | null): string {
  if (!resposta) return "Conexão bem-sucedida.";

  if (id === "certificado" || id === "nfse") {
    const dados = (resposta.data ?? resposta) as Record<string, unknown>;
    const cert = dados?.certificado as Record<string, unknown> | undefined;
    if (cert?.cnpj) {
      const dias = typeof cert.diasRestantes === "number" ? cert.diasRestantes : null;
      const validade = cert.expiraEm ? String(cert.expiraEm).slice(0, 10).split("-").reverse().join("/") : null;
      const prazo = validade
        ? ` Válido até ${validade}${dias !== null ? ` (${dias} dias)` : ""}.`
        : "";
      return `Certificado lido: CNPJ ${cert.cnpj}.${prazo}`;
    }
    return "Configuração encontrada, mas o certificado ainda não foi lido. Envie o arquivo .pfx e a senha.";
  }

  if (id === "gcp" && typeof resposta.mensagem === "string") {
    return resposta.mensagem;
  }

  if (id === "stripe" && typeof resposta.modo === "string") {
    return `Conectado no modo ${resposta.modo === "live" ? "produção" : "teste"}.`;
  }

  return "Conexão bem-sucedida.";
}

async function testarWhatsapp(companyId: string, instanceName?: string): Promise<ResultadoAcao> {
  try {
    // Testa o canal que está NA TELA. Antes pegava o mais antigo da empresa:
    // quem tem dois canais salvava um e testava outro, e o erro não fazia
    // sentido nenhum para quem estava olhando.
    let q = supabase
      .from("whatsapp_configs")
      .select("id, instance_name")
      .eq("company_id", companyId);
    if (instanceName?.trim()) q = q.eq("instance_name", instanceName.trim());

    const { data: linhas, error } = await q.order("created_at", { ascending: false }).limit(1);
    if (error) throw error;
    const config = (linhas ?? [])[0];
    if (!config) {
      return {
        ok: false,
        mensagem: instanceName?.trim()
          ? `Não encontrei o canal "${instanceName.trim()}" salvo nesta empresa. Salve a configuração antes de testar.`
          : "Salve a configuração antes de testar.",
      };
    }

    const { data, error: fnErr } = await supabase.functions.invoke(
      `evolution-proxy/${config.id}/instance/connectionState/${config.instance_name}`,
      { method: "GET" },
    );
    if (fnErr) {
      const m = await mensagemDaEdge(fnErr, "O servidor Evolution não respondeu.");
      // 404 da Evolution significa instância inexistente NO SERVIDOR, não erro
      // de credencial. Sem dizer isso, o admin fica trocando a chave à toa.
      if (/not found|does not exist|404/i.test(m)) {
        return {
          ok: false,
          mensagem: `O servidor respondeu, mas não existe instância chamada "${config.instance_name}" nele. Confira o nome no painel do provedor ou salve de novo para criá-la.`,
        };
      }
      return { ok: false, mensagem: m };
    }

    const estado = (data as { instance?: { state?: string }; state?: string })?.instance?.state
      ?? (data as { state?: string })?.state;
    if (estado === "open") return { ok: true, mensagem: `Servidor respondeu e o número do canal "${config.instance_name}" está conectado.` };
    return {
      ok: true,
      mensagem: `Servidor respondeu (estado: ${estado ?? "desconhecido"}). Leia o QR Code em Inteligência → WhatsApp para conectar o número.`,
    };
  } catch (e) {
    return { ok: false, mensagem: await mensagemDaEdge(e, "O servidor Evolution não respondeu.") };
  }
}

/* ------------------------------------------------------------------ */
/* Status: o que já está configurado                                   */
/* ------------------------------------------------------------------ */

/** Ids das integrações que já têm credencial gravada para esta empresa. */
export async function carregarConfiguradas(companyId: string): Promise<string[]> {

/**
 * "A integração tem credencial?" respondido pelo cofre.
 * `integration_secrets_status` devolve apenas provider/campo/booleano: o valor
 * do segredo nunca chega ao navegador.
 */
async function temSegredo(
  companyId: string,
  provider: string,
  campos: string[],
): Promise<boolean> {
  const { data, error } = await supabase.rpc("integration_secrets_status", {
    p_company_id: companyId,
  });
  if (error) return false;
  const linhas = (data ?? []) as Array<{ provider: string; campo: string }>;
  return linhas.some((l) => l.provider === provider && campos.includes(l.campo));
}

  const checagens: Array<[string, () => Promise<boolean>]> = [
    ["openfinance", async () => {
      const { data } = await supabase.from("openfinance_config").select("client_id_preview")
        .eq("company_id", companyId).not("client_id_preview", "is", null).maybeSingle();
      return !!data;
    }],
    ["asaas", async () => {
      // a chave vive no Vault: o status vem de booleanos, nunca do valor
      return await temSegredo(companyId, "asaas", ["api_key_sandbox", "api_key_production"]);
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
      return await temSegredo(companyId, "plugnotas", ["api_key"]);
    }],
    ["focus", async () => {
      const { data } = await supabase.from("focus_config").select("token_homologacao_preview, token_producao_preview")
        .eq("company_id", companyId).maybeSingle();
      return !!(data?.token_homologacao_preview || data?.token_producao_preview);
    }],
    ["gcp", async () => {
      // a chave do Google vive no cofre: status por booleano, nunca pelo valor
      return await temSegredo(companyId, "gcp", ["service_account"]);
    }],
    ["certificado", async () => {
      // cert_cnpj não é segredo e só existe quando o .pfx foi aberto com a
      // senha certa: é a prova de que o certificado está válido e legível
      const { data } = await supabase.from("nfse_config").select("cert_cnpj")
        .eq("company_id", companyId).not("cert_cnpj", "is", null).maybeSingle();
      return !!data;
    }],
    ["nfse", async () => {
      // cert_cnpj (não-secreto) indica que há certificado; as colunas do .pfx/senha
      // não são mais legíveis pelo cliente (REVOKE de SELECT).
      const { data } = await supabase.from("nfse_config").select("cert_cnpj")
        .eq("company_id", companyId).not("cert_cnpj", "is", null).maybeSingle();
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
  "contaazul", "plugnotas", "focus", "nfse", "gcp", "certificado",
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
