import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";

const WORKER_URL = Deno.env.get("NFSE_WORKER_URL") || "http://localhost:3000";
const WORKER_KEY = Deno.env.get("NFSE_WORKER_API_KEY") || "";

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

    // Route to worker
    let workerPath = "/health";
    let workerBody: Record<string, unknown> = {};

    if (operation === "emit") {
      // Reserva atômica do número da DPS. A função é SECURITY DEFINER e NÃO
      // valida dono, por isso não é executável pelo papel `authenticated`; a
      // membresia já foi provada acima, ao carregar nfse_config sob RLS.
      const admin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        { auth: { persistSession: false, autoRefreshToken: false } },
      );
      const { data: reserved, error: reserveErr } = await admin
        .rpc("reserve_next_dps_number", { config_id: config.id });

      // Falhar aqui é obrigatório: sem reserva o número não incrementa e a
      // próxima emissão repetiria a mesma DPS, que a SEFAZ rejeita.
      if (reserveErr || reserved === null || reserved === undefined) {
        console.error("Falha ao reservar número da DPS:", reserveErr?.message);
        return new Response(
          JSON.stringify({ error: "Nao foi possivel reservar o numero da DPS. Emissao abortada." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const numeroDps = reserved;

      workerPath = "/emit";
      workerBody = {
        certBase64: config.cert_pfx_base64,
        certPassword: config.cert_password,
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
        optanteSimplesNacional: false,
      };
    } else if (operation === "status") {
      workerPath = "/status";
      workerBody = {
        certBase64: config.cert_pfx_base64,
        certPassword: config.cert_password,
      };
    } else if (operation === "cancel") {
      workerPath = "/cancel";
      workerBody = { ...data };
    } else if (operation === "parse_cert") {
      // Handled locally — just test cert parsing
      workerPath = "/status";
      workerBody = {
        certBase64: config.cert_pfx_base64,
        certPassword: config.cert_password,
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
      workerRes = await fetch(`${WORKER_URL}${workerPath}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": WORKER_KEY,
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

    // If emission succeeded, save to invoices and update last_emission_at
    if (operation === "emit" && workerData.success) {
      await supabase
        .from("nfse_config")
        .update({ last_emission_at: new Date().toISOString() })
        .eq("id", config.id);

      await supabase.from("invoices").insert({
        company_id: companyId,
        type: "nfse",
        status: "authorized",
        number: workerData.idDPS || String(config.proximo_numero_dps),
        issue_date: new Date().toISOString().split("T")[0],
        total: data?.valores?.valorServicos || 0,
        // Antes ia null fixo: a nota nascia órfã de cliente e ninguém
        // conseguia responder "esta nota é de quem?".
        contact_id: (body.contactId as string | undefined) ?? null,
        sales_order_id: (body.salesOrderId as string | undefined) ?? null,
        xml_content: JSON.stringify(workerData),
      });
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
