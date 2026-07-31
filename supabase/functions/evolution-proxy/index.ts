/**
 * evolution-proxy — a API key da Evolution sai do browser (issue #27).
 *
 * O front chama /evolution-proxy/{config_id}/{caminho...} com o JWT do
 * usuário; a função valida a membresia na empresa dona da config, injeta a
 * key DO SERVIDOR e repassa. O path espelha a Evolution de propósito: os
 * helpers do WhatsAppAgent funcionam trocando só a base e os headers.
 *
 * Whitelist de caminhos: só operações de instância/webhook/settings e envio
 * de texto. Nada de expor a API inteira de um servidor Evolution por tabela.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";
import { authenticate, assertMembership, assertCanWrite, jsonResp } from "../_shared/auth.ts";

const CAMINHOS_PERMITIDOS = [
  "instance/connect/",
  "instance/connectionState/",
  "instance/fetchInstances",
  "instance/logout/",
  "instance/create",
  "settings/set/",
  "webhook/set/",
  "instance/setWebhook/",
  "message/sendText/",
];

Deno.serve(async (req) => {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const { user, supabase, corsHeaders } = auth;

  const service = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const url = new URL(req.url);
    // /functions/v1/evolution-proxy/{configId}/{...caminho}
    const partes = url.pathname.split("/").filter(Boolean);
    const idx = partes.indexOf("evolution-proxy");
    const configId = partes[idx + 1];
    const caminho = partes.slice(idx + 2).join("/");
    if (!configId || !caminho) {
      return jsonResp({ error: "uso: /evolution-proxy/{config_id}/{caminho}" }, 400, corsHeaders);
    }
    // Path traversal: fetch/URL normalizam "..", então "instance/connect/../../x"
    // passaria no startsWith e chegaria em /x com a key injetada. Recusa
    // qualquer segmento relativo ou encoding antes da whitelist.
    if (caminho.includes("..") || caminho.includes("%") || caminho.includes("//") || caminho.includes("\\")) {
      return jsonResp({ error: "Caminho inválido." }, 403, corsHeaders);
    }
    if (!CAMINHOS_PERMITIDOS.some((p) => caminho === p.replace(/\/$/, "") || caminho.startsWith(p))) {
      return jsonResp({ error: `Caminho não permitido: ${caminho}` }, 403, corsHeaders);
    }

    const { data: config } = await service
      .from("whatsapp_configs")
      .select("company_id, evolution_api_url, evolution_api_key")
      .eq("id", configId)
      .maybeSingle();
    if (!config) return jsonResp({ error: "Config não encontrada" }, 404, corsHeaders);

    const forbidden = await assertMembership(supabase, user.id, config.company_id, corsHeaders);
    if (forbidden) return forbidden;
    // O proxy faz fetch server-side para a evolution_api_url gravada: papel
    // somente leitura (demo) não dispara essa saída de rede (defesa extra ao
    // RESTRICTIVE já posto em whatsapp_configs).
    const readonly = await assertCanWrite(supabase, user.id, config.company_id, corsHeaders);
    if (readonly) return readonly;

    const evolutionUrl = (config.evolution_api_url || Deno.env.get("EVOLUTION_API_URL") || "").replace(/\/$/, "");
    const evolutionKey = config.evolution_api_key || Deno.env.get("EVOLUTION_API_KEY");
    if (!evolutionUrl || !evolutionKey) {
      return jsonResp({ error: "EVOLUTION_NOT_CONFIGURED" }, 409, corsHeaders);
    }

    const body = req.method === "GET" || req.method === "DELETE" ? undefined : await req.text();
    const resposta = await fetch(`${evolutionUrl}/${caminho}${url.search}`, {
      method: req.method,
      headers: {
        apikey: evolutionKey,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body,
    });

    const texto = await resposta.text();
    return new Response(texto, {
      status: resposta.status,
      headers: { ...corsHeaders, "Content-Type": resposta.headers.get("Content-Type") ?? "application/json" },
    });
  } catch (err) {
    console.error("[evolution-proxy] error", err);
    return jsonResp({ error: String(err) }, 500, corsHeaders);
  }
});
