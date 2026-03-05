import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useEffect, useRef } from "react";

export interface PersonalAccount {
  id: string;
  user_id: string;
  name: string;
  type: string;
  bank_name: string | null;
  current_balance: number;
  initial_balance: number;
  icon: string | null;
  color: string | null;
  owner: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PersonalAccountFormData {
  name: string;
  type: string;
  bank_name?: string | null;
  initial_balance: number;
  current_balance: number;
  icon?: string | null;
  color?: string | null;
  owner?: string | null;
}

export function usePersonalAccounts() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const autoCreatingRef = useRef(false);

  const accountsQuery = useQuery({
    queryKey: ["personal_accounts", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("personal_accounts")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as PersonalAccount[];
    },
    enabled: !!user,
  });

  // Auto-create default account if none exists
  useEffect(() => {
    if (
      !user ||
      accountsQuery.isLoading ||
      !accountsQuery.data ||
      accountsQuery.data.length > 0 ||
      autoCreatingRef.current
    )
      return;

    autoCreatingRef.current = true;
    supabase
      .from("personal_accounts")
      .insert({
        user_id: user.id,
        name: "Carteira",
        type: "checking",
        initial_balance: 0,
        current_balance: 0,
      })
      .then(({ error }) => {
        if (!error) {
          queryClient.invalidateQueries({ queryKey: ["personal_accounts"] });
        }
        autoCreatingRef.current = false;
      });
  }, [user, accountsQuery.isLoading, accountsQuery.data, queryClient]);

  const createMutation = useMutation({
    mutationFn: async (data: PersonalAccountFormData) => {
      if (!user) throw new Error("Não autenticado");
      const { error } = await supabase.from("personal_accounts").insert({
        user_id: user.id,
        name: data.name,
        type: data.type,
        bank_name: data.bank_name || null,
        initial_balance: data.initial_balance,
        current_balance: data.current_balance,
        icon: data.icon || null,
        color: data.color || null,
        owner: data.owner || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personal_accounts"] });
      toast.success("Conta criada com sucesso!");
    },
    onError: () => toast.error("Erro ao criar conta"),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<PersonalAccountFormData> }) => {
      if (!user) throw new Error("Não autenticado");
      const { error } = await supabase.from("personal_accounts").update(data).eq("id", id).eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personal_accounts"] });
      toast.success("Conta atualizada!");
    },
    onError: () => toast.error("Erro ao atualizar conta"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error("Não autenticado");
      const { error } = await supabase.from("personal_accounts").update({ is_active: false }).eq("id", id).eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personal_accounts"] });
      toast.success("Conta excluída!");
    },
    onError: () => toast.error("Erro ao excluir conta"),
  });

  const accounts = accountsQuery.data ?? [];
  const totalBalance = accounts.reduce((sum, a) => sum + Number(a.current_balance), 0);

  return {
    accounts,
    isLoading: accountsQuery.isLoading,
    totalBalance,
    summary: {
      totalBalance,
      accountCount: accounts.length,
      highestBalance: accounts.length > 0 ? Math.max(...accounts.map((a) => Number(a.current_balance))) : 0,
      lowestBalance: accounts.length > 0 ? Math.min(...accounts.map((a) => Number(a.current_balance))) : 0,
    },
    createAccount: createMutation.mutate,
    updateAccount: updateMutation.mutate,
    deleteAccount: deleteMutation.mutate,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
