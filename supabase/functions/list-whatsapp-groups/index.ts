import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function fetchPicturesInBatches(
  baseUrl: string,
  instanceName: string,
  apiKey: string,
  groupIds: string[],
  batchSize = 10,
  delayMs = 300
): Promise<Map<string, string | null>> {
  const pictureMap = new Map<string, string | null>();

  for (let i = 0; i < groupIds.length; i += batchSize) {
    const batch = groupIds.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map(async (groupId) => {
        try {
          const res = await fetch(`${baseUrl}/chat/fetchProfilePictureUrl/${instanceName}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': apiKey },
            body: JSON.stringify({ number: groupId }),
          });
          if (!res.ok) return { groupId, url: null };
          const data = await res.json();
          return { groupId, url: data?.profilePictureUrl || null };
        } catch {
          return { groupId, url: null };
        }
      })
    );

    for (const r of results) {
      if (r.status === 'fulfilled') {
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
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { config_id, include_pictures = false } = await req.json();

    if (!config_id) {
      return new Response(JSON.stringify({ success: false, error: 'config_id é obrigatório' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get WhatsApp config credentials
    const { data: config, error: configErr } = await supabase
      .from('whatsapp_configs')
      .select('evolution_api_url, evolution_api_key, instance_name')
      .eq('id', config_id)
      .single();

    if (configErr || !config) {
      return new Response(JSON.stringify({ success: false, error: 'Configuração não encontrada' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!config.evolution_api_url || !config.evolution_api_key) {
      return new Response(JSON.stringify({ success: false, error: 'Credenciais da Evolution API não configuradas' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const baseUrl = config.evolution_api_url.replace(/\/$/, '');
    const instanceName = config.instance_name;

    // Fetch groups from Evolution API
    console.log(`[list-whatsapp-groups] Fetching groups for instance: ${instanceName}`);
    const groupsRes = await fetch(`${baseUrl}/group/fetchAllGroups/${instanceName}?getParticipants=false`, {
      headers: { 'apikey': config.evolution_api_key },
    });

    if (!groupsRes.ok) {
      const errorText = await groupsRes.text();
      console.error(`[list-whatsapp-groups] Error (${groupsRes.status}): ${errorText.substring(0, 500)}`);
      return new Response(JSON.stringify({ success: false, error: `Erro ao buscar grupos: ${groupsRes.status}` }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const groupsData = await groupsRes.json();
    console.log(`[list-whatsapp-groups] Found ${Array.isArray(groupsData) ? groupsData.length : 0} groups`);

    // Normalize the response
    const groups = (Array.isArray(groupsData) ? groupsData : []).map((g: any) => ({
      id: g.id || g.jid || g.groupId,
      subject: g.subject || g.name || g.groupName || 'Sem nome',
      size: g.size || g.participants?.length || 0,
      pictureUrl: null as string | null,
    }));

    // Fetch pictures if requested
    if (include_pictures && groups.length > 0) {
      console.log(`[list-whatsapp-groups] Fetching pictures for ${groups.length} groups`);
      const pictureMap = await fetchPicturesInBatches(
        baseUrl, instanceName, config.evolution_api_key,
        groups.map((g: any) => g.id)
      );
      for (const group of groups) {
        group.pictureUrl = pictureMap.get(group.id) || null;
      }
      console.log(`[list-whatsapp-groups] Pictures fetched`);
    }

    return new Response(JSON.stringify({ success: true, groups }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('[list-whatsapp-groups] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
