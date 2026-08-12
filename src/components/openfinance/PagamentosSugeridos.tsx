import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, ArrowUpFromLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { formatCurrency } from "@/lib/utils";
import { mensagemDeErro } from "@/lib/erros";

interface Sugestao {
  transaction_id: string;
  bill_id: string;
  amount: number;
  tx_date: string;
  vencimento: string;
  tx_description: string | null;
  bill_description: string | null;
  same_contact: boolean;
  score: number;
}

/**
 * Débitos do extrato que casam com uma conta a pagar EM ABERTO. Um clique dá
 * baixa no título usando o débito real do banco (reconcile-transactions:
 * suggest_payables / settle_payable). Espelho de RecebimentosSugeridos.
 */
export function PagamentosSugeridos() {
  const { company } = useCompany();
  const qc = useQueryClient();
  const [baixando, setBaixando] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["conciliacao-pagaveis", company?.id],
    enabled: !!company,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("reconcile-transactions", {
        body: { action: "suggest_payables", company_id: company!.id },
      });
      if (error) throw error;
      return (data?.suggestions ?? []) as Sugestao[];
    },
  });

  const sugestoes = data ?? [];
  if (isLoading || sugestoes.length === 0) return null;

  const darBaixa = async (s: Sugestao) => {
    setBaixando(s.bill_id);
    try {
      const { data, error } = await supabase.functions.invoke("reconcile-transactions", {
        body: { action: "settle_payable", transaction_id: s.transaction_id, bill_id: s.bill_id },
      });
      if (error) throw error;
      if (data?.ok) {
        toast.success("Conta a pagar baixada e conciliada com o extrato.");
        qc.invalidateQueries({ queryKey: ["conciliacao-pagaveis", company?.id] });
        qc.invalidateQueries({ queryKey: ["bills-payable"] });
      } else {
        toast.error(data?.error ?? "Não consegui dar baixa.");
      }
    } catch (e) {
      toast.error("Falha ao dar baixa: " + mensagemDeErro(e));
    } finally {
      setBaixando(null);
    }
  };

  return (
    <div className="mb-6 rounded-lg border border-expense/30 bg-expense/[0.06] p-5">
      <div className="mb-2 flex items-center gap-2">
        <ArrowUpFromLine className="h-4 w-4 text-expense" />
        <h2 className="text-sm font-semibold text-foreground">Pagamentos a dar baixa</h2>
        <Badge variant="secondary" className="text-[10px]">{sugestoes.length}</Badge>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Débitos do seu extrato que casam com uma conta a pagar em aberto. Dê baixa para liquidar o
        título com o pagamento que já saiu (evita registrar a despesa duas vezes).
      </p>
      <div className="space-y-2">
        {sugestoes.map((s) => (
          <div
            key={`${s.transaction_id}-${s.bill_id}`}
            className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-card p-3"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">
                {s.bill_description ?? "Conta a pagar"} · {formatCurrency(s.amount)}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                Extrato: {s.tx_description ?? "débito"} · saiu em {new Date(s.tx_date).toLocaleDateString("pt-BR")}
                {s.same_contact && <span className="ml-1 text-expense">· mesmo fornecedor</span>}
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={() => darBaixa(s)} disabled={baixando === s.bill_id} className="gap-1.5">
              {baixando === s.bill_id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Dar baixa
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
