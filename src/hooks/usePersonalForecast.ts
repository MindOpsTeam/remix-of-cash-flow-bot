import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { addDays, format, parseISO, startOfMonth, endOfMonth, subMonths } from "date-fns";

export interface ForecastDay {
  date: string;
  label: string;
  entradas: number;
  saidas: number;
  saldo: number;
}

export function usePersonalForecast() {
  const { user } = useAuth();
  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");
  const in30Str = format(addDays(today, 30), "yyyy-MM-dd");

  // 1. Future personal_transactions (pending bills / scheduled)
  const { data: futureTx = [], isLoading: futureTxLoading } = useQuery({
    queryKey: ["personal_forecast_future_tx", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("personal_transactions")
        .select("date, amount, type, status, is_recurring")
        .eq("user_id", user.id)
        .in("status", ["pending", "confirmed"])
        .gte("date", todayStr)
        .lte("date", in30Str);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // 2. Recurring transactions (project day-of-month for next 30 days)
  const { data: recurringTx = [], isLoading: recurringLoading } = useQuery({
    queryKey: ["personal_forecast_recurring", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("personal_transactions")
        .select("date, amount, type")
        .eq("user_id", user.id)
        .eq("is_recurring", true)
        .order("date", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // 3. Asaas pending payments (receivables in next 30 days)
  const { data: pendingPayments = [], isLoading: paymentsLoading } = useQuery({
    queryKey: ["personal_forecast_payments", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("asaas_payments")
        .select("due_date, value, status")
        .eq("user_id", user.id)
        .in("status", ["PENDING", "CONFIRMED"])
        .gte("due_date", todayStr)
        .lte("due_date", in30Str);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // 4. Asaas pending bills (payables in next 30 days)
  const { data: pendingBills = [], isLoading: billsLoading } = useQuery({
    queryKey: ["personal_forecast_bills", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("asaas_bills")
        .select("due_date, value, status")
        .eq("user_id", user.id)
        .in("status", ["PENDING", "BANK_PROCESSING"])
        .gte("due_date", todayStr)
        .lte("due_date", in30Str);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // 5. Historical data (last 3 months for context)
  const { data: historicalTx = [], isLoading: histLoading } = useQuery({
    queryKey: ["personal_forecast_history", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const threeMonthsAgo = format(startOfMonth(subMonths(today, 3)), "yyyy-MM-dd");
      const endLastMonth = format(endOfMonth(subMonths(today, 1)), "yyyy-MM-dd");
      const { data, error } = await supabase
        .from("personal_transactions")
        .select("date, amount, type")
        .eq("user_id", user.id)
        .eq("status", "confirmed")
        .gte("date", threeMonthsAgo)
        .lte("date", endLastMonth);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  const forecastData = useMemo(() => {
    const days: ForecastDay[] = [];
    let cumSaldo = 0;

    const dailyEntradas: Record<string, number> = {};
    const dailySaidas: Record<string, number> = {};

    // Track dates already covered by explicit future transactions to avoid duplication with recurring
    const coveredDates = new Set<string>();

    // A. Future personal_transactions (explicit scheduled entries)
    futureTx.forEach((t: any) => {
      if (!t.date) return;
      const key = t.date;
      coveredDates.add(key);
      const amount = Math.abs(Number(t.amount));
      if (t.type === "receita") {
        dailyEntradas[key] = (dailyEntradas[key] || 0) + amount;
      } else {
        dailySaidas[key] = (dailySaidas[key] || 0) + amount;
      }
    });

    // B. Recurring transactions: project day-of-month only for days NOT already covered
    recurringTx.forEach((t: any) => {
      const dayOfMonth = parseISO(t.date).getDate();
      for (let i = 0; i < 30; i++) {
        const d = addDays(today, i);
        const key = format(d, "yyyy-MM-dd");
        if (d.getDate() === dayOfMonth && !coveredDates.has(key)) {
          const amount = Math.abs(Number(t.amount));
          if (t.type === "receita") {
            dailyEntradas[key] = (dailyEntradas[key] || 0) + amount;
          } else {
            dailySaidas[key] = (dailySaidas[key] || 0) + amount;
          }
        }
      }
    });

    // C. Asaas pending payments (receivables)
    pendingPayments.forEach((p: any) => {
      if (p.due_date) {
        const key = p.due_date;
        dailyEntradas[key] = (dailyEntradas[key] || 0) + Math.abs(Number(p.value || 0));
      }
    });

    // D. Asaas pending bills (payables)
    pendingBills.forEach((b: any) => {
      if (b.due_date) {
        const key = b.due_date;
        dailySaidas[key] = (dailySaidas[key] || 0) + Math.abs(Number(b.value || 0));
      }
    });

    // Build daily forecast
    for (let i = 0; i < 30; i++) {
      const d = addDays(today, i);
      const key = format(d, "yyyy-MM-dd");
      const entradas = dailyEntradas[key] || 0;
      const saidas = dailySaidas[key] || 0;
      cumSaldo += entradas - saidas;
      days.push({
        date: key,
        label: format(d, "dd/MM"),
        entradas,
        saidas,
        saldo: cumSaldo,
      });
    }

    return days;
  }, [futureTx, recurringTx, pendingPayments, pendingBills]);

  // Monthly history for chart context
  const monthlyHistory = useMemo(() => {
    const months: Record<string, { receita: number; despesa: number }> = {};
    historicalTx.forEach((t: any) => {
      const key = t.date.slice(0, 7);
      if (!months[key]) months[key] = { receita: 0, despesa: 0 };
      const amount = Math.abs(Number(t.amount));
      if (t.type === "receita") months[key].receita += amount;
      else months[key].despesa += amount;
    });
    return Object.entries(months)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, val]) => ({
        month: key,
        receita: val.receita,
        despesa: val.despesa,
        resultado: val.receita - val.despesa,
      }));
  }, [historicalTx]);

  const totals = useMemo(() => {
    const totalEntradas = forecastData.reduce((s, d) => s + d.entradas, 0);
    const totalSaidas = forecastData.reduce((s, d) => s + d.saidas, 0);
    return {
      entradas: totalEntradas,
      saidas: totalSaidas,
      saldo: totalEntradas - totalSaidas,
    };
  }, [forecastData]);

  return {
    forecastData,
    monthlyHistory,
    totals,
    isLoading: futureTxLoading || recurringLoading || paymentsLoading || billsLoading || histLoading,
  };
}
