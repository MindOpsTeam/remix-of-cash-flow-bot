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

  // Check if user has active Asaas config
  const asaasConfigQuery = useQuery({
    queryKey: ["asaas_config_exists", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("asaas_config")
        .select("id, environment")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Fetch Asaas balance via edge function
  const asaasBalanceQuery = useQuery({
    queryKey: ["asaas_balance", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("asaas-api", {
        body: { action: "test-connection" },
      });
      if (error) throw error;
      return data as { balance?: number; [key: string]: unknown };
    },
    enabled: !!user && !!asaasConfigQuery.data,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const hasAsaas = !!asaasConfigQuery.data && !!asaasBalanceQuery.data;
  const asaasBalance = asaasBalanceQuery.data?.balance ?? 0;

  const asaasAccount: PersonalAccount | null = hasAsaas
    ? {
        id: "asaas-virtual",
        user_id: user?.id ?? "",
        name: "Conta Asaas",
        type: "gateway",
        bank_name: "Asaas",
        current_balance: asaasBalance,
        initial_balance: 0,
        icon: "zap",
        color: "#00C853",
        owner: null,
        is_active: true,
        created_at: "",
        updated_at: "",
      }
    : null;

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
  const manualBalance = accounts.reduce((sum, a) => sum + Number(a.current_balance), 0);
  const totalBalance = manualBalance + (hasAsaas ? asaasBalance : 0);

  return {
    accounts,
    isLoading: accountsQuery.isLoading,
    totalBalance,
    hasAsaas,
    asaasAccount,
    asaasLoading: asaasBalanceQuery.isLoading && !!asaasConfigQuery.data,
    summary: {
      totalBalance,
      accountCount: accounts.length + (hasAsaas ? 1 : 0),
      highestBalance: Math.max(
        ...(accounts.length > 0 ? accounts.map((a) => Number(a.current_balance)) : [0]),
        hasAsaas ? asaasBalance : 0
      ),
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
