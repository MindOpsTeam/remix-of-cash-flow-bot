import { AppLayout } from "@/components/AppLayout";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Target, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { MONTH_LABELS, formatPercent } from "@/lib/margin";

interface BudgetRow {
  month: string;
  receita: number;
  custos: number;
  despesas: number;
}

interface ActualRow {
  month: string;
  receita: number;
  custos: number;
  despesas: number;
}

function parseNum(v: string): number {
  const n = parseFloat(v.replace(/\./g, "").replace(",", "."));
  return isNaN(n) ? 0 : n;
}

function fmt(v: number): string {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export default function Budget() {
  const { company } = useCompany();
  const qc = useQueryClient();
  const year = new Date().getFullYear();
  const [drafts, setDrafts] = useState<Record<string, Partial<Record<"receita" | "custos" | "despesas", string>>>>({});

  const months = useMemo(
    () => Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}-01`),
    [year],
  );

  const { data: budgets = [], isLoading } = useQuery({
    queryKey: ["budgets", company?.id, year],
    enabled: !!company,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("budgets")
        .select("month, receita, custos, despesas")
        .eq("company_id", company!.id)
        .gte("month", `${year}-01-01`)
        .lte("month", `${year}-12-01`);
      if (error) throw error;
      return (data ?? []) as BudgetRow[];
    },
  });

  const { data: actuals = [] } = useQuery({
    queryKey: ["budget_actuals", company?.id, year],
    enabled: !!company,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("v_company_margin_full")
        .select("month, receita, custos, despesas")
        .eq("company_id", company!.id)
        .gte("month", `${year}-01-01`)
        .lte("month", `${year}-12-01`);
      if (error) throw error;
      return (data ?? []) as ActualRow[];
    },
  });

  const budgetByMonth = useMemo(() => new Map(budgets.map((b) => [b.month, b])), [budgets]);
  const actualByMonth = useMemo(() => new Map(actuals.map((a) => [a.month, a])), [actuals]);

  const save = useMutation({
    mutationFn: async (month: string) => {
      const b = budgetByMonth.get(month);
      const d = drafts[month] ?? {};
      const payload = {
        company_id: company!.id,
        month,
        receita: d.receita != null ? parseNum(d.receita) : Number(b?.receita ?? 0),
        custos: d.custos != null ? parseNum(d.custos) : Number(b?.custos ?? 0),
        despesas: d.despesas != null ? parseNum(d.despesas) : Number(b?.despesas ?? 0),
        updated_at: new Date().toISOString(),
      };
      const { error } = await (supabase as any)
        .from("budgets")
        .upsert(payload, { onConflict: "company_id,month" });
      if (error) throw error;
    },
    onSuccess: (_d, month) => {
      toast.success("Orçamento salvo");
      setDrafts((p) => {
        const next = { ...p };
        delete next[month];
        return next;
      });
      qc.invalidateQueries({ queryKey: ["budgets", company?.id] });
    },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  const setDraft = (month: string, field: "receita" | "custos" | "despesas", value: string) => {
    setDrafts((p) => ({ ...p, [month]: { ...p[month], [field]: value } }));
  };

  const varianceTone = (real: number, orcado: number, invert = false): string => {
    if (orcado === 0) return "text-muted-foreground";
    const desvio = (real - orcado) / orcado;
    const bom = invert ? desvio <= 0 : desvio >= 0;
    if (Math.abs(desvio) < 0.05) return "text-muted-foreground";
    return bom ? "text-[hsl(var(--success))]" : "text-[hsl(var(--destructive))]";
  };

  const now = new Date();

  return (
    <AppLayout>
      <div className="animate-fade-in">
        <div className="mb-6">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            <h1 className="text-[28px] font-semibold tracking-[-0.02em]">Orçamento {year}</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Meta mensal de receita, custos e despesas de {company?.name} — comparada ao realizado.
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Mês</th>
                  <th className="px-3 py-2">Receita orçada</th>
                  <th className="px-3 py-2">Realizada</th>
                  <th className="px-3 py-2">Custos orçados</th>
                  <th className="px-3 py-2">Realizados</th>
                  <th className="px-3 py-2">Despesas orçadas</th>
                  <th className="px-3 py-2">Realizadas</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {months.map((month, i) => {
                  const b = budgetByMonth.get(month);
                  const a = actualByMonth.get(month);
                  const d = drafts[month] ?? {};
                  const isPast = new Date(month) <= now;
                  const dirty = Object.keys(d).length > 0;
                  const cell = (field: "receita" | "custos" | "despesas") => (
                    <Input
                      value={d[field] ?? String(Number(b?.[field] ?? 0) || "")}
                      onChange={(e) => setDraft(month, field, e.target.value.replace(/[^\d.,]/g, ""))}
                      className="h-8 w-28 text-right font-mono text-xs"
                      placeholder="0"
                    />
                  );
                  const real = (field: "receita" | "custos" | "despesas", invert = false) => {
                    const rv = Number(a?.[field] ?? 0);
                    const ov = Number(b?.[field] ?? 0);
                    if (!isPast) return <span className="text-xs text-muted-foreground">—</span>;
                    return (
                      <div className="text-right">
                        <div className="font-mono text-xs">{fmt(rv)}</div>
                        {ov > 0 && (
                          <div className={`text-[10px] ${varianceTone(rv, ov, invert)}`}>
                            {formatPercent(((rv - ov) / ov) * 100, 0)}
                          </div>
                        )}
                      </div>
                    );
                  };
                  return (
                    <tr key={month} className="border-t border-border">
                      <td className="px-3 py-2 font-medium">{MONTH_LABELS[i]}</td>
                      <td className="px-3 py-2">{cell("receita")}</td>
                      <td className="px-3 py-2">{real("receita")}</td>
                      <td className="px-3 py-2">{cell("custos")}</td>
                      <td className="px-3 py-2">{real("custos", true)}</td>
                      <td className="px-3 py-2">{cell("despesas")}</td>
                      <td className="px-3 py-2">{real("despesas", true)}</td>
                      <td className="px-3 py-2">
                        <Button size="sm" variant="ghost" disabled={!dirty || save.isPending} onClick={() => save.mutate(month)} className="gap-1">
                          <Save className="h-3.5 w-3.5" /> Salvar
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-3 text-xs text-muted-foreground">
          Desvio em % sob o valor orçado. <Badge variant="outline" className="mx-1">verde</Badge>
          receita acima do orçado / gasto abaixo do orçado.
        </p>
      </div>
    </AppLayout>
  );
}
