import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface AsaasTransfer {
  id: string;
  asaas_id: string;
  type: string | null;
  status: string;
  value: number | null;
  net_value: number | null;
  fee: number | null;
  transfer_fee: number | null;
  description: string | null;
  bank_account: any;
  scheduled_date: string | null;
  transaction_receipt_url: string | null;
  authorized: boolean | null;
  operation_type: string | null;
  external_reference: string | null;
  created_at: string;
}

export interface AsaasAnticipation {
  id: string;
  asaas_id: string;
  status: string;
  anticipated_value: number | null;
  net_value: number | null;
  fee: number | null;
  total_value: number | null;
  installment_count: number | null;
  payment_id: string | null;
  anticipation_date: string | null;
  credit_date: string | null;
  debit_date: string | null;
  due_date: string | null;
  denial_reason: string | null;
  created_at: string;
}

export function useAsaasTransfers() {
  const { user } = useAuth();

  const { data: transfers = [], isLoading: transfersLoading } = useQuery({
    queryKey: ["asaas_transfers", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("asaas_transfers")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as AsaasTransfer[];
    },
    enabled: !!user?.id,
  });

  const { data: anticipations = [], isLoading: anticipationsLoading } = useQuery({
    queryKey: ["asaas_anticipations", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("asaas_anticipations")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as AsaasAnticipation[];
    },
    enabled: !!user?.id,
  });

  const transfersSummary = useMemo(() => {
    const total = transfers.reduce((s, t) => s + Number(t.value || 0), 0);
    const fees = transfers.reduce((s, t) => s + Number(t.fee || 0) + Number(t.transfer_fee || 0), 0);
    const pending = transfers.filter((t) => !["DONE", "CANCELLED", "FAILED"].includes(t.status)).length;
    return { total, fees, pending, count: transfers.length };
  }, [transfers]);

  const anticipationsSummary = useMemo(() => {
    const total = anticipations.reduce((s, a) => s + Number(a.anticipated_value || 0), 0);
    const fees = anticipations.reduce((s, a) => s + Number(a.fee || 0), 0);
    const pending = anticipations.filter((a) => !["CREDITED", "CANCELLED", "DENIED"].includes(a.status)).length;
    return { total, fees, pending, count: anticipations.length };
  }, [anticipations]);

  return {
    transfers,
    anticipations,
    transfersSummary,
    anticipationsSummary,
    isLoading: transfersLoading || anticipationsLoading,
  };
}
