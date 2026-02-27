import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface AsaasSubscription {
  id: string;
  asaas_id: string;
  customer_id: string | null;
  billing_type: string | null;
  status: string;
  value: number | null;
  next_due_date: string | null;
  cycle: string | null;
  description: string | null;
  max_payments: number | null;
  payment_count: number | null;
  external_reference: string | null;
  end_date: string | null;
  created_at: string;
}

export function useAsaasSubscriptions() {
  const { user } = useAuth();

  const { data: subscriptions = [], isLoading } = useQuery({
    queryKey: ["asaas_subscriptions", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("asaas_subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as AsaasSubscription[];
    },
    enabled: !!user?.id,
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
