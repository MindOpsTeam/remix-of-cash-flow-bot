import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";

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
