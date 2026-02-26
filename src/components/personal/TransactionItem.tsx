import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2, Zap, Pencil, Upload, Repeat, CreditCard, Wallet } from "lucide-react";
import type { PersonalTransaction } from "@/hooks/usePersonalTransactions";

function fmt(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

const sourceConfig: Record<string, { icon: typeof Zap; label: string }> = {
  asaas: { icon: Zap, label: "Asaas" },
  imported: { icon: Upload, label: "Importado" },
  manual: { icon: Pencil, label: "Manual" },
};

interface TransactionItemProps {
  transaction: PersonalTransaction;
  onDelete: (id: string) => void;
}

export function TransactionItem({ transaction: t, onDelete }: TransactionItemProps) {
  const isAsaas = t.source === "asaas";
  const isImported = t.source === "imported";
  const isManual = !isAsaas && !isImported;
  const src = sourceConfig[t.source || "manual"] || sourceConfig.manual;
  const SourceIcon = src.icon;

  const categoryColor = t.personal_categories?.color || undefined;
  const categoryIcon = t.personal_categories?.icon;

  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
      {/* Category icon or source icon */}
      <div
        className="flex-shrink-0 h-9 w-9 rounded-full flex items-center justify-center text-sm"
        style={{
          backgroundColor: categoryColor ? `${categoryColor}20` : "hsl(var(--muted))",
          color: categoryColor || "hsl(var(--muted-foreground))",
        }}
      >
        {categoryIcon ? (
          <span className="text-base">{categoryIcon}</span>
        ) : (
          <SourceIcon className="h-4 w-4" />
        )}
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="text-sm font-medium truncate">{t.title}</p>
          {t.is_recurring && <Repeat className="h-3 w-3 text-muted-foreground flex-shrink-0" />}
        </div>

        {t.description && (
          <p className="text-xs text-muted-foreground truncate">{t.description}</p>
        )}

        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-muted-foreground">
            {t.date ? new Date(t.date + "T00:00:00").toLocaleDateString("pt-BR") : "—"}
          </span>

          {t.personal_accounts && (
            <span className="text-xs text-muted-foreground flex items-center gap-0.5">
              <Wallet className="h-3 w-3" /> {t.personal_accounts.name}
            </span>
          )}

          {t.personal_credit_cards && (
            <span className="text-xs text-muted-foreground flex items-center gap-0.5">
              <CreditCard className="h-3 w-3" /> {t.personal_credit_cards.name}
            </span>
          )}

          {t.person && (
            <span className="text-xs text-muted-foreground">• {t.person}</span>
          )}
        </div>

        <div className="flex items-center gap-1 flex-wrap">
          {t.personal_categories && (
            <Badge
              variant="secondary"
              className="text-[10px] px-1.5 py-0"
              style={{
                backgroundColor: categoryColor ? `${categoryColor}15` : undefined,
                color: categoryColor || undefined,
                borderColor: categoryColor ? `${categoryColor}30` : undefined,
              }}
            >
              {t.personal_categories.name}
            </Badge>
          )}

          {t.status && t.status !== "confirmed" && t.status !== "received" && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize">
              {t.status}
            </Badge>
          )}

          {isAsaas && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-0.5 border-primary/30 text-primary">
              <Zap className="h-2.5 w-2.5" /> Asaas
            </Badge>
          )}

          {isImported && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-0.5">
              <Upload className="h-2.5 w-2.5" /> Importado
            </Badge>
          )}

          {isAsaas && t.billing_type && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {t.billing_type}
            </Badge>
          )}

          {t.kakeibo_group && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 opacity-60">
              {t.kakeibo_group}
            </Badge>
          )}
        </div>
      </div>

      {/* Amount + delete */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className={`text-sm font-semibold font-mono ${t.type === "receita" ? "text-revenue" : "text-destructive"}`}>
          {t.type === "receita" ? "+" : "-"}{fmt(Number(t.amount))}
        </span>
        {isManual && (
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDelete(t.id)}>
            <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        )}
      </div>
    </div>
  );
}
