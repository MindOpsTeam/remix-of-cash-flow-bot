import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { formatCurrency } from "@/lib/utils";
import { companyColor, type CompanyMargin } from "@/lib/margin";

interface RevenueContributionChartProps {
  data: CompanyMargin[];
}

/** Participação de cada CNPJ na receita combinada. */
export function RevenueContributionChart({ data }: RevenueContributionChartProps) {
  const total = data.reduce((s, c) => s + c.receita, 0);
  const slices = data
    .filter((c) => c.receita > 0)
    .map((c, index) => ({ name: c.name, value: c.receita, color: companyColor(index) }));

  return (
    <div className="animate-slide-up rounded-lg border border-border bg-card p-5" style={{ animationDelay: "450ms", animationFillMode: "backwards" }}>
      <h2 className="mb-4 text-sm font-semibold text-foreground">Participação na Receita</h2>
      {slices.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">Sem receita no período</p>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={slices} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={2} strokeWidth={0}>
                {slices.map((s) => (
                  <Cell key={s.name} fill={s.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number) => [formatCurrency(value), "Receita"]}
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12 }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="w-full space-y-1.5">
            {slices.map((s) => (
              <div key={s.name} className="flex items-center gap-2 text-xs">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
                <span className="min-w-0 flex-1 truncate text-foreground">{s.name}</span>
                <span className="font-mono text-muted-foreground">{total > 0 ? ((s.value / total) * 100).toFixed(1) : "0.0"}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
