import { mensagemDeErro } from "@/lib/erros";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { toast } from "sonner";
import { nextDueDate } from "@/lib/receivables";

// contracts/receivables ainda não estão nos tipos gerados do Supabase.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

/** Envelope de resposta das actions de escrita do Asaas (company-asaas-api). */
type AsaasInvoke = {
  ok?: boolean;
  data?: { id?: string; nextDueDate?: string };
  details?: unknown;
} | null;

export interface Contract {
  id: string;
  company_id: string;
  contact_id: string | null;
  description: string;
  amount: number;
  cycle: string;
  billing_day: number;
  payment_method: string;
  start_date: string;
  end_date: string | null;
  status: string;
  account_id: string | null;
  cost_center_id: string | null;
  asaas_customer_id: string | null;
  asaas_subscription_id: string | null;
  next_due_date: string | null;
  created_at: string;
  updated_at: string;
}

export type ContractInput = {
  contact_id: string;
  description: string;
  amount: number;
  cycle: string;
  billing_day: number;
  payment_method: string;
  start_date: string;
  end_date?: string | null;
  account_id: string;
  cost_center_id: string;
  auto_billing: boolean; // true = cria assinatura no Asaas (boleto mensal automático)
};

type AsaasOutcome = "ok" | "manual" | "sem_documento" | "sem_integracao" | "erro";

export function useContracts() {
  const { company } = useCompany();
  const queryClient = useQueryClient();
  const companyId = company?.id;
  const qk = ["contracts", companyId];

  const query = useQuery({
    queryKey: qk,
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await db
        .from("contracts")
        .select("*")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Contract[];
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: qk });
    queryClient.invalidateQueries({ queryKey: ["receivables", companyId] });
  };

  const createContract = useMutation({
    mutationFn: async (input: ContractInput): Promise<{ outcome: AsaasOutcome; detail?: string }> => {
      const nextDue = nextDueDate(input.billing_day);

      // 1) Contrato sempre é criado (fonte da verdade), independente do Asaas.
      const { data: contract, error } = await db
        .from("contracts")
        .insert({
          company_id: companyId!,
          contact_id: input.contact_id,
          description: input.description,
          amount: input.amount,
          cycle: input.cycle,
          billing_day: input.billing_day,
          payment_method: input.payment_method,
          start_date: input.start_date,
          end_date: input.end_date ?? null,
          status: "active",
          account_id: input.account_id,
          cost_center_id: input.cost_center_id,
          next_due_date: nextDue,
        })
        .select("*")
        .single();
      if (error) throw error;

      if (!input.auto_billing) return { outcome: "manual" };

      // 2) Cobrança automática via Asaas (assinatura nativa → boleto mensal enviado ao cliente).
      const { data: contact } = await db
        .from("contacts")
        .select("name, document, email, phone, whatsapp")
        .eq("id", input.contact_id)
        .single();

      const doc = (contact?.document as string | null)?.replace(/\D/g, "") || "";
      if (!doc) return { outcome: "sem_documento" };

      const customerRes = await supabase.functions.invoke("company-asaas-api", {
        body: {
          action: "create-customer",
          company_id: companyId,
          customer: {
            name: contact.name,
            cpfCnpj: doc,
            email: contact.email || undefined,
            mobilePhone: (contact.whatsapp || contact.phone || "")?.replace(/\D/g, "") || undefined,
            externalReference: input.contact_id,
          },
        },
      });
      const custData = customerRes.data as AsaasInvoke;
      if (customerRes.error || custData?.ok === false || !custData?.data?.id) {
        return { outcome: "sem_integracao", detail: JSON.stringify(custData?.details ?? customerRes.error) };
      }
      const customerId = custData.data.id;

      const subRes = await supabase.functions.invoke("company-asaas-api", {
        body: {
          action: "create-subscription",
          company_id: companyId,
          subscription: {
            customer: customerId,
            billingType: input.payment_method === "UNDEFINED" ? "BOLETO" : input.payment_method,
            value: input.amount,
            nextDueDate: nextDue,
            cycle: input.cycle,
            description: input.description,
            externalReference: contract.id,
            endDate: input.end_date || undefined,
          },
        },
      });
      const subData = subRes.data as AsaasInvoke;
      if (subRes.error || subData?.ok === false || !subData?.data?.id) {
        await db.from("contracts").update({ asaas_customer_id: customerId }).eq("id", contract.id);
        return { outcome: "erro", detail: JSON.stringify(subData?.details ?? subRes.error) };
      }
      const sub = subData.data;
      await db
        .from("contracts")
        .update({
          asaas_customer_id: customerId,
          asaas_subscription_id: sub.id,
          next_due_date: sub.nextDueDate || nextDue,
        })
        .eq("id", contract.id);
      return { outcome: "ok" };
    },
    onSuccess: ({ outcome }) => {
      invalidate();
      if (outcome === "ok") toast.success("Contrato criado — assinatura Asaas ativa, boleto mensal automático enviado ao cliente");
      else if (outcome === "manual") toast.success("Contrato criado (cobrança manual/agendada)");
      else if (outcome === "sem_documento") toast.warning("Contrato criado, mas o cliente não tem CPF/CNPJ — cobrança automática desativada");
      else if (outcome === "sem_integracao") toast.warning("Contrato criado, mas o Asaas não está configurado/conectado — cobrança automática desativada");
      else toast.warning("Contrato criado, mas a assinatura no Asaas falhou — revise a integração e reative");
    },
    onError: (e: Error) => toast.error("Erro ao criar contrato: " + mensagemDeErro(e)),
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "active" | "paused" | "ended" }) => {
      const { error } = await db.from("contracts").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Contrato atualizado"); },
    onError: (e: Error) => toast.error(mensagemDeErro(e)),
  });

  const deleteContract = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("contracts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Contrato removido"); },
    onError: (e: Error) => toast.error("Erro ao remover: " + mensagemDeErro(e)),
  });

  return {
    ...query,
    contracts: query.data ?? [],
    createContract,
    setStatus,
    deleteContract,
  };
}
