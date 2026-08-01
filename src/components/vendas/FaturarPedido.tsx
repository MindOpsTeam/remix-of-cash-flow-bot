import { mensagemDeErro } from "@/lib/erros";
import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { HandCoins, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

/**
 * Faturar o pedido.
 *
 * O conselho chamou isto de "duas colunas e um botão que transformam três ilhas
 * em processo". Antes o pedido de venda não virava nada: nem nota, nem
 * recebível, nem lançamento. Quatro pedidos em produção e zero recebíveis.
 *
 * Toda a geração acontece na função `faturar_pedido`, no banco, numa transação
 * só. Meio caminho aqui seria pedido faturado sem recebível, ou recebível sem
 * pedido faturado, e os dois estados são piores que o erro.
 */

interface Credito {
  tem_limite: boolean;
  limite: number | null;
  em_aberto: number;
  depois_desta_venda: number;
  estoura: boolean;
}

interface FaturarPedidoProps {
  pedidoId: string;
  contatoId?: string | null;
  numero: number;
  total: number;
  clienteNome: string | null;
  /** Prazo padrão do cliente, quando houver, para não perguntar o óbvio. */
  prazoPadraoDias?: number | null;
  vencimentoPedido?: string | null;
  onFaturado?: () => void;
}

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function FaturarPedido({
  pedidoId, contatoId, numero, total, clienteNome, prazoPadraoDias, vencimentoPedido, onFaturado,
}: FaturarPedidoProps) {
  const qc = useQueryClient();
  const [aberto, setAberto] = useState(false);
  const [parcelas, setParcelas] = useState(1);
  const [intervalo, setIntervalo] = useState(prazoPadraoDias && prazoPadraoDias > 0 ? prazoPadraoDias : 30);
  const [primeiroVenc, setPrimeiroVenc] = useState(
    vencimentoPedido ?? new Date().toISOString().slice(0, 10),
  );
  const [salvando, setSalvando] = useState(false);
  const [credito, setCredito] = useState<Credito | null>(null);

  // O aviso tem que chegar ANTES do clique. Descobrir que o cliente estourou o
  // limite depois que o recebível existe não ajuda ninguém.
  useEffect(() => {
    if (!aberto || !contatoId) { setCredito(null); return; }
    (async () => {
      const { data } = await supabase.rpc("checar_credito" as never, {
        p_contact_id: contatoId,
        p_valor: total,
      } as never);
      setCredito((data ?? null) as unknown as Credito | null);
    })();
  }, [aberto, contatoId, total]);

  async function faturar() {
    setSalvando(true);
    try {
      const { data, error } = await supabase.rpc("faturar_pedido" as never, {
        p_sales_order_id: pedidoId,
        p_parcelas: parcelas,
        p_primeiro_vencimento: primeiroVenc,
        p_intervalo_dias: intervalo,
      } as never);
      if (error) throw error;

      const r = data as unknown as { recebiveis_criados: number };
      toast.success(
        `Pedido ${numero} faturado. ${r?.recebiveis_criados ?? parcelas} recebível(is) em Contas a Receber.`,
      );
      qc.invalidateQueries({ queryKey: ["sales_orders"] });
      qc.invalidateQueries({ queryKey: ["receivables"] });
      setAberto(false);
      onFaturado?.();
    } catch (e) {
      toast.error("Não consegui faturar: " + mensagemDeErro(e));
    } finally {
      setSalvando(false);
    }
  }

  // Mesma divisão que a função faz no banco: o resto de centavos vai para a
  // primeira parcela, para a soma fechar com o total do pedido.
  const valorParcela = Math.trunc((total / parcelas) * 100) / 100;
  const resto = Math.round((total - valorParcela * parcelas) * 100) / 100;

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        title="Faturar pedido"
        onClick={(e) => { e.stopPropagation(); setAberto(true); }}
      >
        <HandCoins className="h-3.5 w-3.5" />
      </Button>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Faturar pedido {numero}</DialogTitle>
            <DialogDescription>
              {clienteNome ?? "Sem cliente"} · {brl(total)}. Isto gera o contas a receber e o pedido passa a
              faturado.
            </DialogDescription>
          </DialogHeader>

          {credito?.estoura && (
            <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/[0.08] p-3 text-xs">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning dark:text-warning" />
              <p className="text-muted-foreground">
                Este cliente ficará com <span className="font-medium text-foreground">{brl(credito.depois_desta_venda)}</span> em
                aberto, acima do limite de {brl(Number(credito.limite))}. Hoje ele já deve {brl(credito.em_aberto)}.
                Dá para faturar assim mesmo, mas fica registrado que você viu.
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="parcelas" className="text-xs">Parcelas</Label>
              <Input
                id="parcelas" type="number" min={1} max={36} value={parcelas}
                onChange={(e) => setParcelas(Math.max(1, Math.min(36, Number(e.target.value) || 1)))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="intervalo" className="text-xs">Intervalo (dias)</Label>
              <Input
                id="intervalo" type="number" min={1} max={365} value={intervalo}
                onChange={(e) => setIntervalo(Math.max(1, Math.min(365, Number(e.target.value) || 30)))}
                disabled={parcelas === 1}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="primeiro" className="text-xs">Primeiro vencimento</Label>
            <Input
              id="primeiro" type="date" value={primeiroVenc}
              onChange={(e) => setPrimeiroVenc(e.target.value)}
            />
          </div>

          <p className="text-xs text-muted-foreground">
            {parcelas === 1
              ? `1 recebível de ${brl(total)}.`
              : `${parcelas}x de ${brl(valorParcela)}` +
                (resto !== 0 ? `, com ${brl(valorParcela + resto)} na primeira.` : ".")}
          </p>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAberto(false)}>Cancelar</Button>
            <Button onClick={faturar} disabled={salvando} className="gap-2">
              {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <HandCoins className="h-4 w-4" />}
              Faturar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
