import { mensagemDeErro } from "@/lib/erros";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { useAuth } from "@/hooks/useAuth";
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
  approval_status: "draft" | "awaiting_approval" | "approved" | "rejected";
  requested_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  is_recurring: boolean | null;
  recurrence_group_id: string | null;
  recurrence_index: number | null;
  recurrence_total: number | null;
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
  // Identidade do boleto (opcional): a linha digitável deduplica entre fontes e é o
  // que se paga; o CNPJ do beneficiário deixa o sistema ligar o fornecedor sozinho.
  linha_digitavel?: string | null;
  beneficiario_cnpj?: string | null;
  beneficiario_nome?: string | null;
};

function computeStatus(bill: { status: string; vencimento: string }): string {
  if (bill.status === "pago") return "pago";
  const today = new Date().toISOString().split("T")[0];
  return bill.vencimento < today ? "vencido" : "a_vencer";
}

export function useBillsPayable() {
  const { company } = useCompany();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const companyId = company?.id;
  const qk = ["bills_payable", companyId];

  // Alçada do usuário atual nesta empresa (NULL = ilimitada)
  const { data: membership } = useQuery({
    queryKey: ["member_approval_limit", companyId, user?.id],
    enabled: !!companyId && !!user,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("company_members")
        .select("approval_limit, role")
        .eq("company_id", companyId!)
        .eq("user_id", user!.id)
        .maybeSingle();
      return data as { approval_limit: number | null; role: string } | null;
    },
  });

  const approvalLimit = membership?.approval_limit ?? null;

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

  /**
   * Transforma uma conta em recorrência.
   *
   * Gera todas as ocorrências de uma vez, e não mês a mês, porque compromisso
   * conhecido precisa aparecer no fluxo de caixa projetado. Recorrência que só
   * materializa no mês corrente esconde do dono uma conta que ele já tem.
   */
  const tornarRecorrente = useMutation({
    mutationFn: async (input: { billId: string; ocorrencias: number; periodicidade: string }) => {
      const { data, error } = await supabase.rpc("gerar_conta_recorrente" as never, {
        p_bill_id: input.billId,
        p_ocorrencias: input.ocorrencias,
        p_periodicidade: input.periodicidade,
      } as never);
      if (error) throw error;
      return data as unknown as { criadas: number; ultimo_vencimento: string };
    },
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: qk });
      toast.success(`${r.criadas} ocorrência(s) criadas, até ${new Date(r.ultimo_vencimento + "T00:00:00").toLocaleDateString("pt-BR")}.`);
    },
    onError: (e: Error) => toast.error("Não consegui criar a recorrência: " + mensagemDeErro(e)),
  });

  /** Encerra o futuro da recorrência e preserva o que já venceu ou foi pago. */
  const encerrarRecorrencia = useMutation({
    mutationFn: async (grupoId: string) => {
      const { data, error } = await supabase.rpc("encerrar_recorrencia" as never, {
        p_recurrence_group_id: grupoId,
      } as never);
      if (error) throw error;
      return data as unknown as { canceladas: number };
    },
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: qk });
      toast.success(`${r.canceladas} ocorrência(s) futuras canceladas. O histórico ficou.`);
    },
    onError: (e: Error) => toast.error("Não consegui encerrar: " + mensagemDeErro(e)),
  });

  const createBill = useMutation({
    mutationFn: async (input: BillInput) => {
      // Acima da alçada do criador → entra aguardando aprovação
      const needsApproval = approvalLimit != null && Number(input.valor) > approvalLimit;
      const { error } = await (supabase as any).from("bills_payable").insert({
        ...input,
        company_id: companyId!,
        source: input.source ?? "manual",
        approval_status: needsApproval ? "awaiting_approval" : "approved",
        requested_by: user?.id ?? null,
      });
      if (error) throw error;
      return needsApproval;
    },
    onSuccess: (needsApproval) => {
      queryClient.invalidateQueries({ queryKey: qk });
      toast.success(
        needsApproval
          ? "Conta criada — acima da sua alçada, aguardando aprovação"
          : "Conta adicionada",
      );
    },
    onError: (e: Error & { code?: string }) => {
      if (e?.code === "23505" || /duplicate|company_linha_uidx/i.test(e?.message ?? "")) {
        toast.info("Este boleto já está nas contas a pagar.");
        return;
      }
      toast.error("Erro ao criar conta: " + mensagemDeErro(e));
    },
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
    onError: (e: Error) => toast.error("Erro ao atualizar: " + mensagemDeErro(e)),
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
    onError: (e: Error) => toast.error("Erro ao remover: " + mensagemDeErro(e)),
  });

  const decideBill = useMutation({
    mutationFn: async ({ id, valor, approve }: { id: string; valor: number; approve: boolean }) => {
      // Quem decide também precisa de alçada suficiente
      if (approve && approvalLimit != null && Number(valor) > approvalLimit) {
        throw new Error("Valor acima da sua alçada de aprovação");
      }
      const { error } = await (supabase as any)
        .from("bills_payable")
        .update({
          approval_status: approve ? "approved" : "rejected",
          approved_by: user?.id ?? null,
          approved_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("approval_status", "awaiting_approval");
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk });
      toast.success("Decisão registrada");
    },
    onError: (e: Error) => toast.error(mensagemDeErro(e)),
  });

  /**
   * Baixa de conta a pagar.
   *
   * Antes daqui só mudava o status. A despesa NUNCA virava lançamento, e o DRE
   * lê exclusivamente `transactions`: o dono pagava quarenta contas no mês e via
   * receita cheia com despesa quase zero, ou seja, lucro que não existe. Este é
   * o espelho exato do que markAsReceived já fazia do lado da receita.
   */
  const markAsPaid = useMutation({
    mutationFn: async (bill: {
      id: string;
      approval_status?: string;
      company_id?: string;
      valor?: number;
      fornecedor?: string;
      descricao?: string | null;
      status?: string;
    }) => {
      if (bill.approval_status === "awaiting_approval") {
        throw new Error("Conta aguardando aprovação — aprove antes de pagar");
      }
      if (bill.approval_status === "rejected") {
        throw new Error("Conta rejeitada não pode ser paga");
      }
      if (bill.status === "pago") throw new Error("Conta já paga");
      if (bill.status === "cancelado") throw new Error("Conta cancelada não pode ser paga");
      if (!user) throw new Error("Sessão expirada");

      // Relemos a conta em vez de confiar no que a tela mandou: o valor e a
      // conta contábil que vão para o DRE precisam ser os do banco.
      const { data: atual, error: leituraErr } = await supabase
        .from("bills_payable")
        .select("id, company_id, valor, fornecedor, descricao, status, account_id, transaction_id")
        .eq("id", bill.id)
        .single();
      if (leituraErr) throw leituraErr;
      if (atual.status === "pago") throw new Error("Conta já paga");
      if (atual.transaction_id) throw new Error("Esta conta já tem lançamento vinculado");

      const hoje = new Date().toISOString().split("T")[0];

      const { data: tx, error: txErr } = await supabase
        .from("transactions")
        .insert({
          company_id: atual.company_id,
          user_id: user.id,
          date: hoje,
          description: atual.descricao || atual.fornecedor,
          amount: Number(atual.valor),
          type: "expense",
          account_id: atual.account_id,
          status: "confirmed",
          source: "bill_payable",
        })
        .select("id")
        .single();
      if (txErr) throw txErr;

      const { error } = await supabase
        .from("bills_payable")
        .update({
          status: "pago",
          payment_date: hoje,
          transaction_id: tx.id,
          valor_baixado: Number(atual.valor),
        })
        .eq("id", bill.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      toast.success("Pagamento registrado — despesa lançada no DRE");
    },
    onError: (e: Error) => toast.error(mensagemDeErro(e)),
  });

  return {
    ...query,
    bills: query.data ?? [],
    approvalLimit,
    createBill,
    updateBill,
    deleteBill,
    decideBill,
    markAsPaid,
    tornarRecorrente,
    encerrarRecorrencia,
  };
}
