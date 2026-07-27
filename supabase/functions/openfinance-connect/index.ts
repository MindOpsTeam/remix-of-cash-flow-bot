/**
 * Open Finance — conexão (Pluggy). Autenticado por JWT do usuário.
 *
 * POST /openfinance-connect
 *   { action: "token", company_id }            → { accessToken } p/ o widget
 *   { action: "register", company_id, item_id } → cria bank_connection + sync inicial
 *   { action: "status" }                        → { configured: boolean }
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";
import { authenticate, assertMembership, jsonResp } from "../_shared/auth.ts";
import { pluggyAuth, createConnectToken, pluggyCredsForCompany } from "../_shared/pluggy.ts";
import { syncPluggyConnection } from "../_shared/openfinance-sync.ts";

Deno.serve(async (req) => {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const { user, supabase, corsHeaders } = auth;

  const service = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action as string;

    if (action === "status") {
      // Com company_id, responde pela credencial DAQUELA empresa (Vault, com
      // fallback no env). Sem, responde só se existe credencial global.
      const cid = body.company_id as string | undefined;
      if (cid) {
        const forbid = await assertMembership(supabase, user.id, cid, corsHeaders);
        if (forbid) return forbid;
        const creds = await pluggyCredsForCompany(service, cid);
        return jsonResp(
          { configured: creds.origem !== "ausente", origem: creds.origem },
          200,
          corsHeaders,
        );
      }
      const configured = Boolean(
        Deno.env.get("PLUGGY_CLIENT_ID") && Deno.env.get("PLUGGY_CLIENT_SECRET"),
      );
      return jsonResp({ configured, origem: configured ? "env" : "ausente" }, 200, corsHeaders);
    }

    const companyId = body.company_id as string | undefined;
    if (!companyId) return jsonResp({ error: "company_id é obrigatório" }, 400, corsHeaders);
    const forbidden = await assertMembership(supabase, user.id, companyId, corsHeaders);
    if (forbidden) return forbidden;

    // O interruptor "Integração ativa" da tela precisa valer no servidor também,
    // senão é promessa de UI que o backend ignora.
    if (action === "token" || action === "register") {
      const { data: cfg } = await service
        .from("openfinance_config")
        .select("active")
        .eq("company_id", companyId)
        .eq("provider", "pluggy")
        .maybeSingle();
      if (cfg && cfg.active === false) {
        return jsonResp({ error: "Integração de Open Finance desativada para esta empresa." }, 400, corsHeaders);
      }
    }

    if (action === "token") {
      let apiKey: string;
      try {
        apiKey = await pluggyAuth(await pluggyCredsForCompany(service, companyId));
      } catch (e) {
        if (e instanceof Error && e.message === "PLUGGY_NOT_CONFIGURED") {
          return jsonResp({ error: "PLUGGY_NOT_CONFIGURED" }, 503, corsHeaders);
        }
        throw e;
      }
      const webhookUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/openfinance-webhook`;
      const accessToken = await createConnectToken(apiKey, {
        clientUserId: companyId,
        webhookUrl,
      });
      return jsonResp({ accessToken }, 200, corsHeaders);
    }

    if (action === "register") {
      const itemId = body.item_id as string | undefined;
      if (!itemId) return jsonResp({ error: "item_id é obrigatório" }, 400, corsHeaders);

      // Cria/atualiza a conexão (idempotente pela unique company+provider+external)
      const { data: conn, error } = await service
        .from("bank_connections")
        .upsert(
          { company_id: companyId, provider: "pluggy", external_id: itemId, status: "updating" },
          { onConflict: "company_id,provider,external_id" },
        )
        .select("id, company_id, external_id, last_synced_at, history_calls_month, history_calls_reset_at")
        .single();
      if (error) throw error;

      const result = await syncPluggyConnection(service, conn, { initial: true });
      return jsonResp({ ok: true, connection_id: conn.id, ...result }, 200, corsHeaders);
    }

    return jsonResp({ error: `Ação inválida: ${action}` }, 400, corsHeaders);
  } catch (err) {
    console.error("[openfinance-connect] error", err);
    return jsonResp({ error: String(err) }, 500, corsHeaders);
  }
});
