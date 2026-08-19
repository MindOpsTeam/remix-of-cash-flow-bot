import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";

// Fallback global (modelo antigo, single-tenant). No modelo de remix distribuído,
// cada EMPRESA aponta para o SEU worker via nfse_config.worker_url / worker_api_key
// (preenchidos na tela de Integrações). O env só entra se a config não trouxer nada,
// mantendo compatibilidade com instalações que ainda usam um worker único.
// worker por empresa em nfse_config.worker_url / worker_api_key.
// Sem fallback de env: a leitura faria o Lovable pedir a chave no remix.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { operation, companyId, data } = body;

    if (!companyId) {
      return new Response(JSON.stringify({ error: "companyId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load nfse_config for the company
    const { data: config, error: configError } = await supabase
      .from("nfse_config")
      .select("*")
      .eq("company_id", companyId)
      .maybeSingle();

    if (configError || !config) {
      return new Response(JSON.stringify({ error: "NFS-e nao configurada para esta empresa" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!config.active) {
      return new Response(JSON.stringify({ error: "Integracao NFS-e desativada" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Segredos (certificado A1 + senha + chave do worker) ficam ILEGÍVEIS para os
    // membros via RLS (REVOKE de SELECT nas colunas). Os edges os leem por um RPC
    // SECURITY DEFINER, com service_role — o cert nunca trafega para o navegador.
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data: secrets } = await admin.rpc("get_nfse_secrets", { p_company_id: companyId });
    const certBase64 = (secrets as { cert_pfx_base64?: string } | null)?.cert_pfx_base64 ?? null;
    const certPassword = (secrets as { cert_password?: string } | null)?.cert_password ?? null;
    const workerApiKey = (secrets as { worker_api_key?: string } | null)?.worker_api_key ?? null;

    // Resolve o worker DESTA empresa (multi-tenant): config primeiro, env como fallback.
    // Cada remix roda o próprio worker — o certificado nunca sai do ambiente do cliente.
    const workerUrl = (config.worker_url?.trim() || "").replace(/\/+$/, "");
    const workerKey = workerApiKey?.trim() || "";
    if (!workerUrl) {
      return new Response(
        JSON.stringify({
          error:
            "Servidor de emissao nao configurado. Em Configuracoes > NFS-e, informe a URL do seu worker (via 'servidor proprio') ou use a via provedor.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Route to worker
    let workerPath = "/health";
    let workerBody: Record<string, unknown> = {};

    // Chave de idempotência: o app pode mandar a sua; senão compomos uma
    // determinística. Antes de reservar número e transmitir, checamos se já
    // existe uma nota com essa chave — evita nota duplicada em retry/timeout.
    // Só deduplica quando há uma chave REAL: idempotencyKey explícita do app OU um
    // pedido de venda. Emissão avulsa sem chave NÃO é deduplicada por valor — duas
    // notas legítimas de mesmo valor/competência não podem se bloquear (achado H1).
    const salesOrderId = (body.salesOrderId as string | undefined)?.trim() || null;
    const idempotencyKey = (body.idempotencyKey as string | undefined)?.trim() ||
      (salesOrderId
        ? [companyId, data?.competencia ?? "", salesOrderId, String((data?.valores as any)?.valorServicos ?? "")].join(":")
        : null);

    // Hoisted para o bloco pós-worker (persistência) enxergar após a emissão.
    let numeroDps: number | null = null;
    let claimId: string | null = null;

    if (operation === "emit" || operation === "cancel") {
      // Emissão e cancelamento são escrita fiscal REAL no SEFIN: perfil
      // somente-leitura não pode (achado H7).
      const { data: membership } = await supabase
        .from("company_members").select("role").eq("company_id", companyId).eq("user_id", user.id).maybeSingle();
      if (!membership || membership.role === "viewer") {
        return new Response(JSON.stringify({ error: "Sem permissão para esta operação fiscal (perfil somente leitura)." }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    if (operation === "emit") {
      // Reserva atômica do número da DPS via o `admin` (service_role) já criado acima.

      // Claim-first: antes de transmitir, "reserva" a nota como rascunho ligado à
      // idempotency_key. O índice único (company_id, idempotency_key) garante que
      // duas tentativas concorrentes — ou um retry após timeout — não transmitam a
      // MESMA nota duas vezes ao SEFIN: a 2ª esbarra no rascunho já existente.
      if (idempotencyKey) {
        const { data: claim, error: claimErr } = await supabase.from("invoices").insert({
          company_id: companyId,
          type: "nfse",
          status: "draft",
          issue_date: new Date().toISOString().split("T")[0],
          total: data?.valores?.valorServicos || 0,
          contact_id: (body.contactId as string | undefined) ?? null,
          sales_order_id: salesOrderId,
          idempotency_key: idempotencyKey,
        }).select("id").single();

        if (claimErr) {
          // Já existe nota com essa idempotency_key: autorizada → devolve; em
          // rascunho (tentativa em voo/timeout anterior) → NÃO retransmite.
          const { data: existing } = await supabase.from("invoices")
            .select("id, number, chave_acesso, status, nfse_xml")
            .eq("company_id", companyId).eq("idempotency_key", idempotencyKey).maybeSingle();
          if (existing?.status === "authorized") {
            return new Response(JSON.stringify({ success: true, duplicated: true, ...existing }),
              { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
          return new Response(JSON.stringify({
            success: false,
            em_andamento: true,
            aviso: "Já existe uma emissão desta nota em andamento (ou uma tentativa anterior sem confirmação). Confira em Vendas antes de tentar de novo.",
            invoice_id: existing?.id ?? null,
            status: existing?.status ?? null,
          }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        claimId = claim.id;
      }

      const { data: reserved, error: reserveErr } = await admin
        .rpc("reserve_next_dps_number", { config_id: config.id });

      // Falhar aqui é obrigatório: sem reserva o número não incrementa e a
      // próxima emissão repetiria a mesma DPS, que a SEFAZ rejeita.
      if (reserveErr || reserved === null || reserved === undefined) {
        if (claimId) await supabase.from("invoices").delete().eq("id", claimId); // libera o rascunho
        console.error("Falha ao reservar número da DPS:", reserveErr?.message);
        return new Response(
          JSON.stringify({ error: "Nao foi possivel reservar o numero da DPS. Emissao abortada." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      numeroDps = reserved;
      if (claimId) await supabase.from("invoices").update({ number: String(numeroDps) }).eq("id", claimId);

      workerPath = "/emit";
      workerBody = {
        certBase64: certBase64,
        certPassword: certPassword,
        cnpjPrestador: config.cert_cnpj || data?.cnpjPrestador,
        inscricaoMunicipal: config.inscricao_municipal || undefined,
        codigoMunicipio: config.codigo_municipio,
        competencia: data?.competencia,
        serieDps: config.serie_dps,
        numeroDps: String(numeroDps),
        ambiente: config.ambiente,
        servico: data?.servico,
        tomador: data?.tomador,
        valores: data?.valores,
        observacoes: data?.observacoes,
        // Regime real da empresa (antes ia `false` cravado → ISS errado p/ Simples).
        optanteSimplesNacional: config.optante_simples ?? true,
        // RTC/IBS-CBS opcional (opt-in): só transmitido quando o app envia data.rtc.
        rtc: (data as { rtc?: unknown } | undefined)?.rtc,
      };
    } else if (operation === "status") {
      workerPath = "/status";
      workerBody = {
        certBase64: certBase64,
        certPassword: certPassword,
      };
    } else if (operation === "cancel") {
      // Cancelamento também exige mTLS ao SEFIN → passa pelo worker com o cert.
      workerPath = "/cancel";
      workerBody = {
        certBase64: certBase64,
        certPassword: certPassword,
        chaveAcesso: data?.chaveAcesso,
        motivo: data?.motivo,
        codigoMotivo: data?.codigoMotivo,
        ambiente: config.ambiente,
      };
    } else if (operation === "parse_cert") {
      // Handled locally — just test cert parsing
      workerPath = "/status";
      workerBody = {
        certBase64: certBase64,
        certPassword: certPassword,
      };
    } else {
      return new Response(JSON.stringify({ error: `Operacao desconhecida: ${operation}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Call worker with timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    let workerRes: Response;
    try {
      workerRes = await fetch(`${workerUrl}${workerPath}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": workerKey,
        },
        body: JSON.stringify(workerBody),
        signal: controller.signal,
      });
    } catch (fetchErr: any) {
      clearTimeout(timeout);
      const msg = fetchErr.name === "AbortError" ? "Timeout: Worker nao respondeu em 30s" : fetchErr.message;
      return new Response(JSON.stringify({ error: msg }), {
        status: 504,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    clearTimeout(timeout);

    const workerData = await workerRes.json();

    // Cancelamento aceito pelo SEFIN → marca a nota como cancelada (o trigger
    // estornar_receivable_nota_cancelada zera o recebível ainda em aberto).
    if (operation === "cancel" && workerData.success && data?.chaveAcesso) {
      await supabase.from("invoices")
        .update({
          status: "cancelled",
          nfse_evento_xml: workerData.eventoXml ?? workerData.pedidoEventoXml ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("company_id", companyId).eq("chave_acesso", String(data.chaveAcesso).replace(/\D/g, ""));
    }

    // SEFIN respondeu, mas REJEITOU a emissão (não autorizou): libera o rascunho
    // reservado no claim-first para que uma nova tentativa seja possível.
    if (operation === "emit" && !workerData.success && claimId) {
      await supabase.from("invoices").delete().eq("id", claimId);
    }

    // If emission succeeded, save to invoices and update last_emission_at
    if (operation === "emit" && workerData.success) {
      await supabase
        .from("nfse_config")
        .update({ last_emission_at: new Date().toISOString() })
        .eq("id", config.id);

      const invoicePayload = {
        company_id: companyId,
        type: "nfse",
        status: "authorized",
        number: workerData.idDPS || String(numeroDps),
        issue_date: new Date().toISOString().split("T")[0],
        total: data?.valores?.valorServicos || 0,
        // Antes ia null fixo: a nota nascia órfã de cliente e ninguém
        // conseguia responder "esta nota é de quem?".
        contact_id: (body.contactId as string | undefined) ?? null,
        sales_order_id: salesOrderId,
        // Documentos fiscais dedicados (guarda de 5 anos), não só o dump JSON.
        chave_acesso: workerData.chaveAcesso ?? null,
        dps_xml: workerData.dpsXml ?? null,
        nfse_xml: workerData.nfseXml ?? null,
        sefin_ambiente: workerData.ambiente ?? config.ambiente,
        idempotency_key: idempotencyKey,
        xml_content: workerData.nfseXml ?? JSON.stringify(workerData),
      };
      // Claim-first: se reservamos o rascunho, CONFIRMA-o (update) em vez de inserir
      // outra linha — a nota autorizada é o mesmo registro reservado antes de transmitir.
      const { data: invRow, error: invErr } = claimId
        ? await supabase.from("invoices").update(invoicePayload).eq("id", claimId).select("id").single()
        : await supabase.from("invoices").insert(invoicePayload).select("id").single();

      // A nota JÁ foi autorizada no SEFIN. Se falhar ao gravar, NÃO some com ela:
      // devolve os dados fiscais para não perder a guarda e alerta o operador (achado C1).
      if (invErr || !invRow) {
        console.error("[nfse-proxy] NFS-e autorizada mas falhou ao gravar invoice:", invErr?.message, "chave:", workerData.chaveAcesso);
        return new Response(JSON.stringify({
          success: false,
          emitida_no_sefin: true,
          aviso: "A nota foi AUTORIZADA no SEFIN, mas houve falha ao registrá-la no sistema. Guarde estes dados e contate o suporte.",
          chaveAcesso: workerData.chaveAcesso ?? null,
          idDPS: workerData.idDPS ?? null,
          nfseXml: workerData.nfseXml ?? null,
          erro: invErr?.message ?? "insert retornou vazio",
        }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Item da nota (NFS-e = 1 serviço), ligando a nota ao catálogo/venda.
      if (invRow?.id) {
        const valorServ = Number((data?.valores as { valorServicos?: number } | undefined)?.valorServicos) || 0;
        await supabase.from("invoice_items").insert({
          invoice_id: invRow.id,
          product_id: (body.productId as string | undefined) ?? null,
          description: (data?.servico as { descricao?: string } | undefined)?.descricao ?? "Serviço",
          quantity: 1,
          unit_price: valorServ,
          total: valorServ,
        });
      }
    }

    return new Response(JSON.stringify(workerData), {
      status: workerRes.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
