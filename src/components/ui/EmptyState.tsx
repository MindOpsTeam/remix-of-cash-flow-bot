import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  /** Ação primária (ex.: um <Button>). Opcional. */
  action?: React.ReactNode;
  /** Dica secundária discreta abaixo da ação (ex.: link de ajuda). */
  hint?: React.ReactNode;
  className?: string;
}

/**
 * Estado vazio padrão do ERP: um ícone em cápsula com profundidade, título e
 * subtítulo com hierarquia clara e um ponto de ação. Substitui o "texto solto"
 * por um convite ao próximo passo, que é o esperado num ERP de referência.
 */
export function EmptyState({ icon: Icon, title, description, action, hint, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-border/70 bg-card/40 px-6 py-12 text-center",
        className,
      )}
    >
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-border/60 bg-muted/40 shadow-card">
        <Icon className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
      </div>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-[13px] leading-5 text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
      {hint && <div className="mt-3 text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}
