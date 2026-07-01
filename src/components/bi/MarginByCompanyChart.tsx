import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell,
} from "recharts";
import { formatCurrency } from "@/lib/utils";
import { formatPercent, companyColor, type CompanyMargin } from "@/lib/margin";

interface MarginByCompanyChartProps {
  data: CompanyMargin[];
}

interface Datum {
  name: string;
  receita: number;
  margem: number;
  index: number;
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: Datum }> }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-md border border-border bg-card p-3 text-xs shadow-card">
      <p className="mb-1 font-semibold text-foreground">{d.name}</p>
      <p className="text-muted-foreground">Receita: <span className="font-mono text-foreground">{formatCurrency(d.receita)}</span></p>
      <p className="text-muted-foreground">Margem Operac.: <span className="font-mono text-foreground">{formatPercent(d.margem)}</span></p>
    </div>
  );
}

/** Compara receita e margem operacional lado a lado por CNPJ. */
export function MarginByCompanyChart({ data }: MarginByCompanyChartProps) {
  const chartData: Datum[] = data.map((c, index) => ({
    name: c.name.length > 14 ? `${c.name.slice(0, 14)}…` : c.name,
    receita: c.receita,
    margem: Math.round(c.margemOperacional * 10) / 10,
    index,
  }));

  return (
    <div className="animate-slide-up rounded-lg border border-border bg-card p-5" style={{ animationDelay: "350ms", animationFillMode: "backwards" }}>
      <h2 className="mb-4 text-sm font-semibold text-foreground">Receita × Margem Operacional por CNPJ</h2>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} interval={0} />
          <YAxis yAxisId="left" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
          <YAxis yAxisId="right" orientation="right" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: "hsl(var(--muted) / 0.4)" }} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }} />
          <Bar yAxisId="left" dataKey="receita" name="Receita" radius={[4, 4, 0, 0]}>
            {chartData.map((d) => (
              <Cell key={d.index} fill={companyColor(d.index)} />
            ))}
          </Bar>
          <Line yAxisId="right" dataKey="margem" name="Margem Operac. (%)" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4, fill: "hsl(var(--primary))" }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
