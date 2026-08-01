import { mensagemDeErro } from "@/lib/erros";
import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Split, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";

/**
 * Rateio por centro de custo.
 *
 * "Aluguel de dez mil, 40% comercial e 60% operacional" era impossível: a
 * relação entre lançamento e centro de custo era um para um. Numa PME de
 * serviços, segundo o conselho, isso é a controladoria inteira.
 *
 * Quem grava é a função `ratear_lancamento`, no banco, tudo ou nada, com a soma
 * conferida contra o valor do lançamento. Rateio pela metade some com despesa do
 * relatório sem ninguém notar, e é pior do que rateio nenhum.
 */

interface Linha {
  cost_center_id: string;
  percentual: string;
}

interface CentroCusto {
  id: string;
  name: string;
}

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface RatearLancamentoProps {
  transactionId: string;
  descricao: string;
  valor: number;
  onRateado?: () => void;
}

export function RatearLancamento({ transactionId, descricao, valor, onRateado }: RatearLancamentoProps) {
  const { company } = useCompany();
  const qc = useQueryClient();
  const [aberto, setAberto] = useState(false);
  const [centros, setCentros] = useState<CentroCusto[]>([]);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!aberto || !company) return;
    (async () => {
      const [{ data: ccs }, { data: atuais }] = await Promise.all([
        supabase.from("cost_centers").select("id, name").eq("company_id", company.id).eq("active", true).order("name"),
        supabase
          .from("transaction_allocations" as never)
          .select("cost_center_id, percentual")
          .eq("transaction_id", transactionId),
      ]);
      setCentros((ccs ?? []) as CentroCusto[]);

      const existentes = (atuais ?? []) as unknown as Array<{ cost_center_id: string; percentual: number }>;
      setLinhas(
        existentes.length > 0
          ? existentes.map((a) => ({ cost_center_id: a.cost_center_id, percentual: String(Number(a.percentual)) }))
          : [{ cost_center_id: "", percentual: "50" }, { cost_center_id: "", percentual: "50" }],
      );
    })();
  }, [aberto, company, transactionId]);

  const soma = linhas.reduce((s, l) => s + (Number(l.percentual) || 0), 0);
  const fecha = Math.abs(soma - 100) <= 0.01;
  const completo = linhas.every((l) => l.cost_center_id) && linhas.length >= 2;

  async function salvar(desfazer = false) {
    setSalvando(true);
    try {
      const { error } = await supabase.rpc("ratear_lancamento" as never, {
        p_transaction_id: transactionId,
        p_rateio: desfazer
          ? []
          : linhas.map((l) => ({ cost_center_id: l.cost_center_id, percentual: Number(l.percentual) })),
      } as never);
      if (error) throw error;

      toast.success(desfazer ? "Rateio desfeito." : `Rateio salvo em ${linhas.length} centros.`);
      qc.invalidateQueries({ queryKey: ["transactions"] });
      setAberto(false);
      onRateado?.();
    } catch (e) {
      toast.error("Não consegui salvar o rateio: " + mensagemDeErro(e));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        title="Ratear entre centros de custo"
        onClick={(e) => { e.stopPropagation(); setAberto(true); }}
      >
        <Split className="h-3.5 w-3.5" />
      </Button>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ratear entre centros de custo</DialogTitle>
            <DialogDescription>
              {descricao} · {brl(valor)}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            {linhas.map((l, i) => (
              <div key={i} className="flex items-center gap-2">
                <Select
                  value={l.cost_center_id}
                  onValueChange={(v) =>
                    setLinhas(linhas.map((x, j) => (j === i ? { ...x, cost_center_id: v } : x)))
                  }
                >
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Centro de custo" /></SelectTrigger>
                  <SelectContent>
                    {centros
                      .filter((c) => c.id === l.cost_center_id || !linhas.some((x) => x.cost_center_id === c.id))
                      .map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Input
                  className="w-20 text-right"
                  inputMode="decimal"
                  value={l.percentual}
                  onChange={(e) =>
                    setLinhas(linhas.map((x, j) => (j === i ? { ...x, percentual: e.target.value } : x)))
                  }
                />
                <span className="text-sm text-muted-foreground">%</span>
                <span className="w-24 text-right text-xs tabular-nums text-muted-foreground">
                  {brl((valor * (Number(l.percentual) || 0)) / 100)}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  disabled={linhas.length <= 2}
                  onClick={() => setLinhas(linhas.filter((_, j) => j !== i))}
                  aria-label="Remover linha"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setLinhas([...linhas, { cost_center_id: "", percentual: "0" }])}
            >
              <Plus className="h-3.5 w-3.5" /> Centro
            </Button>
            <span className={`text-sm tabular-nums ${fecha ? "text-muted-foreground" : "text-expense font-medium"}`}>
              {soma.toFixed(2).replace(".", ",")}% de 100%
            </span>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => salvar(true)} disabled={salvando}>
              Desfazer rateio
            </Button>
            <Button onClick={() => salvar(false)} disabled={salvando || !fecha || !completo} className="gap-2">
              {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Split className="h-4 w-4" />}
              Salvar rateio
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
