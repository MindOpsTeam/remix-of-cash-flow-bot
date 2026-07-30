import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { formatCurrency } from "@/lib/utils";
import { formatPercent, type MarginTotals } from "@/lib/margin";
import { ChartEmptyState, ChartPanel } from "@/components/bi/ChartPanel";

interface MarginWaterfallProps {
  totals: MarginTotals;
}

interface Step {
  name: string;
  base: number; // parte invisível (empilhamento)
  value: number; // altura visível
  amount: number; // valor real do passo
  fill: string;
}

function WaterfallTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: Step }> }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-md border border-border bg-card p-3 text-xs shadow-card">
      <p className="mb-1 font-semibold text-foreground">{d.name}</p>
      <p className="font-mono text-foreground">{formatCurrency(d.amount)}</p>
    </div>
  );
}

/** Ponte Receita → (−Custos) → Margem Bruta → (−Despesas) → Resultado. */
export function MarginWaterfall({ totals }: MarginWaterfallProps) {
  const { receita, custos, despesas, margemBrutaValor, resultado } = totals;

  const steps: Step[] = [
    { name: "Receita", base: 0, value: receita, amount: receita, fill: "var(--via-data-1)" },
    { name: "Custos", base: margemBrutaValor, value: custos, amount: -custos, fill: "var(--via-coral)" },
    { name: "M. Bruta", base: 0, value: margemBrutaValor, amount: margemBrutaValor, fill: "var(--via-data-2)" },
    { name: "Despesas", base: resultado, value: despesas, amount: -despesas, fill: "hsl(var(--destructive) / 0.68)" },
    { name: "Resultado", base: 0, value: resultado, amount: resultado, fill: resultado >= 0 ? "var(--via-success)" : "var(--via-coral)" },
  ];
  const hasData = receita !== 0 || custos !== 0 || despesas !== 0;

  return (
    <ChartPanel
      title="Composição do resultado"
      description="Da receita ao resultado após custos e despesas"
      delay={300}
      meta={(
        <span className="text-xs text-muted-foreground">
          M. Bruta {formatPercent(totals.margemBruta)} · M. Operac. {formatPercent(totals.margemOperacional)}
        </span>
      )}
    >
      {!hasData ? (
        <ChartEmptyState
          description="A composição será exibida quando houver movimentação financeira no período."
          minHeight={264}
        />
      ) : (
        <div className="h-[290px] w-full" aria-label="Composição do resultado financeiro">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={steps} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 5" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<WaterfallTooltip />} cursor={{ fill: "hsl(var(--muted) / 0.35)" }} />
              <Bar dataKey="base" stackId="w" fill="transparent" />
              <Bar dataKey="value" stackId="w" radius={[4, 4, 0, 0]}>
                {steps.map((step) => (
                  <Cell key={step.name} fill={step.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartPanel>
  );
}
