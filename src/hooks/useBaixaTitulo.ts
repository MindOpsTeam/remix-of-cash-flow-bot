import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { mensagemDeErro } from "@/lib/erros";
import { toast } from "sonner";

/**
 * Baixa e estorno de título.
 *
 * O motor sempre esteve no banco (title_payments com lock de linha), mas a tela
 * só sabia quitar o título inteiro: quem recebia 300 de um título de 1000 não
 * tinha onde registrar, e quem tomava um Pix de volta só podia APAGAR a linha,
 * o que destruía a trilha e deixava a receita órfã no DRE.
 *
 * Toda a aritmética fica na RPC, não aqui: valor, juros, multa e desconto
 * precisam ser decididos dentro da mesma transação que trava o título, senão
 * dois operadores dando baixa ao mesmo tempo estouram o saldo.
 */

export type TipoTitulo = "receivable" | "bill";

export interface BaixaRegistrada {
  id: string;
  amount: number;
  paid_at: string;
  juros: number;
  multa: number;
  desconto: number;
  estorno_de: string | null;
  motivo_estorno: string | null;
  created_at: string;
}

export interface EntradaBaixa {
  kind: TipoTitulo;
  titleId: string;
  valorPago: number;
  data: string;
  juros?: number;
  multa?: number;
  desconto?: number;
  bankAccountId?: string | null;
}

interface RespostaBaixa {
  status: string;
  erro?: string;
  saldo?: number;
  abatido?: number;
  dinheiro?: number;
}

/** Mensagem do usuário para cada status que a RPC devolve. */
function frasePara(r: RespostaBaixa): string {
  switch (r.status) {
    case "settled":
      return "Título quitado. Lançamento criado no DRE.";
    case "partial":
      return `Baixa parcial registrada. Ainda faltam ${new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format(r.saldo ?? 0)}.`;
    case "already_settled":
      return "Este título já estava quitado.";
    case "overpay":
      return `O valor abate mais do que o título tem em aberto (${new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format(r.saldo ?? 0)}).`;
    case "not_found":
      return "Título não encontrado.";
    default:
      return r.erro ?? "Não foi possível registrar a baixa.";
  }
}

const SUCESSO = new Set(["settled", "partial"]);

export function useBaixasDoTitulo(kind: TipoTitulo, titleId: string | null) {
  return useQuery<BaixaRegistrada[]>({
    queryKey: ["baixas", kind, titleId],
    enabled: !!titleId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("title_payments")
        .select("id, amount, paid_at, juros, multa, desconto, estorno_de, motivo_estorno, created_at")
        .eq("title_kind", kind)
        .eq("title_id", titleId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as BaixaRegistrada[];
    },
  });
}

export function useBaixaTitulo() {
  const queryClient = useQueryClient();

  const invalidar = () => {
    for (const chave of ["receivables", "bills_payable", "transactions", "baixas", "conciliacao"]) {
      queryClient.invalidateQueries({ queryKey: [chave] });
    }
  };

  const baixar = useMutation({
    mutationFn: async (e: EntradaBaixa) => {
      const { data, error } = await supabase.rpc("baixar_titulo", {
        p_kind: e.kind,
        p_title_id: e.titleId,
        p_valor_pago: e.valorPago,
        p_data: e.data,
        p_juros: e.juros ?? 0,
        p_multa: e.multa ?? 0,
        p_desconto: e.desconto ?? 0,
        p_bank_account_id: e.bankAccountId ?? undefined,
      });
      if (error) throw error;
      const r = data as unknown as RespostaBaixa;
      // A RPC devolve o problema no corpo, não como erro de rede: sem isto o
      // "overpay" apareceria como sucesso e o operador nunca saberia.
      if (!SUCESSO.has(r.status)) throw new Error(frasePara(r));
      return r;
    },
    onSuccess: (r) => {
      invalidar();
      toast.success(frasePara(r));
    },
    onError: (e: Error) => toast.error(mensagemDeErro(e)),
  });

  const estornar = useMutation({
    mutationFn: async ({ pagamentoId, motivo }: { pagamentoId: string; motivo: string }) => {
      const { data, error } = await supabase.rpc("estornar_baixa", {
        p_pagamento_id: pagamentoId,
        p_motivo: motivo,
      });
      if (error) throw error;
      const r = data as unknown as RespostaBaixa;
      if (r.status !== "estornado") throw new Error(r.erro ?? "Não foi possível estornar.");
      return r;
    },
    onSuccess: () => {
      invalidar();
      toast.success("Baixa estornada. O título voltou a ficar em aberto e o lançamento contrário foi criado.");
    },
    onError: (e: Error) => toast.error(mensagemDeErro(e)),
  });

  return { baixar, estornar };
}
