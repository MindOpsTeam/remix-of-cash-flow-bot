import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";

export interface TaxGuide {
  id: string;
  company_id: string;
  tipo: string;
  competencia: string;
  vencimento: string;
  valor: number;
  status: string;
  source: string;
  created_at: string;
  updated_at: string;
}

function computeStatus(guide: TaxGuide): string {
  if (guide.status === "pago") return "pago";
  const today = new Date().toISOString().split("T")[0];
  return guide.vencimento < today ? "atrasado" : "a_pagar";
}

export function useTaxGuides() {
  const { company } = useCompany();
  const queryClient = useQueryClient();
  const companyId = company?.id;

  const query = useQuery({
    queryKey: ["tax_guides", companyId],
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
    mutationFn: async (input: Omit<TaxGuide, "id" | "company_id" | "created_at" | "updated_at">) => {
      const { error } = await supabase
        .from("tax_guides")
        .insert({ ...input, company_id: companyId! });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tax_guides", companyId] }),
  });

  return { ...query, guides: query.data ?? [], createGuide };
}
