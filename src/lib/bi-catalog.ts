import { z } from "zod";

/**
 * Catálogo do BI self-service. O catálogo é CÓDIGO (métricas, dimensões e
 * combinações válidas); a escolha do cliente é DADO (dashboard_widgets.config,
 * validada pelo schema zod abaixo). Pizza não existe de propósito: comparação
 * angular é ilegível — participação vira barra.
 */

export const DIMENSOES = ["tempo", "empresa", "centro_custo", "cliente"] as const;
export type DimensaoBI = (typeof DIMENSOES)[number];

export const TIPOS_GRAFICO = ["bar", "line", "area", "table"] as const;
export type TipoGrafico = (typeof TIPOS_GRAFICO)[number];

export interface MetricaBI {
  key: string;
  label: string;
  formato: "currency" | "percent";
  dimensoes: DimensaoBI[];
}

export const METRICAS_BI: MetricaBI[] = [
  { key: "receita", label: "Receita", formato: "currency", dimensoes: ["tempo", "empresa"] },
  { key: "custos", label: "Custos (CMV)", formato: "currency", dimensoes: ["tempo", "empresa"] },
  { key: "despesas", label: "Despesas", formato: "currency", dimensoes: ["tempo", "empresa"] },
  { key: "resultado", label: "Resultado", formato: "currency", dimensoes: ["tempo", "empresa"] },
  { key: "margem_operacional", label: "Margem operacional", formato: "percent", dimensoes: ["tempo", "empresa"] },
  { key: "despesa_centro_custo", label: "Despesa por centro de custo", formato: "currency", dimensoes: ["centro_custo"] },
  { key: "faturado_cliente", label: "Faturamento por cliente", formato: "currency", dimensoes: ["cliente"] },
  { key: "recebiveis_vencimento", label: "Recebíveis por vencimento", formato: "currency", dimensoes: ["tempo"] },
  { key: "pagar_vencimento", label: "Contas a pagar por vencimento", formato: "currency", dimensoes: ["tempo"] },
];

export const METRICA_POR_KEY = Object.fromEntries(METRICAS_BI.map((m) => [m.key, m]));

/** Dimensão tempo aceita qualquer tipo; dimensões categóricas não aceitam linha/área. */
export function tiposPermitidos(dimensao: DimensaoBI): TipoGrafico[] {
  return dimensao === "tempo" ? ["line", "area", "bar", "table"] : ["bar", "table"];
}

export const widgetConfigSchema = z
  .object({
    metrica: z.string().refine((m) => !!METRICA_POR_KEY[m], "métrica desconhecida"),
    dimensao: z.enum(DIMENSOES),
    tipo: z.enum(TIPOS_GRAFICO),
    meses: z.number().int().min(3).max(24).default(12),
  })
  .superRefine((config, ctx) => {
    const metrica = METRICA_POR_KEY[config.metrica];
    if (metrica && !metrica.dimensoes.includes(config.dimensao)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `a métrica ${metrica.label} não aceita a dimensão ${config.dimensao}`,
      });
    }
    if (!tiposPermitidos(config.dimensao).includes(config.tipo)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `dimensão ${config.dimensao} não aceita gráfico ${config.tipo}`,
      });
    }
  });

export type WidgetConfig = z.infer<typeof widgetConfigSchema>;

export interface PontoBI {
  label: string;
  valor: number;
}

/** Agrega linhas mensais de v_company_margin na métrica pedida. */
export function serieMensal(
  rows: Array<{ month: string; receita: number; custos: number; despesas: number }>,
  metrica: string,
): PontoBI[] {
  const porMes = new Map<string, { receita: number; custos: number; despesas: number }>();
  for (const r of rows) {
    const chave = r.month.slice(0, 7);
    const acc = porMes.get(chave) ?? { receita: 0, custos: 0, despesas: 0 };
    acc.receita += Number(r.receita) || 0;
    acc.custos += Number(r.custos) || 0;
    acc.despesas += Number(r.despesas) || 0;
    porMes.set(chave, acc);
  }
  return [...porMes.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([mes, v]) => ({ label: formatMesCurto(mes), valor: valorDaMetrica(v, metrica) }));
}

/** Agrega as mesmas linhas por empresa (label vem do mapa de nomes). */
export function seriePorEmpresa(
  rows: Array<{ company_id: string; receita: number; custos: number; despesas: number }>,
  metrica: string,
  nomes: Record<string, string>,
): PontoBI[] {
  const porEmpresa = new Map<string, { receita: number; custos: number; despesas: number }>();
  for (const r of rows) {
    const acc = porEmpresa.get(r.company_id) ?? { receita: 0, custos: 0, despesas: 0 };
    acc.receita += Number(r.receita) || 0;
    acc.custos += Number(r.custos) || 0;
    acc.despesas += Number(r.despesas) || 0;
    porEmpresa.set(r.company_id, acc);
  }
  return [...porEmpresa.entries()]
    .map(([id, v]) => ({ label: nomes[id] ?? "Empresa", valor: valorDaMetrica(v, metrica) }))
    .sort((a, b) => b.valor - a.valor);
}

/** Soma valores por mês de vencimento (recebíveis/contas a pagar). */
export function seriePorVencimento(rows: Array<{ valor: number; vencimento: string }>): PontoBI[] {
  const porMes = new Map<string, number>();
  for (const r of rows) {
    const chave = r.vencimento.slice(0, 7);
    porMes.set(chave, (porMes.get(chave) ?? 0) + r.valor);
  }
  return [...porMes.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([mes, valor]) => ({ label: formatMesCurto(mes), valor }));
}

function valorDaMetrica(v: { receita: number; custos: number; despesas: number }, metrica: string): number {
  switch (metrica) {
    case "receita":
      return v.receita;
    case "custos":
      return v.custos;
    case "despesas":
      return v.despesas;
    case "resultado":
      return v.receita - v.custos - v.despesas;
    case "margem_operacional":
      return v.receita > 0 ? ((v.receita - v.custos - v.despesas) / v.receita) * 100 : 0;
    default:
      return 0;
  }
}

function formatMesCurto(anoMes: string): string {
  const [ano, mes] = anoMes.split("-");
  const nomes = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${nomes[Number(mes) - 1] ?? mes}/${ano.slice(2)}`;
}
