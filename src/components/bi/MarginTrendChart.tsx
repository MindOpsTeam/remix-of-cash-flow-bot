import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { formatPercent, companyColor } from "@/lib/margin";
import type { TrendPoint } from "@/hooks/useMarginBI";
import type { Company } from "@/hooks/useCompany";

interface MarginTrendChartProps {
  data: TrendPoint[];
  companies: Company[];
  isCombined: boolean;
}

function TrendTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-border bg-card p-3 text-xs shadow-card">
      <p className="mb-1 font-semibold text-foreground">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {formatPercent(Number(p.value))}
        </p>
      ))}
    </div>
  );
}

/** Evolução da margem operacional ao longo dos meses. */
export function MarginTrendChart({ data, companies, isCombined }: MarginTrendChartProps) {
  return (
    <div className="animate-slide-up rounded-lg border border-border bg-card p-5" style={{ animationDelay: "400ms", animationFillMode: "backwards" }}>
      <h2 className="mb-4 text-sm font-semibold text-foreground">
        {isCombined ? "Margem Operacional — consolidada e por CNPJ" : "Evolução da Margem Operacional"}
      </h2>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis dataKey="month" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
          <Tooltip content={<TrendTooltip />} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }} />
          <Line
            dataKey="margemOperacional"
            name="Consolidada"
            stroke="hsl(var(--primary))"
            strokeWidth={3}
            dot={false}
          />
          {isCombined && companies.length > 1 &&
            companies.map((c, index) => (
              <Line
                key={c.id}
                dataKey={c.id}
                name={c.name.length > 14 ? `${c.name.slice(0, 14)}…` : c.name}
                stroke={companyColor(index)}
                strokeWidth={1.5}
                strokeDasharray="4 3"
                dot={false}
              />
            ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
