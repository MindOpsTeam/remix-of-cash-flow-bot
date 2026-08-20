import { mensagemDeErro } from "@/lib/erros";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { useAuth } from "@/hooks/useAuth";
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
  const { user } = useAuth();
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
    onError: (e: Error) => toast.error("Erro ao criar guia: " + mensagemDeErro(e)),
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
    onError: (e: Error) => toast.error("Erro ao atualizar: " + mensagemDeErro(e)),
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
    onError: (e: Error) => toast.error("Erro ao remover: " + mensagemDeErro(e)),
  });

  /**
   * Imposto pago é despesa. Antes daqui só mudava o status, e como o DRE lê
   * exclusivamente `transactions`, o imposto pago sumia do resultado: o dono
   * via um lucro que já tinha ido embora para a Receita Federal.
   */
  const markAsPaid = useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error("Sessão expirada");

      const { data: guia, error: leituraErr } = await supabase
        .from("tax_guides")
        .select("id, company_id, tipo, competencia, valor, status, transaction_id")
        .eq("id", id)
        .single();
      if (leituraErr) throw leituraErr;
      if (guia.status === "pago") throw new Error("Guia já paga");
      if (guia.transaction_id) throw new Error("Esta guia já tem lançamento vinculado");

      const hoje = new Date().toISOString().split("T")[0];

      const { data: tx, error: txErr } = await supabase
        .from("transactions")
        .insert({
          company_id: guia.company_id,
          user_id: user.id,
          date: hoje,
          description: `${guia.tipo} · competência ${guia.competencia}`,
          amount: Number(guia.valor),
          type: "expense",
          status: "confirmed",
          source: "tax_guide",
        })
        .select("id")
        .single();
      if (txErr) throw txErr;

      const { error } = await supabase
        .from("tax_guides")
        .update({ status: "pago", payment_date: hoje, transaction_id: tx.id })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      toast.success("Guia paga — despesa lançada no DRE");
    },
    onError: (e: Error) => toast.error("Erro: " + mensagemDeErro(e)),
  });

  return { ...query, guides: query.data ?? [], createGuide, updateGuide, deleteGuide, markAsPaid };
}
