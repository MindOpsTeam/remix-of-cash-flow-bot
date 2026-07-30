import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { ReactNode, useEffect, useRef, useState } from "react";

interface KPICardProps {
  label: string;
  value: number;
  change: number;
  icon: ReactNode;
  format?: "currency" | "percentage";
  delay?: number;
  valueTone?: "default" | "positive" | "negative";
  changeSuffix?: "%" | "p.p.";
}

function useAnimatedNumber(target: number, duration = 1200, delay = 0) {
  const [current, setCurrent] = useState(0);
  const startTime = useRef<number | null>(null);
  const rafId = useRef<number>();

  useEffect(() => {
    startTime.current = null;
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

export function KPICard({
  label,
  value,
  change,
  icon,
  format = "currency",
  delay = 0,
  valueTone = "default",
  changeSuffix = "%",
}: KPICardProps) {
  const isPositive = change >= 0;
  const isNeutral = Math.abs(change) < 0.05;
  const animatedValue = useAnimatedNumber(value, 1200, delay);
  const formattedValue = format === "currency"
    ? formatCurrency(animatedValue)
    : `${animatedValue.toFixed(1)}%`;
  const valueToneClass = valueTone === "positive"
    ? "text-revenue"
    : valueTone === "negative"
      ? "text-expense"
      : "text-foreground";

  return (
    <article
      className="via-chart-panel animate-slide-up min-h-[154px] p-4 transition-[transform,box-shadow,border-color] duration-200 ease-via-snap hover:-translate-y-px hover:border-primary/15 hover:shadow-card-hover sm:p-5"
      style={{ animationDelay: `${delay}ms`, animationFillMode: "backwards" }}
    >
      <div className="mb-5 flex items-start justify-between gap-3">
        <span className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">{label}</span>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted/70 text-muted-foreground">
          {icon}
        </div>
      </div>
      <p className={`animate-count-up font-mono text-[clamp(1.55rem,2vw,2rem)] font-semibold leading-none tracking-[-0.045em] ${valueToneClass}`}>
        {formattedValue}
      </p>
      <div className="mt-3 flex min-h-5 items-center gap-1.5">
        {isNeutral ? (
          <>
            <Minus className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">Sem variação</span>
          </>
        ) : isPositive ? (
          <>
            <ArrowUpRight className="h-3.5 w-3.5 text-revenue" />
            <span className="text-xs font-semibold text-revenue">+{change.toFixed(1)}{changeSuffix}</span>
          </>
        ) : (
          <>
            <ArrowDownRight className="h-3.5 w-3.5 text-expense" />
            <span className="text-xs font-semibold text-expense">{change.toFixed(1)}{changeSuffix}</span>
          </>
        )}
        {!isNeutral ? <span className="text-[11px] text-muted-foreground">vs. mês anterior</span> : null}
      </div>
    </article>
  );
}
