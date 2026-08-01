import { mensagemDeErro } from "@/lib/erros";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { effectiveStatus } from "@/lib/receivables";

// contracts/receivables ainda não estão nos tipos gerados do Supabase (Lovable os
// regenera no build). Um único cast concentrado evita `any` espalhado pelo arquivo.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export interface Receivable {
  id: string;
  company_id: string;
  contact_id: string | null;
  contract_id: string | null;
  description: string;
  amount: number;
  due_date: string;
  status: string;
  source: string;
  asaas_payment_id: string | null;
  boleto_url: string | null;
  pix_url: string | null;
  stripe_checkout_url: string | null;
  stripe_payment_intent_id: string | null;
  payment_date: string | null;
  transaction_id: string | null;
  account_id: string | null;
  cost_center_id: string | null;
  created_at: string;
  updated_at: string;
}

export type ReceivableInput = {
  contact_id?: string | null;
  description: string;
  amount: number;
  due_date: string;
  account_id: string;
  cost_center_id: string;
};

export function useReceivables() {
  const { company } = useCompany();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const companyId = company?.id;
  const qk = ["receivables", companyId];

  const query = useQuery({
    queryKey: qk,
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await db
        .from("receivables")
        .select("*")
        .eq("company_id", companyId!)
        .order("due_date", { ascending: true });
      if (error) throw error;
      // status efetivo (a_receber → vencido quando passa do vencimento)
      return (data as Receivable[]).map((r) => ({ ...r, status: effectiveStatus(r) }));
    },
  });

  const createReceivable = useMutation({
    mutationFn: async (input: ReceivableInput) => {
      const { error } = await db.from("receivables").insert({
        company_id: companyId!,
        contact_id: input.contact_id ?? null,
        description: input.description,
        amount: input.amount,
        due_date: input.due_date,
        account_id: input.account_id,
        cost_center_id: input.cost_center_id,
        source: "manual",
        status: "a_receber",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk });
      toast.success("Conta a receber criada");
    },
    onError: (e: Error) => toast.error("Erro ao criar: " + mensagemDeErro(e)),
  });

  const updateReceivable = useMutation({
    mutationFn: async ({ id, ...fields }: Partial<ReceivableInput> & { id: string }) => {
      const { error } = await db.from("receivables").update(fields).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk });
      toast.success("Conta atualizada");
    },
    onError: (e: Error) => toast.error("Erro ao atualizar: " + mensagemDeErro(e)),
  });

  // Baixa manual: FECHA O LOOP no DRE — cria 1 lançamento de receita classificado
  // (type=revenue, status=confirmed, account/cost herdados) e linka no receivable.
  const markAsReceived = useMutation({
    mutationFn: async (r: Receivable) => {
      if (r.status === "recebido") throw new Error("Conta já recebida");
      if (r.status === "cancelado") throw new Error("Conta cancelada");
      if (!r.account_id || !r.cost_center_id) {
        throw new Error("Defina conta contábil e centro de custo antes de dar baixa");
      }
      if (!user) throw new Error("Sessão expirada");
      const today = new Date().toISOString().split("T")[0];

      const { data: tx, error: txErr } = await db
        .from("transactions")
        .insert({
          company_id: r.company_id,
          user_id: user.id,
          date: today,
          description: r.description,
          amount: r.amount,
          type: "revenue",
          account_id: r.account_id,
          cost_center_id: r.cost_center_id,
          status: "confirmed",
          source: "receivable",
        })
        .select("id")
        .single();
      if (txErr) throw txErr;

      const { error } = await db
        .from("receivables")
        .update({ status: "recebido", payment_date: today, transaction_id: tx.id })
        .eq("id", r.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      toast.success("Recebimento registrado — receita lançada no DRE");
    },
    onError: (e: Error) => toast.error(mensagemDeErro(e)),
  });

  const cancelReceivable = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db
        .from("receivables")
        .update({ status: "cancelado" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk });
      toast.success("Conta cancelada");
    },
    onError: (e: Error) => toast.error("Erro ao cancelar: " + mensagemDeErro(e)),
  });

  const deleteReceivable = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("receivables").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk });
      toast.success("Conta removida");
    },
    onError: (e: Error) => toast.error("Erro ao remover: " + mensagemDeErro(e)),
  });

  return {
    ...query,
    receivables: query.data ?? [],
    createReceivable,
    updateReceivable,
    markAsReceived,
    cancelReceivable,
    deleteReceivable,
  };
}
