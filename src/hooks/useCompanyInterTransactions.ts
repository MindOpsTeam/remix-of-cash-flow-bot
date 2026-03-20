import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { toast } from "sonner";
import { useState } from "react";

interface InterTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: "revenue" | "expense";
  status: string;
  payment_method: string | null;
  external_id: string | null;
  source: string;
}

interface InterConfig {
  last_balance: number | null;
  last_balance_at: string | null;
  last_sync_at: string | null;
  environment: string;
  active: boolean;
}

export function useCompanyInterTransactions() {
  const { company } = useCompany();
  const queryClient = useQueryClient();
  const [syncing, setSyncing] = useState(false);

  const { data: transactions = [], isLoading: txLoading } = useQuery({
    queryKey: ["company_inter_transactions", company?.id],
    queryFn: async () => {
      if (!company?.id) return [];
      const { data, error } = await supabase
        .from("transactions")
        .select("id, date, description, amount, type, status, payment_method, external_id, source")
        .eq("company_id", company.id)
        .eq("source", "inter")
        .order("date", { ascending: false });
      if (error) throw error;
      return data as InterTransaction[];
    },
    enabled: !!company?.id,
  });

  const { data: config, isLoading: cfgLoading } = useQuery({
    queryKey: ["inter_config", company?.id],
    queryFn: async () => {
      if (!company?.id) return null;
      const { data, error } = await supabase
        .from("inter_config")
        .select("last_balance, last_balance_at, last_sync_at, environment, active")
        .eq("company_id", company.id)
        .maybeSingle();
      if (error) throw error;
      return data as InterConfig | null;
    },
    enabled: !!company?.id,
  });

  const summary = useMemo(() => {
    const totalRevenue = transactions
      .filter((t) => t.type === "revenue")
      .reduce((s, t) => s + Number(t.amount), 0);
    const totalExpense = transactions
      .filter((t) => t.type === "expense")
      .reduce((s, t) => s + Number(t.amount), 0);
    return {
      totalRevenue,
      totalExpense,
      balance: totalRevenue - totalExpense,
      count: transactions.length,
      lastBalance: config?.last_balance ?? null,
      lastSyncAt: config?.last_sync_at ?? null,
      configured: !!config,
      active: config?.active ?? false,
    };
  }, [transactions, config]);

  const groupedTransactions = useMemo(() => {
    const groups: Record<string, InterTransaction[]> = {};
    for (const t of transactions) {
      const key = t.date || "sem-data";
      if (!groups[key]) groups[key] = [];
      groups[key].push(t);
    }
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [transactions]);

  async function syncInter() {
    if (!company?.id) return;
    setSyncing(true);
    try {
      const today = new Date();
      const start = new Date(today);
      start.setDate(start.getDate() - 30);
      const startDate = start.toISOString().slice(0, 10);
      const endDate = today.toISOString().slice(0, 10);

      const { data, error } = await supabase.functions.invoke("inter-banking", {
        body: { action: "sync", company_id: company.id, start_date: startDate, end_date: endDate },
      });

      if (error) throw error;
      toast.success(`Sincronização concluída: ${data.synced} novos, ${data.reconciled ?? 0} reconciliados`);
      queryClient.invalidateQueries({ queryKey: ["company_inter_transactions", company.id] });
      queryClient.invalidateQueries({ queryKey: ["inter_config", company.id] });
    } catch (err: any) {
      toast.error("Erro ao sincronizar: " + (err.message || "Falha na conexão"));
    } finally {
      setSyncing(false);
    }
  }

  return {
    transactions,
    groupedTransactions,
    summary,
    isLoading: txLoading || cfgLoading,
    syncing,
    syncInter,
  };
}
