/**
 * Sincroniza o "rate store" nacional de alíquotas. Fontes gratuitas/oficiais:
 *  - Municípios: IBGE Localidades API (aberta) → public.municipalities (cMun = id 7d)
 *  - CBS/IBS 2026: alíquotas de teste da LC 214/2025 → public.tax_rates (nacional)
 *
 * Camadas gated (exigem certificado ICP-Brasil A1, não implementadas aqui):
 *  - ISS por município: ADN GET /parametros_municipais/{codIBGE}/{item}/aliquotas
 *  - CBS/IBS por ente/competência: Calculadora Nacional (RFB/Serpro, beta)
 * Ver docs/INTEGRADOR-NACIONAL-ALIQUOTAS.md.
 *
 * POST /tax-rates-sync  header X-Cron-Secret  → sincroniza tudo
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";
import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";

// deno-lint-ignore no-explicit-any
type SupabaseAny = any;

interface IbgeMunicipio {
  id: number;
  nome: string;
  microrregiao?: { mesorregiao?: { UF?: { sigla?: string; regiao?: { sigla?: string } } } };
}

// O prefixo de 2 dígitos do código IBGE é o código da UF — fallback robusto para
// municípios novos cujo aninhamento microrregiao/mesorregiao vem vazio na API.
const UF_BY_CODE: Record<string, [string, string]> = {
  "11": ["RO", "N"], "12": ["AC", "N"], "13": ["AM", "N"], "14": ["RR", "N"],
  "15": ["PA", "N"], "16": ["AP", "N"], "17": ["TO", "N"], "21": ["MA", "NE"],
  "22": ["PI", "NE"], "23": ["CE", "NE"], "24": ["RN", "NE"], "25": ["PB", "NE"],
  "26": ["PE", "NE"], "27": ["AL", "NE"], "28": ["SE", "NE"], "29": ["BA", "NE"],
  "31": ["MG", "SE"], "32": ["ES", "SE"], "33": ["RJ", "SE"], "35": ["SP", "SE"],
  "41": ["PR", "S"], "42": ["SC", "S"], "43": ["RS", "S"], "50": ["MS", "CO"],
  "51": ["MT", "CO"], "52": ["GO", "CO"], "53": ["DF", "CO"],
};

async function syncMunicipalities(supabase: SupabaseAny): Promise<number> {
  const res = await fetch("https://servicodados.ibge.gov.br/api/v1/localidades/municipios");
  if (!res.ok) throw new Error(`IBGE ${res.status}`);
  const data = (await res.json()) as IbgeMunicipio[];

  const rows = data.map((m) => {
    const code = String(m.id);
    const uf = m.microrregiao?.mesorregiao?.UF;
    const fallback = UF_BY_CODE[code.slice(0, 2)] ?? ["", null as string | null];
    return {
      code_ibge: code,
      name: m.nome,
      uf: uf?.sigla || fallback[0],
      region: uf?.regiao?.sigla || fallback[1],
      updated_at: new Date().toISOString(),
    };
  });

  // Upsert em lotes de 500
  let upserted = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const { error } = await supabase.from("municipalities").upsert(chunk, { onConflict: "code_ibge" });
    if (error) throw error;
    upserted += chunk.length;
  }
  return upserted;
}

async function seedNationalRates(supabase: SupabaseAny): Promise<number> {
  // CBS/IBS — ano-teste 2026 (LC 214/2025 arts. 343 e 346). Autoritativo (na lei).
  const nacional = [
    { tax: "cbs", ente_code: "BR", item_code: null, rate: 0.9, vigencia_inicio: "2026-01-01", vigencia_fim: "2026-12-31", source: "lei", version: "LC 214/2025 art.346", confidence: "oficial", notes: "Alíquota de teste CBS 2026" },
    { tax: "ibs", ente_code: "BR", item_code: null, rate: 0.1, vigencia_inicio: "2026-01-01", vigencia_fim: "2026-12-31", source: "lei", version: "LC 214/2025 art.343", confidence: "oficial", notes: "Alíquota de teste IBS 2026 (0,1% estadual)" },
  ];
  // Idempotente: limpa as linhas nacionais de teste e reinsere
  await supabase.from("tax_rates").delete().eq("ente_code", "BR").in("tax", ["cbs", "ibs"]).eq("source", "lei");
  const { error } = await supabase.from("tax_rates").insert(nacional);
  if (error) throw error;
  return nacional.length;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const preflight = corsPreflightResponse(req);
  if (preflight) return preflight;

  const cronSecret = Deno.env.get("CRON_SECRET");
  const provided = req.headers.get("x-cron-secret");
  if (!cronSecret || provided !== cronSecret) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const municipalities = await syncMunicipalities(supabase);
    const nationalRates = await seedNationalRates(supabase);
    return new Response(JSON.stringify({ ok: true, municipalities, nationalRates }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[tax-rates-sync] error", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
