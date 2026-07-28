/**
 * indices-sync — busca IPCA, IGP-M e INPC na API pública do Banco Central.
 *
 * Séries do SGS:
 *   433 IPCA · 189 IGP-M · 188 INPC
 *
 * Existe para o reajuste de contrato parar de perguntar o percentual ao
 * usuário. Buscar na fonte é diferente de inventar: o número tem procedência,
 * fica gravado com data de atualização, e a série incompleta faz o acumulado
 * devolver nulo em vez de um número menor e plausível.
 *
 * Roda por cron no dia 12, depois da divulgação do IPCA do mês anterior pelo
 * IBGE, e também sob demanda com JWT.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";
import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";
import { authenticate, jsonResp } from "../_shared/auth.ts";

const SERIES: Record<string, number> = { ipca: 433, igpm: 189, inpc: 188 };

/** Quantos meses trazer. 36 cobre a janela de reajuste com folga e é barato. */
const MESES = 36;

/** dd/MM/yyyy, que é o formato que o SGS aceita nos parâmetros. */
function dataBr(d: Date): string {
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
}

interface PontoBcb {
  data: string;
  valor: string;
}

/** "01/06/2026" -> "2026-06-01". A API do BCB devolve sempre dia 01. */
function paraIso(dataBr: string): string | null {
  const m = dataBr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-01`;
}

async function sincronizar(indice: string, serie: number) {
  // Endpoint com intervalo de datas, que é a forma documentada. A variante
  // `/ultimos/N` funciona do desktop e devolve 400 a partir da edge, sem corpo
  // que explique. Como o número aqui é dado fiscal, é melhor usar o caminho
  // documentado do que descobrir a regra do WAF por tentativa.
  const ate = new Date();
  const de = new Date(Date.UTC(ate.getUTCFullYear(), ate.getUTCMonth() - MESES, 1));
  const url =
    `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${serie}/dados` +
    `?formato=json&dataInicial=${encodeURIComponent(dataBr(de))}&dataFinal=${encodeURIComponent(dataBr(ate))}`;

  const res = await fetch(url);

  if (!res.ok) {
    // O corpo entra no erro: "BCB devolveu 400" sozinho não diz se foi
    // parâmetro, bloqueio ou indisponibilidade, e sem isso a próxima falha
    // custa a mesma investigação de novo.
    const corpo = await res.text().catch(() => "");
    return { indice, ok: false, erro: `BCB devolveu ${res.status}: ${corpo.slice(0, 160)}`, linhas: 0 };
  }

  const dados = (await res.json()) as PontoBcb[];
  if (!Array.isArray(dados) || dados.length === 0) {
    return { indice, ok: false, erro: "BCB devolveu série vazia", linhas: 0 };
  }

  const linhas = dados
    .map((p) => {
      const mes = paraIso(p.data);
      const variacao = Number(String(p.valor).replace(",", "."));
      // Ponto sem data legível ou sem número é descartado, e não convertido em
      // zero: zero é uma afirmação de que o índice não variou naquele mês.
      if (!mes || !Number.isFinite(variacao)) return null;
      return { indice, mes, variacao_pct: variacao, fonte: "bcb-sgs", atualizado_em: new Date().toISOString() };
    })
    .filter((l): l is NonNullable<typeof l> => l !== null);

  return { indice, ok: true, linhas: linhas.length, dados: linhas };
}

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);
  const pre = corsPreflightResponse(req);
  if (pre) return pre;

  const service = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const cronSecret = Deno.env.get("CRON_SECRET");
  const viaCron = Boolean(cronSecret) && req.headers.get("x-cron-secret") === cronSecret;

  if (!viaCron) {
    const auth = await authenticate(req);
    if (auth instanceof Response) return auth;
  }

  const resultados: Array<{ indice: string; ok: boolean; linhas: number; erro?: string }> = [];

  for (const [indice, serie] of Object.entries(SERIES)) {
    try {
      const r = await sincronizar(indice, serie);
      if (r.ok && r.dados) {
        const { error } = await service
          .from("indices_economicos")
          .upsert(r.dados, { onConflict: "indice,mes" });
        if (error) {
          resultados.push({ indice, ok: false, linhas: 0, erro: error.message });
          continue;
        }
      }
      resultados.push({ indice: r.indice, ok: r.ok, linhas: r.linhas, erro: r.erro });
    } catch (e) {
      // Um índice fora do ar não pode derrubar os outros dois.
      resultados.push({ indice, ok: false, linhas: 0, erro: (e as Error).message });
    }
  }

  const algumFalhou = resultados.some((r) => !r.ok);
  return jsonResp(
    { ok: !algumFalhou, resultados },
    algumFalhou ? 207 : 200,
    corsHeaders,
  );
});
