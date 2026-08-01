import { mensagemDeErro } from "@/lib/erros";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Target, Plus, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ChartPanel, ChartEmptyState } from "@/components/bi/ChartPanel";
import { METAS_CATALOGO, progressoMeta } from "@/lib/metrics";
import { formatCurrency } from "@/lib/utils";
import type { KpiMeta } from "@/hooks/useCockpit";

/**
 * Metas do cockpit (OKR leve). O catálogo de métricas é código; a escolha do
 * cliente vira linha em kpi_metas. `realizado` chega pronto do painel — este
 * card não recalcula nada, só compara e mostra.
 */
interface KpiMetasCardProps {
  metas: KpiMeta[];
  /** Valor realizado atual por metric_key (calculado no painel). */
  realizado: Record<string, number>;
  /** CNPJ dono das metas (no escopo combinado, o principal do grupo). */
  companyId: string | undefined;
  isCombined: boolean;
}

type MetasWriter = {
  upsert: (row: Record<string, unknown>, opts: { onConflict: string }) => PromiseLike<{ error: { message: string } | null }>;
  delete: () => { eq: (col: string, val: string) => PromiseLike<{ error: { message: string } | null }> };
};
const metasTable = () => (supabase.from as unknown as (t: string) => MetasWriter)("kpi_metas");

function formatarValor(key: string, valor: number): string {
  return METAS_CATALOGO[key]?.formato === "percent" ? `${valor.toFixed(1)}%` : formatCurrency(valor);
}

export function KpiMetasCard({ metas, realizado, companyId, isCombined }: KpiMetasCardProps) {
  const queryClient = useQueryClient();
  const [aberto, setAberto] = useState(false);
  const [metricKey, setMetricKey] = useState<string>("");
  const [alvo, setAlvo] = useState<string>("");

  const invalidar = () => queryClient.invalidateQueries({ queryKey: ["cockpit"] });

  const salvar = useMutation({
    mutationFn: async () => {
      if (!companyId || !metricKey || !alvo) throw new Error("Escolha a métrica e o alvo.");
      const direcao = metricKey === "inadimplencia" ? "abaixo" : "acima";
      const { error } = await metasTable().upsert(
        { company_id: companyId, metric_key: metricKey, alvo: Number(alvo), direcao },
        { onConflict: "company_id,metric_key" },
      );
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Meta definida.");
      setAberto(false);
      setMetricKey("");
      setAlvo("");
      invalidar();
    },
    onError: (e: Error) => toast.error(mensagemDeErro(e)),
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await metasTable().delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Meta removida.");
      invalidar();
    },
    onError: (e: Error) => toast.error(mensagemDeErro(e)),
  });

  const disponiveis = Object.entries(METAS_CATALOGO).filter(
    ([key]) => !metas.some((m) => m.metric_key === key),
  );

  return (
    <ChartPanel
      title={isCombined ? "Metas do grupo" : "Metas do mês"}
      description="Realizado contra o alvo que você definiu"
      delay={150}
      meta={
        <Dialog open={aberto} onOpenChange={setAberto}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="gap-1.5" disabled={!companyId}>
              <Plus className="h-3.5 w-3.5" /> Meta
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Definir meta</DialogTitle>
              <DialogDescription>O painel acompanha o realizado contra este alvo, todo mês.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Métrica</Label>
                <Select value={metricKey} onValueChange={setMetricKey}>
                  <SelectTrigger><SelectValue placeholder="Escolher métrica" /></SelectTrigger>
                  <SelectContent>
                    {disponiveis.map(([key, def]) => (
                      <SelectItem key={key} value={key}>{def.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>
                  Alvo {metricKey && METAS_CATALOGO[metricKey]?.formato === "percent" ? "(%)" : "(R$)"}
                </Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={alvo}
                  onChange={(e) => setAlvo(e.target.value)}
                  placeholder={metricKey === "inadimplencia" ? "5" : "50000"}
                />
              </div>
              <Button className="w-full gap-2" onClick={() => salvar.mutate()} disabled={salvar.isPending}>
                {salvar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Target className="h-4 w-4" />}
                Salvar meta
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      }
    >
      {metas.length === 0 ? (
        <ChartEmptyState
          title="Nenhuma meta definida"
          description="Defina um alvo de receita, resultado ou inadimplência e o cockpit acompanha sozinho."
          minHeight={180}
        />
      ) : (
        <div className="space-y-4">
          {metas.map((meta) => {
            const def = METAS_CATALOGO[meta.metric_key];
            const valor = realizado[meta.metric_key] ?? 0;
            const { pct, atingida } = progressoMeta(valor, meta.alvo, meta.direcao);
            return (
              <div key={meta.id} className="group">
                <div className="mb-1.5 flex items-baseline justify-between gap-3 text-xs">
                  <span className="font-medium text-foreground">{def?.label ?? meta.metric_key}</span>
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-muted-foreground">
                      {formatarValor(meta.metric_key, valor)}
                      <span className="mx-1 text-muted-foreground/60">/</span>
                      {formatarValor(meta.metric_key, meta.alvo)}
                    </span>
                    <button
                      type="button"
                      onClick={() => remover.mutate(meta.id)}
                      className="text-muted-foreground/50 opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                      aria-label={`Remover meta ${def?.label ?? meta.metric_key}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </span>
                </div>
                <div
                  className="h-2 overflow-hidden rounded-sm bg-muted"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(pct)}
                  aria-label={`Progresso de ${def?.label ?? meta.metric_key}`}
                >
                  <div
                    className="h-full rounded-sm transition-[width] duration-500"
                    style={{
                      width: `${Math.max(pct, 2)}%`,
                      background: atingida ? "var(--via-success)" : "var(--via-data-1)",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </ChartPanel>
  );
}
