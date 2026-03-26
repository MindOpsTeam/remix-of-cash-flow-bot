import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { startOfMonth, subMonths, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface KPIData {
  revenue: number;
  expenses: number;
  profit: number;
  margin: number;
  revenueChange: number;
  expensesChange: number;
  profitChange: number;
  marginChange: number;
}

interface ChartDataPoint {
  month: string;
  receitas: number;
  despesas: number;
}

interface CostCenterBreakdown {
  name: string;
  amount: number;
  percentage: number;
}

export interface CFODashboardData {
  kpis: KPIData;
  chartData: ChartDataPoint[];
  costCenters: CostCenterBreakdown[];
  loading: boolean;
}

export function useCFODashboard(): CFODashboardData {
  const { company } = useCompany();
  const [data, setData] = useState<CFODashboardData>({
    kpis: { revenue: 0, expenses: 0, profit: 0, margin: 0, revenueChange: 0, expensesChange: 0, profitChange: 0, marginChange: 0 },
    chartData: [],
    costCenters: [],
    loading: true,
  });

  const fetchData = useCallback(async () => {
    if (!company) return;

    const now = new Date();
    const sixMonthsAgo = subMonths(startOfMonth(now), 5);

    const [{ data: transactions }, { data: costCentersData }] = await Promise.all([
      supabase
        .from("transactions")
        .select("date, amount, type, cost_center_id")
        .eq("company_id", company.id)
        .eq("status", "confirmed")
        .gte("date", format(sixMonthsAgo, "yyyy-MM-dd")),
      supabase
        .from("cost_centers")
        .select("id, name")
        .eq("company_id", company.id)
        .eq("active", true),
    ]);

    if (!transactions) {
      setData((prev) => ({ ...prev, loading: false }));
      return;
    }

    const currentMonthStart = startOfMonth(now);
    const prevMonthStart = subMonths(currentMonthStart, 1);

    const sumByType = (txs: typeof transactions, type: string) =>
      txs.filter((t) => t.type === type).reduce((s, t) => s + Number(t.amount), 0);

    const currentTxs = transactions.filter((t) => parseISO(t.date) >= currentMonthStart);
    const prevTxs = transactions.filter(
      (t) => parseISO(t.date) >= prevMonthStart && parseISO(t.date) < currentMonthStart
    );

    const curRevenue = sumByType(currentTxs, "revenue");
    const curExpenses = sumByType(currentTxs, "expense");
    const prevRevenue = sumByType(prevTxs, "revenue");
    const prevExpenses = sumByType(prevTxs, "expense");

    const curProfit = curRevenue - curExpenses;
    const prevProfit = prevRevenue - prevExpenses;
    const curMargin = curRevenue > 0 ? (curProfit / curRevenue) * 100 : 0;
    const prevMargin = prevRevenue > 0 ? (prevProfit / prevRevenue) * 100 : 0;

    const pctChange = (cur: number, prev: number) =>
      prev === 0 ? (cur > 0 ? 100 : 0) : ((cur - prev) / Math.abs(prev)) * 100;

    const chartData: ChartDataPoint[] = [];
    for (let i = 5; i >= 0; i--) {
      const monthStart = subMonths(startOfMonth(now), i);
      const monthEnd = i === 0 ? now : subMonths(startOfMonth(now), i - 1);
      const monthTxs = transactions.filter(
        (t) => parseISO(t.date) >= monthStart && parseISO(t.date) < (i === 0 ? new Date(9999, 0) : monthEnd)
      );
      chartData.push({
        month: format(monthStart, "MMM", { locale: ptBR }),
        receitas: sumByType(monthTxs, "revenue"),
        despesas: sumByType(monthTxs, "expense"),
      });
    }

    const ccMap = new Map<string, string>();
    costCentersData?.forEach((cc) => ccMap.set(cc.id, cc.name));

    const ccTotals = new Map<string, number>();
    currentTxs
      .filter((t) => t.type === "expense" && t.cost_center_id)
      .forEach((t) => {
        const name = ccMap.get(t.cost_center_id!) || "Outros";
        ccTotals.set(name, (ccTotals.get(name) || 0) + Number(t.amount));
      });

    const totalExpenses = curExpenses || 1;
    const costCenters: CostCenterBreakdown[] = Array.from(ccTotals.entries())
      .map(([name, amount]) => ({ name, amount, percentage: (amount / totalExpenses) * 100 }))
      .sort((a, b) => b.amount - a.amount);

    setData({
      kpis: {
        revenue: curRevenue,
        expenses: curExpenses,
        profit: curProfit,
        margin: curMargin,
        revenueChange: pctChange(curRevenue, prevRevenue),
        expensesChange: pctChange(curExpenses, prevExpenses),
        profitChange: pctChange(curProfit, prevProfit),
        marginChange: curMargin - prevMargin,
      },
      chartData,
      costCenters,
      loading: false,
    });
  }, [company]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Realtime: re-fetch when PJ transactions change
  useEffect(() => {
    if (!company?.id) return;

    const channel = supabase
      .channel(`cfo-dashboard-${company.id}`)
      .on(
        "postgres_changes" as any,
        {
          event: "*",
          schema: "public",
          table: "transactions",
          filter: `company_id=eq.${company.id}`,
        },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [company?.id, fetchData]);

  return data;
}
