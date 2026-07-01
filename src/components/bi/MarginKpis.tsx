import { DollarSign, TrendingDown, Layers, PiggyBank, Percent, Wallet } from "lucide-react";
import { KPICard } from "@/components/KPICard";
import type { MarginTotals } from "@/lib/margin";

interface MarginKpisProps {
  current: MarginTotals;
  previous: MarginTotals;
}

function pctChange(cur: number, prev: number): number {
  if (prev === 0) return cur > 0 ? 100 : cur < 0 ? -100 : 0;
  return ((cur - prev) / Math.abs(prev)) * 100;
}

/** Linha de KPIs focada em margem — o coração do painel. */
export function MarginKpis({ current, previous }: MarginKpisProps) {
  const kpis = [
    {
      label: "Receita",
      value: current.receita,
      change: pctChange(current.receita, previous.receita),
      icon: <DollarSign className="h-4 w-4" />,
      delay: 0,
    },
    {
      label: "Custos (CMV)",
      value: current.custos,
      change: pctChange(current.custos, previous.custos),
      icon: <Layers className="h-4 w-4" />,
      delay: 50,
    },
    {
      label: "Despesas",
      value: current.despesas,
      change: pctChange(current.despesas, previous.despesas),
      icon: <TrendingDown className="h-4 w-4" />,
      delay: 100,
    },
    {
      label: "Margem Bruta",
      value: current.margemBruta,
      change: current.margemBruta - previous.margemBruta,
      icon: <Percent className="h-4 w-4" />,
      format: "percentage" as const,
      delay: 150,
    },
    {
      label: "Margem Operacional",
      value: current.margemOperacional,
      change: current.margemOperacional - previous.margemOperacional,
      icon: <PiggyBank className="h-4 w-4" />,
      format: "percentage" as const,
      delay: 200,
    },
    {
      label: "Resultado",
      value: current.resultado,
      change: pctChange(current.resultado, previous.resultado),
      icon: <Wallet className="h-4 w-4" />,
      delay: 250,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {kpis.map((kpi) => (
        <KPICard key={kpi.label} {...kpi} />
      ))}
    </div>
  );
}
