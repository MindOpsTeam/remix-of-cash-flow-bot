import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { addDays, format, parseISO } from "date-fns";

export interface ForecastDay {
  date: string;
  label: string;
  entradas: number;
  saidas: number;
  saldo: number;
}

export function usePersonalForecast() {
  const { user } = useAuth();

  // Pending Asaas payments (due in next 30 days)
  const { data: pendingPayments = [], isLoading: paymentsLoading } = useQuery({
    queryKey: ["personal_forecast_payments", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const today = new Date().toISOString().split("T")[0];
      const in30 = addDays(new Date(), 30).toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("asaas_payments")
        .select("due_date, value, status")
        .eq("user_id", user.id)
        .in("status", ["PENDING", "CONFIRMED"])
        .gte("due_date", today)
        .lte("due_date", in30);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Recurring transactions
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

  const forecastData = useMemo(() => {
    const today = new Date();
    const days: ForecastDay[] = [];
    let cumSaldo = 0;

    // Build daily map
    const dailyEntradas: Record<string, number> = {};
    const dailySaidas: Record<string, number> = {};

    // Asaas pending payments as entradas
    pendingPayments.forEach((p: any) => {
      if (p.due_date) {
        const key = p.due_date;
        dailyEntradas[key] = (dailyEntradas[key] || 0) + Number(p.value || 0);
      }
    });

    // Recurring transactions: project them for the next 30 days using day-of-month
    recurringTx.forEach((t: any) => {
      const dayOfMonth = parseISO(t.date).getDate();
      for (let i = 0; i < 30; i++) {
        const d = addDays(today, i);
        if (d.getDate() === dayOfMonth) {
          const key = format(d, "yyyy-MM-dd");
          if (t.type === "receita") {
            dailyEntradas[key] = (dailyEntradas[key] || 0) + Number(t.amount);
          } else {
            dailySaidas[key] = (dailySaidas[key] || 0) + Number(t.amount);
          }
        }
      }
    });

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
  }, [pendingPayments, recurringTx]);

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
    totals,
    isLoading: paymentsLoading || recurringLoading,
  };
}
