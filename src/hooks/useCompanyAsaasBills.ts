import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import type { AsaasBill, AsaasInvoice } from "@/hooks/useAsaasBills";

export function useCompanyAsaasBills() {
  const { company } = useCompany();

  const { data: bills = [], isLoading: billsLoading } = useQuery({
    queryKey: ["company_asaas_bills", company?.id],
    queryFn: async () => {
      if (!company?.id) return [];
      const { data, error } = await supabase
        .from("company_asaas_bills")
        .select("*")
        .eq("company_id", company.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as AsaasBill[];
    },
    enabled: !!company?.id,
  });

  const { data: invoices = [], isLoading: invoicesLoading } = useQuery({
    queryKey: ["company_asaas_invoices", company?.id],
    queryFn: async () => {
      if (!company?.id) return [];
      const { data, error } = await supabase
        .from("company_asaas_invoices")
        .select("*")
        .eq("company_id", company.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as AsaasInvoice[];
    },
    enabled: !!company?.id,
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
    isLoading: billsLoading || invoicesLoading,
  };
}
