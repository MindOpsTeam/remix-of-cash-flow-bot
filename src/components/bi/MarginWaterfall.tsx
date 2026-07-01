import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { formatCurrency } from "@/lib/utils";
import { formatPercent, type MarginTotals } from "@/lib/margin";

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
    { name: "Receita", base: 0, value: receita, amount: receita, fill: "hsl(var(--revenue))" },
    { name: "Custos", base: margemBrutaValor, value: custos, amount: -custos, fill: "hsl(var(--expense))" },
    { name: "M. Bruta", base: 0, value: margemBrutaValor, amount: margemBrutaValor, fill: "hsl(var(--chart-1))" },
    { name: "Despesas", base: resultado, value: despesas, amount: -despesas, fill: "hsl(var(--warning))" },
    { name: "Resultado", base: 0, value: resultado, amount: resultado, fill: resultado >= 0 ? "hsl(var(--success))" : "hsl(var(--destructive))" },
  ];

  return (
    <div className="animate-slide-up rounded-lg border border-border bg-card p-5" style={{ animationDelay: "350ms", animationFillMode: "backwards" }}>
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-foreground">Composição do Resultado</h2>
        <span className="text-xs text-muted-foreground">
          M. Bruta {formatPercent(totals.margemBruta)} · M. Operac. {formatPercent(totals.margemOperacional)}
        </span>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={steps} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
          <Tooltip content={<WaterfallTooltip />} cursor={{ fill: "hsl(var(--muted) / 0.4)" }} />
          <Bar dataKey="base" stackId="w" fill="transparent" />
          <Bar dataKey="value" stackId="w" radius={[4, 4, 0, 0]}>
            {steps.map((s) => (
              <Cell key={s.name} fill={s.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
