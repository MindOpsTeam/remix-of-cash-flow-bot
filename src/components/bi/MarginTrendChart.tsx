import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from "recharts";
import { formatPercent } from "@/lib/margin";
import type { TrendPoint } from "@/hooks/useMarginBI";
import type { Company } from "@/hooks/useCompany";
import { ChartEmptyState, ChartPanel } from "@/components/bi/ChartPanel";

interface MarginTrendChartProps {
  data: TrendPoint[];
  companies: Company[];
  isCombined: boolean;
}

interface TooltipEntry {
  name: string;
  value: number;
  color: string;
  dataKey: string;
}

const COMPARISON_COLORS = [
  "var(--via-data-2)",
  "var(--via-chart-2)",
  "var(--via-chart-4)",
];

function TrendTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const visibleEntries = payload.filter((entry) => Number.isFinite(Number(entry.value)));

  return (
    <div className="min-w-44 rounded-md border border-border bg-card p-3 text-xs shadow-card">
      <p className="mb-2 font-semibold text-foreground">{label}</p>
      <div className="space-y-1.5">
        {visibleEntries.map((entry) => (
          <div key={entry.dataKey} className="flex items-center justify-between gap-4">
            <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
              <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: entry.color }} />
              <span className="truncate">{entry.name}</span>
            </span>
            <span className="font-mono font-semibold text-foreground">{formatPercent(Number(entry.value))}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Evolução da margem operacional com uma série dominante e comparativos discretos. */
export function MarginTrendChart({ data, companies, isCombined }: MarginTrendChartProps) {
  const hasData = data.some((point) => point.receita !== 0 || point.custos !== 0 || point.despesas !== 0);
  const comparisonCompanies = isCombined ? companies.slice(0, 3) : [];

  return (
    <ChartPanel
      title={isCombined ? "Evolução da margem operacional" : "Margem operacional no tempo"}
      description={isCombined
        ? "Consolidado em destaque e comparação dos principais CNPJs"
        : "Variação mensal dos últimos 12 meses"}
      delay={250}
      meta={<span className="rounded-sm bg-muted px-2 py-1 text-[11px] text-muted-foreground">últimos 12 meses</span>}
    >
      {!hasData ? (
        <ChartEmptyState
          description="A evolução mensal aparecerá quando houver receitas, custos ou despesas registrados."
          minHeight={304}
        />
      ) : (
        <div className="h-[320px] w-full" aria-label="Evolução da margem operacional nos últimos 12 meses">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -8 }}>
              <CartesianGrid strokeDasharray="3 5" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                minTickGap={18}
              />
              <YAxis
                tick={{ fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(value) => `${value}%`}
                width={48}
              />
              <ReferenceLine y={0} stroke="var(--via-data-axis)" />
              <Tooltip content={<TrendTooltip />} />
              {comparisonCompanies.length > 0 ? (
                <Legend
                  verticalAlign="top"
                  align="left"
                  height={38}
                  iconType="plainline"
                  iconSize={14}
                  wrapperStyle={{ fontSize: 11, color: "var(--via-text-muted)" }}
                />
              ) : null}
              <Area
                type="monotone"
                dataKey="margemOperacional"
                name="Consolidada"
                stroke="var(--via-data-1)"
                strokeWidth={2.5}
                fill="hsl(var(--chart-1) / 0.1)"
                activeDot={{ r: 4, strokeWidth: 2, fill: "var(--via-surface)" }}
              />
              {comparisonCompanies.map((company, index) => (
                <Line
                  key={company.id}
                  type="monotone"
                  dataKey={company.id}
                  name={company.name.length > 15 ? `${company.name.slice(0, 15)}…` : company.name}
                  stroke={COMPARISON_COLORS[index % COMPARISON_COLORS.length]}
                  strokeWidth={1.5}
                  strokeDasharray={index % 2 === 0 ? "5 4" : "2 4"}
                  dot={false}
                  activeDot={{ r: 3 }}
                />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartPanel>
  );
}
