import { Link } from "react-router-dom";
import { ChartPanel, ChartEmptyState } from "@/components/bi/ChartPanel";
import { formatCurrency } from "@/lib/utils";

/**
 * Para onde a despesa do mês está indo, por centro de custo. Responde a
 * pergunta que a margem sozinha não responde: "cortar onde?".
 */
interface CentroCustoCardProps {
  centros: Array<{ nome: string; total: number }>;
}

export function CentroCustoCard({ centros }: CentroCustoCardProps) {
  const maior = centros[0]?.total ?? 0;
  const total = centros.reduce((s, c) => s + c.total, 0);

  return (
    <ChartPanel
      title="Despesa por centro de custo"
      description="Onde o dinheiro do mês está sendo gasto"
      delay={300}
      meta={
        centros.length > 0 ? (
          <span className="font-mono text-sm font-semibold text-foreground">{formatCurrency(total)}</span>
        ) : undefined
      }
    >
      {centros.length === 0 ? (
        <ChartEmptyState
          title="Sem despesa classificada no mês"
          description="Classifique os lançamentos por centro de custo e a distribuição aparece aqui."
          minHeight={180}
        />
      ) : (
        <div className="space-y-3">
          {centros.map((centro) => {
            const pct = maior > 0 ? (centro.total / maior) * 100 : 0;
            return (
              <div key={centro.nome}>
                <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
                  <span className="truncate font-medium text-foreground">{centro.nome}</span>
                  <span className="shrink-0 font-mono text-muted-foreground">{formatCurrency(centro.total)}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-[var(--via-chart-ink)] transition-[width] duration-500"
                    style={{ width: `${Math.max(pct, 2)}%` }}
                  />
                </div>
              </div>
            );
          })}
          <Link
            to="/reports"
            className="inline-block pt-1 text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            Abrir relatórios completos
          </Link>
        </div>
      )}
    </ChartPanel>
  );
}
