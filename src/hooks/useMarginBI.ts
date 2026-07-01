import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany, type Company } from "@/hooks/useCompany";
import {
  toTotals,
  lastMonthsKeys,
  formatMonth,
  type MarginRow,
  type CompanyMargin,
  type MarginTotals,
} from "@/lib/margin";

const MONTHS_WINDOW = 12;

export interface TrendPoint {
  month: string; // rótulo curto (ex.: "Jul/26")
  key: string; // 'YYYY-MM-DD'
  receita: number;
  custos: number;
  despesas: number;
  margemBruta: number;
  margemOperacional: number;
  /** margem operacional por empresa: chave = companyId */
  [companyId: string]: number | string;
}

export interface MarginBIData {
  /** Totais do período (todos os meses da janela) para o escopo atual. */
  totals: MarginTotals;
  /** Totais do mês atual (mais recente). */
  currentMonth: MarginTotals;
  /** Totais do mês anterior (para variação). */
  previousMonth: MarginTotals;
  /** Um registro consolidado por empresa (período completo), ordenado por margem operacional desc. */
  perCompany: CompanyMargin[];
  /** Série mensal consolidada (do escopo atual) + margem operacional por empresa. */
  trend: TrendPoint[];
  /** Empresas visíveis no escopo atual. */
  companies: Company[];
  isCombined: boolean;
}

async function fetchMarginRows(companyIds: string[], sinceIso: string): Promise<MarginRow[]> {
  if (companyIds.length === 0) return [];
  const { data, error } = await supabase
    .from("v_company_margin")
    .select("company_id, month, receita, custos, despesas")
    .in("company_id", companyIds)
    .gte("month", sinceIso);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    company_id: r.company_id as string,
    month: (r.month as string).slice(0, 10),
    receita: Number(r.receita) || 0,
    custos: Number(r.custos) || 0,
    despesas: Number(r.despesas) || 0,
  }));
}

export function useMarginBI() {
  const { companies, scope, loading: companyLoading } = useCompany();

  const scopedCompanies = scope === "all" ? companies : companies.filter((c) => c.id === scope);
  const scopedIds = scopedCompanies.map((c) => c.id);
  const monthKeys = lastMonthsKeys(MONTHS_WINDOW);
  const sinceIso = monthKeys[0];

  const query = useQuery<MarginBIData>({
    queryKey: ["margin-bi", scope, scopedIds.join(","), sinceIso],
    enabled: !companyLoading && scopedIds.length > 0,
    staleTime: 30_000,
    queryFn: async () => {
      const rows = await fetchMarginRows(scopedIds, sinceIso);
      return buildMarginBI(rows, scopedCompanies, monthKeys, scope === "all");
    },
  });

  return {
    ...query,
    isLoading: companyLoading || query.isLoading,
    hasCompanies: companies.length > 0,
    scopedCompanies,
  };
}

export function buildMarginBI(
  rows: MarginRow[],
  companies: Company[],
  monthKeys: string[],
  isCombined: boolean,
): MarginBIData {
  const currentKey = monthKeys[monthKeys.length - 1];
  const previousKey = monthKeys[monthKeys.length - 2];

  // Consolidado por empresa (janela inteira)
  const perCompany: CompanyMargin[] = companies
    .map((c) => {
      const companyRows = rows.filter((r) => r.company_id === c.id);
      const totals = toTotals(companyRows);
      return { companyId: c.id, orgId: c.orgId, name: c.name, cnpj: c.cnpj, ...totals };
    })
    .sort((a, b) => b.margemOperacional - a.margemOperacional);

  const totals = toTotals(rows);
  const currentMonth = toTotals(rows.filter((r) => r.month === currentKey));
  const previousMonth = toTotals(rows.filter((r) => r.month === previousKey));

  // Série mensal consolidada + margem operacional por empresa
  const trend: TrendPoint[] = monthKeys.map((key) => {
    const monthRows = rows.filter((r) => r.month === key);
    const monthTotals = toTotals(monthRows);
    const point: TrendPoint = {
      key,
      month: formatMonth(key),
      receita: monthTotals.receita,
      custos: monthTotals.custos,
      despesas: monthTotals.despesas,
      margemBruta: round1(monthTotals.margemBruta),
      margemOperacional: round1(monthTotals.margemOperacional),
    };
    if (isCombined) {
      for (const c of companies) {
        const cRows = monthRows.filter((r) => r.company_id === c.id);
        point[c.id] = round1(toTotals(cRows).margemOperacional);
      }
    }
    return point;
  });

  return {
    totals,
    currentMonth,
    previousMonth,
    perCompany,
    trend,
    companies,
    isCombined,
  };
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
