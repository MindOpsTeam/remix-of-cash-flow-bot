import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";
import { formatCurrency } from "@/lib/utils";
import { formatPercent, type CompanyMargin } from "@/lib/margin";
import { ChartEmptyState, ChartPanel } from "@/components/bi/ChartPanel";

interface MarginByCompanyChartProps {
  data: CompanyMargin[];
}

interface Datum {
  name: string;
  fullName: string;
  receita: number;
  resultado: number;
  margem: number;
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: Datum }> }) {
  if (!active || !payload?.length) return null;
  const datum = payload[0].payload;

  return (
    <div className="rounded-md border border-border bg-card p-3 text-xs shadow-card">
      <p className="mb-2 font-semibold text-foreground">{datum.fullName}</p>
      <div className="space-y-1 text-muted-foreground">
        <p>Margem operacional: <span className="font-mono font-semibold text-foreground">{formatPercent(datum.margem)}</span></p>
        <p>Receita: <span className="font-mono text-foreground">{formatCurrency(datum.receita)}</span></p>
        <p>Resultado: <span className="font-mono text-foreground">{formatCurrency(datum.resultado)}</span></p>
      </div>
    </div>
  );
}

/** Ranking direto de margem operacional, sem misturar unidades em dois eixos. */
export function MarginByCompanyChart({ data }: MarginByCompanyChartProps) {
  const hasData = data.some((company) => company.receita !== 0 || company.custos !== 0 || company.despesas !== 0);
  const chartData: Datum[] = [...data]
    .sort((a, b) => b.margemOperacional - a.margemOperacional)
    .slice(0, 8)
    .map((company) => ({
      name: company.name.length > 16 ? `${company.name.slice(0, 16)}…` : company.name,
      fullName: company.name,
      receita: company.receita,
      resultado: company.resultado,
      margem: Math.round(company.margemOperacional * 10) / 10,
    }));

  const margins = chartData.map((company) => company.margem);
  const minMargin = Math.min(0, ...margins);
  const maxMargin = Math.max(0, ...margins);
  const padding = Math.max(5, (maxMargin - minMargin) * 0.12);
  const domain: [number, number] = minMargin === 0 && maxMargin === 0
    ? [-5, 5]
    : [
        Math.floor((minMargin - (minMargin < 0 ? padding : 0)) / 5) * 5,
        Math.ceil((maxMargin + (maxMargin > 0 ? padding : 0)) / 5) * 5,
      ];

  return (
    <ChartPanel
      title="Margem por CNPJ"
      description="Ranking operacional; valores negativos exigem atenção"
      delay={300}
      meta={<span className="rounded-sm bg-muted px-2 py-1 text-[11px] text-muted-foreground">até 8 CNPJs</span>}
    >
      {!hasData ? (
        <ChartEmptyState
          description="O ranking será calculado quando houver movimentação financeira no período."
          minHeight={284}
        />
      ) : (
        <div className="h-[300px] w-full" aria-label="Ranking de margem operacional por CNPJ">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 4, right: 18, bottom: 0, left: 4 }}
            >
              <CartesianGrid strokeDasharray="3 5" horizontal={false} />
              <XAxis
                type="number"
                domain={domain}
                tickFormatter={(value) => `${value}%`}
                tick={{ fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={112}
                tick={{ fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <ReferenceLine x={0} stroke="var(--via-data-axis)" />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: "hsl(var(--muted) / 0.35)" }} />
              <Bar dataKey="margem" name="Margem operacional" barSize={18} radius={4}>
                {chartData.map((company) => (
                  <Cell
                    key={company.fullName}
                    fill={company.margem < 0 ? "var(--via-coral)" : "var(--via-data-1)"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartPanel>
  );
}
