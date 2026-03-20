import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";

export interface BillPayable {
  id: string;
  company_id: string;
  fornecedor: string;
  descricao: string | null;
  valor: number;
  vencimento: string;
  status: string;
  source: string;
  contact_id: string | null;
  created_at: string;
  updated_at: string;
}

function computeStatus(bill: BillPayable): string {
  if (bill.status === "pago") return "pago";
  const today = new Date().toISOString().split("T")[0];
  return bill.vencimento < today ? "vencido" : "a_vencer";
}

export function useBillsPayable() {
  const { company } = useCompany();
  const queryClient = useQueryClient();
  const companyId = company?.id;

  const query = useQuery({
    queryKey: ["bills_payable", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bills_payable")
        .select("*")
        .eq("company_id", companyId!)
        .order("vencimento", { ascending: true });
      if (error) throw error;
      return (data as BillPayable[]).map((b) => ({ ...b, status: computeStatus(b) }));
    },
  });

  const createBill = useMutation({
    mutationFn: async (input: Omit<BillPayable, "id" | "company_id" | "created_at" | "updated_at">) => {
      const { error } = await supabase
        .from("bills_payable")
        .insert({ ...input, company_id: companyId! });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bills_payable", companyId] }),
  });

  return { ...query, bills: query.data ?? [], createBill };
}
