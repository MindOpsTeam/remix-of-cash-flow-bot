import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";

import { bigQueryConsulta, GcpNaoConfigurado, getGcpAccessToken } from "./gcp.ts";
import type { MesHistorico } from "./forecast.ts";

/**
 * Previsão de caixa pelo TimesFM, o modelo de séries temporais do Google que
 * roda dentro do BigQuery.
 *
 * POR QUE EXISTE
 * A projeção padrão usa média ponderada do histórico. Isso funciona, mas achata
 * o que é sazonal: não reconhece que dezembro é diferente, nem o décimo
 * terceiro, nem o imposto que segue o faturamento do mês anterior. O TimesFM foi
 * treinado em milhões de séries e reconhece esses padrões sem ninguém contar.
 *
 * É OPCIONAL. Sem a credencial do Google Cloud, quem chama cai na projeção
 * estatística e o produto segue inteiro. Por isso toda falha aqui devolve null
 * em vez de estourar: previsão melhor é um ganho, não um pré-requisito.
 *
 * CUSTO: para o volume de uma PME, as consultas cabem na franquia gratuita do
 * BigQuery. O Google exige faturamento ativo no projeto mesmo sem cobrar.
 */

export interface PrevisaoTimesFM {
  /** YYYY-MM */
  mes: string;
  receita: number;
  despesa: number;
}

/** Uma linha do UNNEST, no formato que o AI.FORECAST espera. */
function ponto(serie: string, dia: string, valor: number): string {
  return `STRUCT('${serie}' AS serie, DATE '${dia}' AS dia, ${Number(valor) || 0} AS valor)`;
}

/** Primeiro dia do mês, que é como ancoramos a série mensal. */
function diaDoMes(mes: string): string {
  return `${mes}-01`;
}

export function montarQuery(historico: MesHistorico[], meses: number): string {
  const linhas = [
    ...historico.map((h) => ponto("receita", diaDoMes(h.mes), h.receita)),
    ...historico.map((h) => ponto("despesa", diaDoMes(h.mes), h.despesa)),
  ];
  return `SELECT serie,
       FORMAT_DATE('%Y-%m', DATE(forecast_timestamp)) AS mes,
       forecast_value
FROM AI.FORECAST(
  (SELECT serie, dia, valor FROM UNNEST([
${linhas.join(",\n")}
  ])),
  data_col => 'valor',
  timestamp_col => 'dia',
  id_cols => ['serie'],
  horizon => ${Math.max(1, Math.floor(meses))},
  confidence_level => 0.8
)
ORDER BY mes, serie`;
}

/** Mínimo de meses para o modelo enxergar padrão em vez de ruído. */
export const MINIMO_MESES = 6;

/**
 * Devolve a previsão, ou `null` quando não dá para usar o TimesFM (sem
 * credencial, histórico curto demais, ou falha do BigQuery). Nunca lança:
 * o chamador precisa poder seguir com o motor de reserva.
 */
export async function preverComTimesFM(
  svc: SupabaseClient,
  companyId: string,
  historico: MesHistorico[],
  meses: number,
): Promise<PrevisaoTimesFM[] | null> {
  if (historico.length < MINIMO_MESES) return null;

  try {
    const { token, projectId } = await getGcpAccessToken(svc, companyId);
    const linhas = await bigQueryConsulta(token, projectId, montarQuery(historico, meses));

    const porMes = new Map<string, { receita?: number; despesa?: number }>();
    for (const linha of linhas) {
      const serie = String(linha.f[0]?.v ?? "");
      const mes = String(linha.f[1]?.v ?? "");
      const valor = Number(linha.f[2]?.v ?? 0);
      if (!mes || !serie) continue;
      const atual = porMes.get(mes) ?? {};
      // negativo não existe em caixa previsto: o modelo às vezes devolve
      if (serie === "receita") atual.receita = Math.max(0, valor);
      if (serie === "despesa") atual.despesa = Math.max(0, valor);
      porMes.set(mes, atual);
    }

    const previsao = [...porMes.entries()]
      .filter(([, v]) => v.receita !== undefined && v.despesa !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mes, v]) => ({ mes, receita: v.receita!, despesa: v.despesa! }));

    return previsao.length > 0 ? previsao : null;
  } catch (err) {
    if (err instanceof GcpNaoConfigurado) return null; // caminho normal: não configurou
    console.error("[timesfm] caiu para o motor de reserva:", String(err).slice(0, 200));
    return null;
  }
}
