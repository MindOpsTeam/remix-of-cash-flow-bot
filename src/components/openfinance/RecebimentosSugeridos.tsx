import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, ArrowDownToLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { formatCurrency } from "@/lib/utils";
import { mensagemDeErro } from "@/lib/erros";

interface Sugestao {
  transaction_id: string;
  receivable_id: string;
  amount: number;
  tx_date: string;
  due_date: string;
  tx_description: string | null;
  receivable_description: string | null;
  same_contact: boolean;
  score: number;
}

/**
 * Recebimentos identificados no extrato que casam com uma conta a receber EM
 * ABERTO. Um clique dá baixa no título usando o crédito real do banco
 * (edge reconcile-transactions, ações suggest_receivables / settle_receivable).
 * Fecha o ciclo nota -> recebível -> banco para pagamentos via Open Finance/PIX.
 */
export function RecebimentosSugeridos() {
  const { company } = useCompany();
  const qc = useQueryClient();
  const [baixando, setBaixando] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["conciliacao-recebiveis", company?.id],
    enabled: !!company,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("reconcile-transactions", {
        body: { action: "suggest_receivables", company_id: company!.id },
      });
      if (error) throw error;
      return (data?.suggestions ?? []) as Sugestao[];
    },
  });

  const sugestoes = data ?? [];
  if (isLoading || sugestoes.length === 0) return null;

  const darBaixa = async (s: Sugestao) => {
    setBaixando(s.receivable_id);
    try {
      const { data, error } = await supabase.functions.invoke("reconcile-transactions", {
        body: { action: "settle_receivable", transaction_id: s.transaction_id, receivable_id: s.receivable_id },
      });
      if (error) throw error;
      if (data?.ok) {
        toast.success("Recebível baixado e conciliado com o extrato.");
        qc.invalidateQueries({ queryKey: ["conciliacao-recebiveis", company?.id] });
        qc.invalidateQueries({ queryKey: ["receivables"] });
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
    <div className="mb-6 rounded-lg border border-income/30 bg-income/[0.06] p-5">
      <div className="mb-2 flex items-center gap-2">
        <ArrowDownToLine className="h-4 w-4 text-income" />
        <h2 className="text-sm font-semibold text-foreground">Recebimentos a dar baixa</h2>
        <Badge variant="secondary" className="text-[10px]">{sugestoes.length}</Badge>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Créditos do seu extrato que casam com uma conta a receber em aberto. Dê baixa para liquidar o
        título com o dinheiro que já entrou (evita registrar a receita duas vezes).
      </p>
      <div className="space-y-2">
        {sugestoes.map((s) => (
          <div
            key={`${s.transaction_id}-${s.receivable_id}`}
            className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-card p-3"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">
                {s.receivable_description ?? "Recebível"} · {formatCurrency(s.amount)}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                Extrato: {s.tx_description ?? "crédito"} · caiu em {new Date(s.tx_date).toLocaleDateString("pt-BR")}
                {s.same_contact && <span className="ml-1 text-income">· mesmo cliente</span>}
              </p>
            </div>
            <Button size="sm" onClick={() => darBaixa(s)} disabled={baixando === s.receivable_id} className="gap-1.5">
              {baixando === s.receivable_id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Dar baixa
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
