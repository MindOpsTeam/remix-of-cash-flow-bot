import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCompany } from "@/hooks/useCompany";
import { useRealtimeInvalidation } from "@/hooks/useRealtimeInvalidation";
import { toast } from "sonner";

export const OWNER_TX_TYPES = [
  { value: "retirada", label: "Retirada de sócio", direction: "pj_to_pf" },
  { value: "aporte", label: "Aporte de sócio", direction: "pf_to_pj" },
  { value: "pro_labore", label: "Pró-labore", direction: "pj_to_pf" },
  { value: "dividendo", label: "Distribuição de dividendos", direction: "pj_to_pf" },
  { value: "emprestimo_pf_pj", label: "Empréstimo do sócio → empresa", direction: "pf_to_pj" },
  { value: "emprestimo_pj_pf", label: "Empréstimo da empresa → sócio", direction: "pj_to_pf" },
] as const;

export type OwnerTxType = (typeof OWNER_TX_TYPES)[number]["value"];

export interface OwnerTransaction {
  id: string;
  transaction_type: OwnerTxType;
  amount: number;
  date: string;
  description: string | null;
  company_id: string;
  user_id: string;
  pj_bank_account_id: string | null;
  pj_transaction_id: string | null;
  status: string;
  created_at: string;
}

export interface OwnerTransactionFormData {
  transaction_type: OwnerTxType;
  amount: number;
  date: string;
  description?: string;
  pj_bank_account_id?: string | null;
}

export function useOwnerTransactions() {
  const { user } = useAuth();
  const { company } = useCompany();
  const queryClient = useQueryClient();

  const realtimeConfigs = useMemo(() => {
    if (!user?.id) return [];
    return [{
      table: "owner_transactions",
      filter: `user_id=eq.${user.id}`,
      queryKeys: [
        ["owner_transactions"],
        ["transactions"],
      ],
    }];
  }, [user?.id]);

  useRealtimeInvalidation(`owner-tx-${user?.id}`, realtimeConfigs);

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ["owner_transactions", user?.id, company?.id],
    queryFn: async () => {
      if (!user?.id || !company?.id) return [];
      const { data, error } = await supabase
        .from("owner_transactions")
        .select("*")
        .eq("user_id", user.id)
        .eq("company_id", company.id)
        .order("date", { ascending: false });

      if (error) throw error;
      return (data ?? []) as OwnerTransaction[];
    },
    enabled: !!user?.id && !!company?.id,
  });

  const summary = useMemo(() => {
    const pjToPf = transactions
      .filter((t) => ["retirada", "pro_labore", "dividendo", "emprestimo_pj_pf"].includes(t.transaction_type))
      .reduce((s, t) => s + Number(t.amount), 0);
    const pfToPj = transactions
      .filter((t) => ["aporte", "emprestimo_pf_pj"].includes(t.transaction_type))
      .reduce((s, t) => s + Number(t.amount), 0);
    return {
      pjToPf,
      pfToPj,
      netFlow: pfToPj - pjToPf,
      count: transactions.length,
    };
  }, [transactions]);

  const createMutation = useMutation({
    mutationFn: async (data: OwnerTransactionFormData) => {
      if (!user?.id || !company?.id) throw new Error("Não autenticado ou sem empresa");
      // user_id é derivado do JWT pelo backend — não enviamos mais
      const { data: result, error } = await supabase.functions.invoke("owner-transactions", {
        body: {
          ...data,
          company_id: company.id,
        },
      });
      if (error) throw error;
      if (result?.error) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["owner_transactions"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      toast.success("Transferência sócio ↔ empresa registrada!");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Erro ao registrar transferência");
    },
  });

  return {
    transactions,
    isLoading,
    summary,
    createTransaction: createMutation.mutate,
    isCreating: createMutation.isPending,
  };
}
