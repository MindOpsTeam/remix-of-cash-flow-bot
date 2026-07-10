import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowDownCircle, ArrowUpCircle, Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { formatPercent } from "@/lib/margin";

interface ApArRow {
  company_id: string;
  ap_a_vencer: number;
  ap_vencido: number;
  ar_a_vencer: number;
  ar_vencido: number;
}

function brl(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

/**
 * Posição consolidada do grupo: contas a pagar/receber por CNPJ + orçamento
 * do grupo vs realizado no mês. Exibido apenas na visão combinada.
 */
export function GroupApArCard() {
  const { companies, scope } = useCompany();
  const companyIds = useMemo(() => companies.map((c) => c.id), [companies]);
  const monthKey = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  }, []);

  const { data: apar = [] } = useQuery({
    queryKey: ["group_ap_ar", companyIds],
    enabled: scope === "all" && companyIds.length > 0,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("v_group_ap_ar")
        .select("*")
        .in("company_id", companyIds);
      if (error) throw error;
      return (data ?? []) as ApArRow[];
    },
  });

  const { data: budgetVsActual } = useQuery({
    queryKey: ["group_budget_actual", companyIds, monthKey],
    enabled: scope === "all" && companyIds.length > 0,
    queryFn: async () => {
      const [{ data: budgets }, { data: actuals }] = await Promise.all([
        (supabase as any)
          .from("budgets")
          .select("receita, custos, despesas")
          .in("company_id", companyIds)
          .eq("month", monthKey),
        (supabase as any)
          .from("v_company_margin")
          .select("receita, custos, despesas")
          .in("company_id", companyIds)
          .eq("month", monthKey),
      ]);
      const sum = (rows: Array<Record<string, number>> | null, k: string) =>
        (rows ?? []).reduce((s, r) => s + Number(r[k] ?? 0), 0);
      return {
        orcadoReceita: sum(budgets, "receita"),
        realReceita: sum(actuals, "receita"),
        orcadoGasto: sum(budgets, "custos") + sum(budgets, "despesas"),
        realGasto: sum(actuals, "custos") + sum(actuals, "despesas"),
        temOrcamento: (budgets ?? []).length > 0,
      };
    },
  });

  if (scope !== "all" || companies.length === 0) return null;

  const total = apar.reduce(
    (acc, r) => ({
      apAVencer: acc.apAVencer + Number(r.ap_a_vencer),
      apVencido: acc.apVencido + Number(r.ap_vencido),
      arAVencer: acc.arAVencer + Number(r.ar_a_vencer),
      arVencido: acc.arVencido + Number(r.ar_vencido),
    }),
    { apAVencer: 0, apVencido: 0, arAVencer: 0, arVencido: 0 },
  );

  const hasAnything =
    total.apAVencer + total.apVencido + total.arAVencer + total.arVencido > 0 ||
    budgetVsActual?.temOrcamento;
  if (!hasAnything) return null;

  return (
    <div className="mb-6 grid gap-4 md:grid-cols-3 animate-fade-in" data-testid="group-ap-ar">
      <Link to="/fiscal/contas-a-pagar" className="rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted/40">
        <div className="mb-1 flex items-center gap-2 text-sm font-medium">
          <ArrowDownCircle className="h-4 w-4 text-[hsl(var(--destructive))]" /> A pagar (grupo)
        </div>
        <div className="text-2xl font-semibold tabular-nums">{brl(total.apAVencer + total.apVencido)}</div>
        <p className="mt-1 text-xs text-muted-foreground">
          {total.apVencido > 0
            ? <span className="text-[hsl(var(--destructive))]">{brl(total.apVencido)} vencido</span>
            : "nada vencido"}
        </p>
      </Link>

      <Link to="/agents" className="rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted/40">
        <div className="mb-1 flex items-center gap-2 text-sm font-medium">
          <ArrowUpCircle className="h-4 w-4 text-[hsl(var(--success))]" /> A receber (grupo)
        </div>
        <div className="text-2xl font-semibold tabular-nums">{brl(total.arAVencer + total.arVencido)}</div>
        <p className="mt-1 text-xs text-muted-foreground">
          {total.arVencido > 0
            ? <span className="text-[hsl(var(--warning))]">{brl(total.arVencido)} vencido — o Agente de Cobrança pode agir</span>
            : "nada vencido"}
        </p>
      </Link>

      <Link to="/budget" className="rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted/40">
        <div className="mb-1 flex items-center gap-2 text-sm font-medium">
          <Target className="h-4 w-4 text-primary" /> Orçamento do grupo (mês)
        </div>
        {budgetVsActual?.temOrcamento ? (
          <>
            <div className="text-2xl font-semibold tabular-nums">
              {budgetVsActual.orcadoReceita > 0
                ? formatPercent((budgetVsActual.realReceita / budgetVsActual.orcadoReceita) * 100, 0)
                : "—"}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              da receita orçada realizada · gasto {brl(budgetVsActual.realGasto)} de {brl(budgetVsActual.orcadoGasto)}
            </p>
          </>
        ) : (
          <>
            <div className="text-2xl font-semibold text-muted-foreground">—</div>
            <p className="mt-1 text-xs text-muted-foreground">Defina o orçamento mensal para acompanhar aqui</p>
          </>
        )}
      </Link>
    </div>
  );
}
