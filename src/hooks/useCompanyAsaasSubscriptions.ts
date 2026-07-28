import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import type { AsaasSubscription } from "@/types/asaas";

export function useCompanyAsaasSubscriptions() {
  const { company } = useCompany();

  const { data: subscriptions = [], isLoading } = useQuery({
    queryKey: ["company_asaas_subscriptions", company?.id],
    queryFn: async () => {
      if (!company?.id) return [];
      const { data, error } = await supabase
        .from("company_asaas_subscriptions")
        .select("*")
        .eq("company_id", company.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as AsaasSubscription[];
    },
    enabled: !!company?.id,
  });

  const summary = useMemo(() => {
    const active = subscriptions.filter((s) => s.status === "ACTIVE");
    const mrr = active
      .filter((s) => s.cycle === "MONTHLY")
      .reduce((sum, s) => sum + Number(s.value || 0), 0);
    const nextDue = active
      .map((s) => s.next_due_date)
      .filter(Boolean)
      .sort()[0] || null;
    return { activeCount: active.length, mrr, nextDue, total: subscriptions.length };
  }, [subscriptions]);

  return { subscriptions, summary, isLoading };
}
