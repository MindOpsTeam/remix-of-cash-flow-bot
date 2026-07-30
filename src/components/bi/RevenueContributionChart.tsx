import { formatCurrency } from "@/lib/utils";
import { companyColor, type CompanyMargin } from "@/lib/margin";
import { ChartEmptyState, ChartPanel } from "@/components/bi/ChartPanel";

interface RevenueContributionChartProps {
  data: CompanyMargin[];
}

/** Participação de cada CNPJ na receita combinada, em formato comparável. */
export function RevenueContributionChart({ data }: RevenueContributionChartProps) {
  const total = data.reduce((sum, company) => sum + company.receita, 0);
  const rows = data
    .map((company, index) => ({
      name: company.name,
      value: company.receita,
      color: companyColor(index),
    }))
    .filter((company) => company.value > 0)
    .sort((a, b) => b.value - a.value);

  return (
    <ChartPanel
      title="Participação na receita"
      description="Distribuição do faturamento acumulado por CNPJ"
      delay={350}
      meta={(
        <div className="text-right">
          <p className="font-mono text-sm font-semibold text-foreground">{formatCurrency(total)}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">total em 12 meses</p>
        </div>
      )}
    >
      {rows.length === 0 ? (
        <ChartEmptyState
          description="A participação será exibida quando houver receita registrada no período."
          minHeight={238}
        />
      ) : (
        <div className="space-y-5 py-1" aria-label="Distribuição percentual da receita">
          {rows.map((row) => {
            const percentage = total > 0 ? (row.value / total) * 100 : 0;

            return (
              <div key={row.name}>
                <div className="mb-2 flex items-start justify-between gap-4 text-xs">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: row.color }} />
                    <span className="truncate font-medium text-foreground">{row.name}</span>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="font-mono font-semibold text-foreground">{percentage.toFixed(1)}%</span>
                    <span className="ml-2 hidden font-mono text-muted-foreground sm:inline">{formatCurrency(row.value)}</span>
                  </div>
                </div>
                <div
                  className="h-2 overflow-hidden rounded-sm bg-muted"
                  role="progressbar"
                  aria-label={`Participação de ${row.name}`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(percentage)}
                >
                  <div
                    className="h-full rounded-sm transition-[width] duration-500"
                    style={{
                      width: `${Math.max(percentage, 1.5)}%`,
                      background: row.color,
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
