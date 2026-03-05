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
      return data as { ok: boolean; data?: { totalBalance?: number } };
    },
    enabled: !!user && !!asaasConfigQuery.data,
    staleTime: 5 * 60 * 1000,
  });

  // Fallback: sum net_value from asaas_payments with RECEIVED/CONFIRMED status
  const asaasFallbackQuery = useQuery({
    queryKey: ["asaas_payments_fallback_balance", user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { data, error } = await supabase
        .from("asaas_payments")
        .select("net_value")
        .eq("user_id", user.id)
        .in("status", ["RECEIVED", "CONFIRMED"]);
      if (error) throw error;
      return (data || []).reduce((sum, p) => sum + (Number(p.net_value) || 0), 0);
    },
    enabled: !!user && !!asaasConfigQuery.data,
    staleTime: 5 * 60 * 1000,
  });

  // Determine Asaas balance: prefer API, fallback to sum of payments
  const apiBalance = asaasBalanceQuery.data?.data?.totalBalance;
  const hasApiBalance = typeof apiBalance === "number" && apiBalance > 0;
  const fallbackBalance = asaasFallbackQuery.data ?? 0;
  const asaasBalance = hasApiBalance ? apiBalance : fallbackBalance;
  const hasAsaas = !!asaasConfigQuery.data && (hasApiBalance || fallbackBalance > 0);

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
