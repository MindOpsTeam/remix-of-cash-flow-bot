import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { startOfMonth, subMonths, format } from "date-fns";

interface KPIs {
  entradas_mes: number;
  saidas_mes: number;
  saldo_mes: number;
  taxas_mes: number;
  vencidas: number;
  vencidas_count: number;
}

interface MonthComparison {
  receita_atual: number;
  despesa_atual: number;
  receita_anterior: number;
  despesa_anterior: number;
}

interface MonthlyData {
  month: string;
  receita: number;
  despesa: number;
  resultado: number;
}

export function usePersonalKPIs() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Realtime subscription on asaas_payments for dashboard auto-refresh
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel("dashboard-asaas-payments")
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "asaas_payments",
        filter: `user_id=eq.${user.id}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["asaas_payments_kpis"] });
        queryClient.invalidateQueries({ queryKey: ["personal_kpis"] });
        queryClient.invalidateQueries({ queryKey: ["personal_month_compare"] });
        queryClient.invalidateQueries({ queryKey: ["personal_monthly_chart"] });
        queryClient.invalidateQueries({ queryKey: ["asaas_balance"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, queryClient]);

  const { data: kpis, isLoading: kpisLoading } = useQuery({
    queryKey: ["personal_kpis", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await (supabase as any)
        .from("v_personal_kpis")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data as KPIs | null;
    },
    enabled: !!user?.id,
  });

  const { data: comparison, isLoading: compLoading } = useQuery({
    queryKey: ["personal_month_compare", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await (supabase as any)
        .from("v_personal_month_compare")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data as MonthComparison | null;
    },
    enabled: !!user?.id,
  });

  // Fetch Asaas payments (RECEIVED/CONFIRMED)
  const { data: asaasPayments = [], isLoading: asaasLoading } = useQuery({
    queryKey: ["asaas_payments_kpis", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const sixMonthsAgo = startOfMonth(subMonths(new Date(), 5));
      const { data, error } = await supabase
        .from("asaas_payments")
        .select("net_value, value, confirmed_date, payment_date, due_date, status")
        .eq("user_id", user.id)
        .in("status", ["RECEIVED", "CONFIRMED"])
        .gte("confirmed_date", sixMonthsAgo.toISOString().split("T")[0]);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Last 6 months data for chart (manual transactions)
  const { data: monthlyData = [], isLoading: monthlyLoading } = useQuery({
    queryKey: ["personal_monthly_chart", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const sixMonthsAgo = startOfMonth(subMonths(new Date(), 5));
      const { data, error } = await supabase
        .from("personal_transactions")
        .select("date, type, amount")
        .eq("user_id", user.id)
        .gte("date", sixMonthsAgo.toISOString().split("T")[0])
        .order("date", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Calculate Asaas additions to KPIs
  const asaasKpiAdditions = useMemo(() => {
    const now = new Date();
    const currentMonth = format(now, "yyyy-MM");

    let asaasEntradasMes = 0;
    let asaasTaxasMes = 0;

    asaasPayments.forEach((p: any) => {
      const pDate = p.confirmed_date || p.payment_date || p.due_date;
      if (!pDate) return;
      const pMonth = pDate.substring(0, 7);
      if (pMonth === currentMonth) {
        asaasEntradasMes += Number(p.net_value || 0);
        asaasTaxasMes += Number(p.value || 0) - Number(p.net_value || 0);
      }
    });

    return { asaasEntradasMes, asaasTaxasMes };
  }, [asaasPayments]);

  const chartData: MonthlyData[] = useMemo(() => {
    const months: Record<string, { receita: number; despesa: number }> = {};
    for (let i = 5; i >= 0; i--) {
      const m = format(subMonths(new Date(), i), "yyyy-MM");
      months[m] = { receita: 0, despesa: 0 };
    }
    // Manual transactions
    monthlyData.forEach((t: any) => {
      const m = t.date?.substring(0, 7);
      if (m && months[m]) {
        if (t.type === "receita") months[m].receita += Number(t.amount);
        else months[m].despesa += Number(t.amount);
      }
    });
    // Asaas payments as receita
    asaasPayments.forEach((p: any) => {
      const pDate = p.confirmed_date || p.payment_date || p.due_date;
      if (!pDate) return;
      const m = pDate.substring(0, 7);
      if (m && months[m]) {
        months[m].receita += Number(p.net_value || 0);
      }
    });
    return Object.entries(months).map(([month, v]) => ({
      month: format(new Date(month + "-01"), "MMM"),
      receita: v.receita,
      despesa: v.despesa,
      resultado: v.receita - v.despesa,
    }));
  }, [monthlyData, asaasPayments]);

  const defaultKpis: KPIs = {
    entradas_mes: 0, saidas_mes: 0, saldo_mes: 0,
    taxas_mes: 0, vencidas: 0, vencidas_count: 0,
  };

  const defaultComparison: MonthComparison = {
    receita_atual: 0, despesa_atual: 0,
    receita_anterior: 0, despesa_anterior: 0,
  };

  // Merge base KPIs with Asaas additions
  const baseKpis = kpis || defaultKpis;
  const mergedKpis: KPIs = {
    ...baseKpis,
    entradas_mes: baseKpis.entradas_mes + asaasKpiAdditions.asaasEntradasMes,
    saldo_mes: baseKpis.saldo_mes + asaasKpiAdditions.asaasEntradasMes,
    taxas_mes: baseKpis.taxas_mes + asaasKpiAdditions.asaasTaxasMes,
  };

  return {
    kpis: mergedKpis,
    comparison: comparison || defaultComparison,
    chartData,
    isLoading: kpisLoading || compLoading || monthlyLoading || asaasLoading,
  };
}

function fmt(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

export function generateInsight(kpis: KPIs, comparison: MonthComparison): string {
  const insights: string[] = [];

  if (kpis.vencidas > 0)
    insights.push(`Você tem ${fmt(kpis.vencidas)} em cobranças vencidas. Envie lembretes para reduzir inadimplência.`);

  if (comparison.receita_anterior > 0) {
    const growth = ((comparison.receita_atual - comparison.receita_anterior) / comparison.receita_anterior * 100);
    if (growth > 10)
      insights.push(`Sua receita cresceu ${growth.toFixed(0)}% este mês. Bom ritmo! 📈`);
    if (growth < -10)
      insights.push(`Sua receita caiu ${Math.abs(growth).toFixed(0)}% este mês. Verifique suas cobranças pendentes.`);
  }

  if (kpis.entradas_mes > 0) {
    const taxRate = kpis.taxas_mes / kpis.entradas_mes * 100;
    if (taxRate > 5)
      insights.push(`Suas taxas de gateway estão em ${taxRate.toFixed(1)}% da receita. Considere priorizar Pix para reduzir custos.`);
  }

  if (kpis.saldo_mes < 0)
    insights.push(`⚠️ Seu saldo do mês está negativo. Suas despesas superaram suas receitas em ${fmt(Math.abs(kpis.saldo_mes))}.`);

  return insights[0] || `Tudo certo! Seu saldo do mês está positivo em ${fmt(kpis.saldo_mes)}.`;
}
