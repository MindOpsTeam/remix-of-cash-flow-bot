import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import type { AsaasTransfer, AsaasAnticipation } from "@/types/asaas";

export function useCompanyAsaasTransfers() {
  const { company } = useCompany();

  const { data: transfers = [], isLoading: transfersLoading } = useQuery({
    queryKey: ["company_asaas_transfers", company?.id],
    queryFn: async () => {
      if (!company?.id) return [];
      const { data, error } = await supabase
        .from("company_asaas_transfers")
        .select("*")
        .eq("company_id", company.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as AsaasTransfer[];
    },
    enabled: !!company?.id,
  });

  const { data: anticipations = [], isLoading: anticipationsLoading } = useQuery({
    queryKey: ["company_asaas_anticipations", company?.id],
    queryFn: async () => {
      if (!company?.id) return [];
      const { data, error } = await supabase
        .from("company_asaas_anticipations")
        .select("*")
        .eq("company_id", company.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as AsaasAnticipation[];
    },
    enabled: !!company?.id,
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
