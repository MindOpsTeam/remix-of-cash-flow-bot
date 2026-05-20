/**
 * list-whatsapp-groups — lista grupos WhatsApp via Evolution API
 *
 * Auth: exige JWT do usuário + membership na company dona da whatsapp_configs.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsPreflightResponse } from "../_shared/cors.ts";
import { authenticate, assertMembership, jsonResp } from "../_shared/auth.ts";

interface NormalizedGroup {
  id: string;
  subject: string;
  size: number;
  pictureUrl: string | null;
}

async function fetchPicturesInBatches(
  baseUrl: string,
  instanceName: string,
  apiKey: string,
  groupIds: string[],
  batchSize = 10,
  delayMs = 300,
): Promise<Map<string, string | null>> {
  const pictureMap = new Map<string, string | null>();

  for (let i = 0; i < groupIds.length; i += batchSize) {
    const batch = groupIds.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map(async (groupId) => {
        try {
          const res = await fetch(`${baseUrl}/chat/fetchProfilePictureUrl/${instanceName}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: apiKey },
            body: JSON.stringify({ number: groupId }),
          });
          if (!res.ok) return { groupId, url: null };
          const data = await res.json();
          return { groupId, url: data?.profilePictureUrl || null };
        } catch {
          return { groupId, url: null };
        }
      }),
    );

    for (const r of results) {
      if (r.status === "fulfilled") {
        pictureMap.set(r.value.groupId, r.value.url);
      }
    }

    if (i + batchSize < groupIds.length) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  return pictureMap;
}

serve(async (req) => {
  const preflight = corsPreflightResponse(req);
  if (preflight) return preflight;

  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const { user, supabase, corsHeaders } = auth;

  try {
    const { config_id, include_pictures = false } = await req.json();

    if (!config_id) {
      return jsonResp({ success: false, error: "config_id é obrigatório" }, 400, corsHeaders);
    }

    // Carrega config + company_id. NÃO retornamos a evolution_api_key na resposta.
    const { data: config, error: configErr } = await supabase
      .from("whatsapp_configs")
      .select("company_id, evolution_api_url, evolution_api_key, instance_name")
      .eq("id", config_id)
      .single();

    if (configErr || !config) {
      return jsonResp({ success: false, error: "Configuração não encontrada" }, 404, corsHeaders);
    }

    // O usuário precisa ser membro da empresa dona dessa config
    const forbidden = await assertMembership(supabase, user.id, config.company_id, corsHeaders);
    if (forbidden) return forbidden;

    if (!config.evolution_api_url || !config.evolution_api_key) {
      return jsonResp(
        { success: false, error: "Credenciais da Evolution API não configuradas" },
        400,
        corsHeaders,
      );
    }

    const baseUrl = (config.evolution_api_url as string).replace(/\/$/, "");
    const instanceName = config.instance_name as string;

    console.log(`[list-whatsapp-groups] Fetching groups for instance: ${instanceName}`);
    const groupsRes = await fetch(
      `${baseUrl}/group/fetchAllGroups/${instanceName}?getParticipants=false`,
      { headers: { apikey: config.evolution_api_key as string } },
    );

    if (!groupsRes.ok) {
      const errorText = await groupsRes.text();
      console.error(`[list-whatsapp-groups] Error (${groupsRes.status}): ${errorText.substring(0, 500)}`);
      return jsonResp(
        { success: false, error: `Erro ao buscar grupos: ${groupsRes.status}` },
        400,
        corsHeaders,
      );
    }

    const groupsData = await groupsRes.json();
    console.log(`[list-whatsapp-groups] Found ${Array.isArray(groupsData) ? groupsData.length : 0} groups`);

    const groups: NormalizedGroup[] = (Array.isArray(groupsData) ? groupsData : []).map(
      (g: { id?: string; jid?: string; groupId?: string; subject?: string; name?: string; groupName?: string; size?: number; participants?: unknown[] }) => ({
        id: g.id || g.jid || g.groupId || "",
        subject: g.subject || g.name || g.groupName || "Sem nome",
        size: g.size || (Array.isArray(g.participants) ? g.participants.length : 0),
        pictureUrl: null,
      }),
    );

    if (include_pictures && groups.length > 0) {
      console.log(`[list-whatsapp-groups] Fetching pictures for ${groups.length} groups`);
      const pictureMap = await fetchPicturesInBatches(
        baseUrl,
        instanceName,
        config.evolution_api_key as string,
        groups.map((g) => g.id),
      );
      for (const group of groups) {
        group.pictureUrl = pictureMap.get(group.id) || null;
      }
      console.log(`[list-whatsapp-groups] Pictures fetched`);
    }

    return jsonResp({ success: true, groups }, 200, corsHeaders);

  } catch (error: unknown) {
    console.error("[list-whatsapp-groups] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonResp({ success: false, error: message }, 500, corsHeaders);
  }
});
