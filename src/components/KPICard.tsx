import { TrendingUp, TrendingDown } from "lucide-react";
import { formatCurrency } from "@/lib/mock-data";
import { ReactNode, useEffect, useRef, useState } from "react";

interface KPICardProps {
  label: string;
  value: number;
  change: number;
  icon: ReactNode;
  format?: "currency" | "percentage";
  delay?: number;
}

function useAnimatedNumber(target: number, duration = 1200, delay = 0) {
  const [current, setCurrent] = useState(0);
  const startTime = useRef<number | null>(null);
  const rafId = useRef<number>();

  useEffect(() => {
    const timeout = setTimeout(() => {
      const animate = (timestamp: number) => {
        if (!startTime.current) startTime.current = timestamp;
        const elapsed = timestamp - startTime.current;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        setCurrent(target * eased);
        if (progress < 1) rafId.current = requestAnimationFrame(animate);
      };
      rafId.current = requestAnimationFrame(animate);
    }, delay);

    return () => {
      clearTimeout(timeout);
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, [target, duration, delay]);

  return current;
}

export function KPICard({ label, value, change, icon, format = "currency", delay = 0 }: KPICardProps) {
  const isPositive = change >= 0;
  const animatedValue = useAnimatedNumber(value, 1200, delay);
  const formattedValue = format === "currency" 
    ? formatCurrency(animatedValue) 
    : `${animatedValue.toFixed(1)}%`;

  return (
    <div 
      className="bg-card border border-border rounded-lg p-5 shadow-card transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] hover:shadow-card-hover hover:border-[hsl(240,4%,84%)] hover:-translate-y-px animate-slide-up"
      style={{ animationDelay: `${delay}ms`, animationFillMode: "backwards" }}
    >
      <div className="flex items-start justify-between mb-3">
        <span className="text-sm text-muted-foreground">{label}</span>
        <div className="h-5 w-5 text-muted-foreground/60">
          {icon}
        </div>
      </div>
      <p className="text-[32px] font-bold text-foreground tracking-[-0.03em] leading-tight font-mono animate-count-up">{formattedValue}</p>
      <div className="flex items-center gap-1.5 mt-2">
        {isPositive ? (
          <TrendingUp className="h-3.5 w-3.5 text-revenue" />
        ) : (
          <TrendingDown className="h-3.5 w-3.5 text-expense" />
        )}
        <span className={`text-xs font-semibold ${isPositive ? "text-revenue" : "text-expense"}`}>
          {isPositive ? "+" : ""}{change.toFixed(1)}%
        </span>
        <span className="text-[11px] text-muted-foreground">vs mês anterior</span>
      </div>
    </div>
  );
}
