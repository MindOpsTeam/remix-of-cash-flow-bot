import { TrendingUp, TrendingDown } from "lucide-react";
import { formatCurrency } from "@/lib/mock-data";
import { ReactNode } from "react";

interface KPICardProps {
  label: string;
  value: number;
  change: number;
  icon: ReactNode;
  format?: "currency" | "percentage";
}

export function KPICard({ label, value, change, icon, format = "currency" }: KPICardProps) {
  const isPositive = change >= 0;
  const formattedValue = format === "currency" ? formatCurrency(value) : `${value.toFixed(1)}%`;

  return (
    <div className="glass-card p-5 kpi-glow transition-transform hover:scale-[1.02] duration-300">
      <div className="flex items-start justify-between mb-3">
        <span className="text-sm text-muted-foreground font-medium">{label}</span>
        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
          {icon}
        </div>
      </div>
      <p className="text-2xl font-bold text-foreground tracking-tight">{formattedValue}</p>
      <div className="flex items-center gap-1.5 mt-2">
        {isPositive ? (
          <TrendingUp className="h-3.5 w-3.5 text-revenue" />
        ) : (
          <TrendingDown className="h-3.5 w-3.5 text-expense" />
        )}
        <span className={`text-xs font-semibold ${isPositive ? "text-revenue" : "text-expense"}`}>
          {isPositive ? "+" : ""}{change.toFixed(1)}%
        </span>
        <span className="text-xs text-muted-foreground">vs mês anterior</span>
      </div>
    </div>
  );
}
