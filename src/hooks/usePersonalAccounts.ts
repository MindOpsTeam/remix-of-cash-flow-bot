import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

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

  const accountsQuery = useQuery({
    queryKey: ["personal_accounts", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("personal_accounts")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as PersonalAccount[];
    },
    enabled: !!user,
  });

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
      const { error } = await supabase.from("personal_accounts").update(data).eq("id", id);
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
      const { error } = await supabase.from("personal_accounts").update({ is_active: false }).eq("id", id);
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
