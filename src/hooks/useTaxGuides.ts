import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { toast } from "sonner";

export interface TaxGuide {
  id: string;
  company_id: string;
  tipo: string;
  competencia: string;
  vencimento: string;
  valor: number;
  status: string;
  source: string;
  invoice_id: string | null;
  created_at: string;
  updated_at: string;
}

export type TaxGuideInput = {
  tipo: string;
  competencia: string;
  vencimento: string;
  valor: number;
  status?: string;
  source?: string;
};

function computeStatus(guide: { status: string; vencimento: string }): string {
  if (guide.status === "pago") return "pago";
  const today = new Date().toISOString().split("T")[0];
  return guide.vencimento < today ? "atrasado" : "a_pagar";
}

export function useTaxGuides() {
  const { company } = useCompany();
  const queryClient = useQueryClient();
  const companyId = company?.id;
  const qk = ["tax_guides", companyId];

  const query = useQuery({
    queryKey: qk,
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tax_guides")
        .select("*")
        .eq("company_id", companyId!)
        .order("vencimento", { ascending: true });
      if (error) throw error;
      return (data as TaxGuide[]).map((g) => ({ ...g, status: computeStatus(g) }));
    },
  });

  const createGuide = useMutation({
    mutationFn: async (input: TaxGuideInput) => {
      const { error } = await supabase
        .from("tax_guides")
        .insert({ ...input, company_id: companyId!, source: input.source ?? "manual" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk });
      toast.success("Guia adicionada");
    },
    onError: (e: Error) => toast.error("Erro ao criar guia: " + e.message),
  });

  const updateGuide = useMutation({
    mutationFn: async ({ id, ...fields }: Partial<TaxGuideInput> & { id: string }) => {
      const { error } = await supabase.from("tax_guides").update(fields).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk });
      toast.success("Guia atualizada");
    },
    onError: (e: Error) => toast.error("Erro ao atualizar: " + e.message),
  });

  const deleteGuide = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tax_guides").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk });
      toast.success("Guia removida");
    },
    onError: (e: Error) => toast.error("Erro ao remover: " + e.message),
  });

  const markAsPaid = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tax_guides").update({ status: "pago" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk });
      toast.success("Guia marcada como paga");
    },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  return { ...query, guides: query.data ?? [], createGuide, updateGuide, deleteGuide, markAsPaid };
}
