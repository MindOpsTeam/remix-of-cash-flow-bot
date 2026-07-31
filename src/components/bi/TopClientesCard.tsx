import { Link } from "react-router-dom";
import { ChartPanel, ChartEmptyState } from "@/components/bi/ChartPanel";
import { formatCurrency } from "@/lib/utils";
import type { ClienteMetricRow } from "@/lib/metrics";

/**
 * Concentração de receita por cliente: quem sustenta o faturamento e quanto
 * risco mora nisso. Participação alta do top 5 é um alerta de dependência.
 */
interface TopClientesCardProps {
  top: ClienteMetricRow[];
  participacaoPct: number;
}

export function TopClientesCard({ top, participacaoPct }: TopClientesCardProps) {
  const maior = top[0]?.faturado ?? 0;

  return (
    <ChartPanel
      title="Concentração de clientes"
      description="Maiores clientes por faturamento acumulado"
      delay={250}
      meta={
        top.length > 0 ? (
          <span
            className={`rounded-sm px-2 py-1 text-[11px] font-medium ${
              participacaoPct > 70 ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"
            }`}
          >
            top {top.length} = {participacaoPct.toFixed(0)}%
          </span>
        ) : undefined
      }
    >
      {top.length === 0 ? (
        <ChartEmptyState
          title="Sem faturamento por cliente"
          description="Quando os pedidos e recebíveis tiverem cliente vinculado, a concentração aparece aqui."
          minHeight={180}
        />
      ) : (
        <div className="space-y-3">
          {top.map((cliente) => {
            const pct = maior > 0 ? ((cliente.faturado ?? 0) / maior) * 100 : 0;
            return (
              <div key={cliente.name ?? "sem-nome"}>
                <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
                  <span className="truncate font-medium text-foreground">{cliente.name ?? "Sem nome"}</span>
                  <span className="shrink-0 font-mono text-muted-foreground">{formatCurrency(cliente.faturado ?? 0)}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-[var(--via-data-1)] transition-[width] duration-500"
                    style={{ width: `${Math.max(pct, 2)}%` }}
                  />
                </div>
              </div>
            );
          })}
          <Link
            to="/contacts"
            className="inline-block pt-1 text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            Ver todos os clientes
          </Link>
        </div>
      )}
    </ChartPanel>
  );
}
