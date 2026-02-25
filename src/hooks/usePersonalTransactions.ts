import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { startOfMonth, endOfMonth, subMonths, parseISO, isWithinInterval } from "date-fns";

export interface PersonalTransaction {
  id: string;
  date: string;
  title: string;
  description: string | null;
  amount: number;
  type: string;
  status: string;
  person: string | null;
  category_id: string | null;
  account_id: string | null;
  credit_card_id: string | null;
  kakeibo_group: string | null;
  is_recurring: boolean;
  created_at: string;
  personal_categories?: { id: string; name: string; icon: string | null; color: string | null } | null;
  personal_accounts?: { id: string; name: string } | null;
  personal_credit_cards?: { id: string; name: string } | null;
}

export interface PersonalTransactionFormData {
  title: string;
  amount: number;
  type: string;
  date: string;
  account_id?: string | null;
  credit_card_id?: string | null;
  category_id?: string | null;
  person?: string | null;
  description?: string | null;
  is_recurring?: boolean;
  kakeibo_group?: string | null;
}

export interface PersonalTransactionFilters {
  types: string[];
  period: "this_month" | "last_month" | "last_3_months" | "all";
  search?: string;
}

export function usePersonalTransactions() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<PersonalTransactionFilters>({
    types: [],
    period: "this_month",
  });

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ["personal_transactions", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("personal_transactions")
        .select(`*, personal_categories(id, name, icon, color), personal_accounts(id, name), personal_credit_cards(id, name)`)
        .eq("user_id", user.id)
        .order("date", { ascending: false });
      if (error) throw error;
      return data as PersonalTransaction[];
    },
    enabled: !!user?.id,
  });

  const filteredTransactions = useMemo(() => {
    let result = [...transactions];
    if (filters.types.length > 0) result = result.filter((t) => filters.types.includes(t.type));

    const now = new Date();
    let startDate: Date | null = null;
    let endDate: Date | null = null;
    if (filters.period === "this_month") {
      startDate = startOfMonth(now);
      endDate = endOfMonth(now);
    } else if (filters.period === "last_month") {
      startDate = startOfMonth(subMonths(now, 1));
      endDate = endOfMonth(subMonths(now, 1));
    } else if (filters.period === "last_3_months") {
      startDate = startOfMonth(subMonths(now, 2));
      endDate = endOfMonth(now);
    }
    if (startDate && endDate) {
      result = result.filter((t) => isWithinInterval(parseISO(t.date), { start: startDate!, end: endDate! }));
    }
    if (filters.search) {
      const s = filters.search.toLowerCase();
      result = result.filter((t) => t.title.toLowerCase().includes(s) || t.description?.toLowerCase().includes(s));
    }
    return result;
  }, [transactions, filters]);

  const summary = useMemo(() => {
    const receitas = filteredTransactions.filter((t) => t.type === "receita").reduce((s, t) => s + Number(t.amount), 0);
    const despesas = filteredTransactions.filter((t) => t.type === "despesa").reduce((s, t) => s + Number(t.amount), 0);
    return { receitas, despesas, saldo: receitas - despesas, count: filteredTransactions.length };
  }, [filteredTransactions]);

  const createMutation = useMutation({
    mutationFn: async (data: PersonalTransactionFormData) => {
      if (!user?.id) throw new Error("Não autenticado");
      const { error } = await supabase.from("personal_transactions").insert({ ...data, user_id: user.id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personal_transactions"] });
      toast.success("Transação criada!");
    },
    onError: () => toast.error("Erro ao criar transação"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!user?.id) throw new Error("Não autenticado");
      const { error } = await supabase.from("personal_transactions").delete().eq("id", id).eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personal_transactions"] });
      toast.success("Transação excluída!");
    },
    onError: () => toast.error("Erro ao excluir transação"),
  });

  return {
    transactions: filteredTransactions,
    allTransactions: transactions,
    isLoading,
    filters,
    setFilters,
    summary,
    createTransaction: createMutation.mutate,
    deleteTransaction: deleteMutation.mutate,
    isCreating: createMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
