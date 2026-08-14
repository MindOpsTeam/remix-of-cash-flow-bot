import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  /** Ações à direita (botões). */
  actions?: ReactNode;
  /** Se informado, mostra a seta de voltar para esta rota. */
  backTo?: string;
  className?: string;
}

/**
 * Cabeçalho de página padrão do ERP: título com escala forte, descrição e ações.
 * Unifica os cabeçalhos hoje escritos à mão em cada tela, dando o mesmo ritmo e
 * hierarquia em toda a aplicação.
 */
export function PageHeader({ title, description, actions, backTo, className }: PageHeaderProps) {
  return (
    <div className={cn("mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between", className)}>
      <div className="flex items-start gap-3">
        {backTo && (
          <Link
            to={backTo}
            aria-label="Voltar"
            className="mt-1 text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
        )}
        <div>
          <h1 className="text-2xl font-bold tracking-[-0.02em] text-foreground">{title}</h1>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
