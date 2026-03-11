import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRealtimeInvalidation } from "@/hooks/useRealtimeInvalidation";
import { toast } from "sonner";

export interface PersonalTransfer {
  id: string;
  user_id: string;
  from_account_id: string;
  to_account_id: string;
  amount: number;
  date: string;
  description: string | null;
  status: string;
  created_at: string;
  from_account?: { id: string; name: string } | null;
  to_account?: { id: string; name: string } | null;
}

export interface PersonalTransferFormData {
  from_account_id: string;
  to_account_id: string;
  amount: number;
  date: string;
  description?: string | null;
}

export function usePersonalTransfers() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const realtimeConfigs = useMemo(() => {
    if (!user?.id) return [];
    return [{
      table: "personal_transfers",
      filter: `user_id=eq.${user.id}`,
      queryKeys: [
        ["personal_transfers"],
        ["personal_accounts"],
      ],
    }];
  }, [user?.id]);

  useRealtimeInvalidation(`personal-transfers-${user?.id}`, realtimeConfigs);

  const { data: transfers = [], isLoading } = useQuery({
    queryKey: ["personal_transfers", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("personal_transfers")
        .select(
          "*, from_account:personal_accounts!personal_transfers_from_account_id_fkey(id, name), to_account:personal_accounts!personal_transfers_to_account_id_fkey(id, name)"
        )
        .eq("user_id", user.id)
        .order("date", { ascending: false });
      if (error) throw error;
      return data as PersonalTransfer[];
    },
    enabled: !!user?.id,
  });

  const createMutation = useMutation({
    mutationFn: async (data: PersonalTransferFormData) => {
      if (!user?.id) throw new Error("Não autenticado");
      if (data.from_account_id === data.to_account_id) {
        throw new Error("Conta de origem e destino devem ser diferentes");
      }
      if (data.amount <= 0) {
        throw new Error("Valor deve ser maior que zero");
      }
      const { error } = await supabase.from("personal_transfers").insert({
        user_id: user.id,
        from_account_id: data.from_account_id,
        to_account_id: data.to_account_id,
        amount: data.amount,
        date: data.date,
        description: data.description || null,
        status: "confirmed",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personal_transfers"] });
      queryClient.invalidateQueries({ queryKey: ["personal_accounts"] });
      toast.success("Transferência realizada!");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Erro ao transferir");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!user?.id) throw new Error("Não autenticado");
      const { error } = await supabase
        .from("personal_transfers")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personal_transfers"] });
      queryClient.invalidateQueries({ queryKey: ["personal_accounts"] });
      toast.success("Transferência excluída!");
    },
    onError: () => toast.error("Erro ao excluir transferência"),
  });

  return {
    transfers,
    isLoading,
    createTransfer: createMutation.mutate,
    deleteTransfer: deleteMutation.mutate,
    isCreating: createMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
