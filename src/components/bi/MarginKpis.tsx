import { DollarSign, TrendingDown, Layers, PiggyBank, Percent, Wallet } from "lucide-react";
import { KPICard } from "@/components/KPICard";
import type { MarginTotals } from "@/lib/margin";
import type { TrendPoint } from "@/hooks/useMarginBI";
import { formatCurrency } from "@/lib/utils";

interface MarginKpisProps {
  current: MarginTotals;
  previous: MarginTotals;
  /** Série mensal para sparklines nos cards. */
  trend?: TrendPoint[];
  /** Quando não há período de comparação (ex.: ano sem base anterior). */
  semComparacao?: boolean;
  /** Rótulo do período de comparação nos cards. */
  comparacaoLabel?: string;
  /** Descrição do período para o rodapé da estrutura de saída. */
  periodoDescricao?: string;
}

function pctChange(cur: number, prev: number): number {
  if (prev === 0) return cur > 0 ? 100 : cur < 0 ? -100 : 0;
  return ((cur - prev) / Math.abs(prev)) * 100;
}

/** Quatro indicadores decisórios + estrutura compacta de custos. */
export function MarginKpis({ current, previous, trend, semComparacao, comparacaoLabel, periodoDescricao }: MarginKpisProps) {
  const serie = (chave: (p: TrendPoint) => number) =>
    trend && trend.length > 1 ? trend.map(chave) : undefined;
  const variacao = (cur: number, prev: number) => (semComparacao ? undefined : cur - prev);
  const varPct = (cur: number, prev: number) => (semComparacao ? undefined : pctChange(cur, prev));

  const kpis = [
    {
      label: "Receita",
      value: current.receita,
      change: varPct(current.receita, previous.receita),
      changeLabel: comparacaoLabel,
      icon: <DollarSign className="h-4 w-4" />,
      spark: serie((p) => p.receita),
      delay: 0,
    },
    {
      label: "Resultado",
      value: current.resultado,
      change: varPct(current.resultado, previous.resultado),
      changeLabel: comparacaoLabel,
      icon: <Wallet className="h-4 w-4" />,
      valueTone: current.resultado > 0
        ? "positive" as const
        : current.resultado < 0
          ? "negative" as const
          : "default" as const,
      spark: serie((p) => p.receita - p.custos - p.despesas),
      delay: 50,
    },
    {
      label: "Margem Bruta",
      value: current.margemBruta,
      change: variacao(current.margemBruta, previous.margemBruta),
      changeLabel: comparacaoLabel,
      icon: <Percent className="h-4 w-4" />,
      format: "percentage" as const,
      changeSuffix: "p.p." as const,
      spark: serie((p) => p.margemBruta),
      delay: 100,
    },
    {
      label: "Margem Operacional",
      value: current.margemOperacional,
      change: variacao(current.margemOperacional, previous.margemOperacional),
      changeLabel: comparacaoLabel,
      icon: <PiggyBank className="h-4 w-4" />,
      format: "percentage" as const,
      changeSuffix: "p.p." as const,
      spark: serie((p) => p.margemOperacional),
      delay: 150,
    },
  ];

  const costDrivers = [
    { label: "Custos (CMV)", value: current.custos, icon: Layers },
    { label: "Despesas operacionais", value: current.despesas, icon: TrendingDown },
  ];
  const totalOutflow = current.custos + current.despesas;

  return (
    <div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <KPICard key={kpi.label} {...kpi} />
        ))}
      </div>

      <section
        className="via-chart-panel mt-4 grid overflow-hidden lg:grid-cols-[1.15fr_1fr_1fr]"
        aria-label="Estrutura de custos do mês"
      >
        <div className="flex flex-col justify-center border-b border-border/70 p-4 sm:p-5 lg:border-b-0 lg:border-r">
          <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Estrutura de saída</p>
          <p className="mt-2 font-mono text-xl font-semibold tracking-[-0.035em] text-foreground">
            {formatCurrency(totalOutflow)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Custos e despesas {periodoDescricao ?? "do mês atual"}</p>
        </div>

        {costDrivers.map(({ label, value, icon: DriverIcon }, index) => {
          const share = current.receita > 0 ? (value / current.receita) * 100 : 0;
          const progress = Math.min(Math.max(share, 0), 100);

          return (
            <div
              key={label}
              className={`p-4 sm:p-5 ${index === 0 ? "border-b border-border/70 lg:border-b-0 lg:border-r" : ""}`}
            >
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <DriverIcon className="h-4 w-4" strokeWidth={1.6} />
                {label}
              </div>
              <div className="mt-3 flex items-end justify-between gap-3">
                <span className="font-mono text-lg font-semibold tracking-[-0.03em] text-foreground">
                  {formatCurrency(value)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {current.receita > 0 ? `${share.toFixed(1)}% da receita` : "sem receita"}
                </span>
              </div>
              <div
                className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-label={`${label} sobre a receita`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(progress)}
              >
                <div
                  className="h-full rounded-full bg-[var(--via-chart-ink)] transition-[width] duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
