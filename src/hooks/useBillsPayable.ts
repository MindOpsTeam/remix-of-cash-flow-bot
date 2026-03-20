import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { toast } from "sonner";

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

export type BillInput = {
  fornecedor: string;
  descricao?: string | null;
  valor: number;
  vencimento: string;
  status?: string;
  source?: string;
  contact_id?: string | null;
};

function computeStatus(bill: { status: string; vencimento: string }): string {
  if (bill.status === "pago") return "pago";
  const today = new Date().toISOString().split("T")[0];
  return bill.vencimento < today ? "vencido" : "a_vencer";
}

export function useBillsPayable() {
  const { company } = useCompany();
  const queryClient = useQueryClient();
  const companyId = company?.id;
  const qk = ["bills_payable", companyId];

  const query = useQuery({
    queryKey: qk,
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
    mutationFn: async (input: BillInput) => {
      const { error } = await supabase
        .from("bills_payable")
        .insert({ ...input, company_id: companyId!, source: input.source ?? "manual" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk });
      toast.success("Conta adicionada");
    },
    onError: (e: Error) => toast.error("Erro ao criar conta: " + e.message),
  });

  const updateBill = useMutation({
    mutationFn: async ({ id, ...fields }: Partial<BillInput> & { id: string }) => {
      const { error } = await supabase.from("bills_payable").update(fields).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk });
      toast.success("Conta atualizada");
    },
    onError: (e: Error) => toast.error("Erro ao atualizar: " + e.message),
  });

  const deleteBill = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("bills_payable").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk });
      toast.success("Conta removida");
    },
    onError: (e: Error) => toast.error("Erro ao remover: " + e.message),
  });

  const markAsPaid = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("bills_payable").update({ status: "pago" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk });
      toast.success("Conta marcada como paga");
    },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  return { ...query, bills: query.data ?? [], createBill, updateBill, deleteBill, markAsPaid };
}
