import type { CSSProperties, ReactNode } from "react";
import { BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChartPanelProps {
  title: string;
  description?: string;
  meta?: ReactNode;
  children: ReactNode;
  className?: string;
  delay?: number;
}

export function ChartPanel({
  title,
  description,
  meta,
  children,
  className,
  delay = 0,
}: ChartPanelProps) {
  const style: CSSProperties = {
    animationDelay: `${delay}ms`,
    animationFillMode: "backwards",
  };

  return (
    <section className={cn("via-chart-panel animate-slide-up min-w-0 p-5 sm:p-6", className)} style={style}>
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-foreground">{title}</h2>
          {description ? <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p> : null}
        </div>
        {meta ? <div className="shrink-0">{meta}</div> : null}
      </header>
      {children}
    </section>
  );
}

interface ChartEmptyStateProps {
  title?: string;
  description: string;
  minHeight?: number;
}

export function ChartEmptyState({
  title = "Sem dados para visualizar",
  description,
  minHeight = 248,
}: ChartEmptyStateProps) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-md border border-dashed border-border/80 bg-muted/20 px-6 text-center"
      style={{ minHeight }}
      role="status"
    >
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-md border border-border bg-card text-muted-foreground">
        <BarChart3 className="h-5 w-5" strokeWidth={1.6} />
      </div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">{description}</p>
    </div>
  );
}
