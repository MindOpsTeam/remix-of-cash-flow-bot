import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface AsaasBill {
  id: string;
  asaas_id: string;
  status: string;
  value: number | null;
  fee: number | null;
  description: string | null;
  company_name: string | null;
  identification_field: string | null;
  type: string | null;
  due_date: string | null;
  schedule_date: string | null;
  payment_date: string | null;
  can_be_cancelled: boolean | null;
  failure_reason: string | null;
  created_at: string;
  // Unified fields
  _source?: "asaas" | "manual";
}

export interface AsaasInvoice {
  id: string;
  asaas_id: string;
  payment_id: string | null;
  status: string;
  number: string | null;
  service_description: string | null;
  value: number | null;
  net_value: number | null;
  observations: string | null;
  taxes: any;
  customer_id: string | null;
  effective_date: string | null;
  pdf_url: string | null;
  xml_url: string | null;
  error_message: string | null;
  created_at: string;
}

export function useAsaasBills() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Asaas bills
  const { data: asaasBills = [], isLoading: billsLoading } = useQuery({
    queryKey: ["asaas_bills", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("asaas_bills")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as any[]).map((b) => ({ ...b, _source: "asaas" as const })) as AsaasBill[];
    },
    enabled: !!user?.id,
  });

  // Manual pending bills from personal_transactions
  const { data: manualBills = [], isLoading: manualLoading } = useQuery({
    queryKey: ["personal_bills_pending", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("personal_transactions")
        .select("id, title, description, amount, date, status, created_at, account_id, credit_card_id, personal_accounts(name), personal_credit_cards(name)")
        .eq("user_id", user.id)
        .eq("type", "despesa")
        .eq("status", "pending")
        .order("date", { ascending: true });
      if (error) throw error;
      return (data || []).map((t: any) => ({
        id: t.id,
        asaas_id: "",
        status: "PENDING",
        value: Number(t.amount),
        fee: null,
        description: t.title || t.description,
        company_name: null,
        identification_field: null,
        type: t.credit_card_id ? "Cartão" : (t.personal_accounts as any)?.name || null,
        due_date: t.date,
        schedule_date: null,
        payment_date: null,
        can_be_cancelled: null,
        failure_reason: null,
        created_at: t.created_at,
        _source: "manual" as const,
      })) as AsaasBill[];
    },
    enabled: !!user?.id,
  });

  // Combine both sources
  const bills = useMemo(() => {
    return [...asaasBills, ...manualBills].sort((a, b) => {
      const dateA = a.due_date || a.created_at;
      const dateB = b.due_date || b.created_at;
      return dateB.localeCompare(dateA);
    });
  }, [asaasBills, manualBills]);

  const { data: invoices = [], isLoading: invoicesLoading } = useQuery({
    queryKey: ["asaas_invoices", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("asaas_invoices")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as AsaasInvoice[];
    },
    enabled: !!user?.id,
  });

  // Mark manual bill as paid
  const markPaidMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!user?.id) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("personal_transactions")
        .update({ status: "confirmed" })
        .eq("id", id)
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personal_bills_pending"] });
      queryClient.invalidateQueries({ queryKey: ["personal_transactions"] });
      toast.success("Conta marcada como paga!");
    },
    onError: () => toast.error("Erro ao atualizar conta"),
  });

  const billsSummary = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    const totalDue = bills
      .filter((b) => ["PENDING", "BANK_PROCESSING"].includes(b.status))
      .reduce((s, b) => s + Number(b.value || 0), 0);
    const overdue = bills.filter(
      (b) => b.due_date && b.due_date < today && ["PENDING"].includes(b.status)
    );
    const paidThisMonth = bills
      .filter((b) => b.status === "PAID" && b.payment_date?.startsWith(today.slice(0, 7)))
      .reduce((s, b) => s + Number(b.value || 0), 0);
    return { totalDue, overdueCount: overdue.length, paidThisMonth, count: bills.length };
  }, [bills]);

  const invoicesSummary = useMemo(() => {
    const total = invoices.reduce((s, i) => s + Number(i.value || 0), 0);
    const errorCount = invoices.filter((i) => i.status === "ERROR").length;
    return { total, count: invoices.length, errorCount };
  }, [invoices]);

  return {
    bills,
    invoices,
    billsSummary,
    invoicesSummary,
    isLoading: billsLoading || invoicesLoading || manualLoading,
    markBillAsPaid: markPaidMutation.mutate,
  };
}
