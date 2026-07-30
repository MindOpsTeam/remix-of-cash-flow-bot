import { Badge } from "@/components/ui/badge";
import { ArrowUpDown, ExternalLink } from "lucide-react";
import type { AsaasTransfer } from "@/types/asaas";

function fmt(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

const statusColors: Record<string, string> = {
  DONE: "text-revenue border-revenue/30",
  PENDING: "text-warning border-warning/30",
  IN_BANK_PROCESSING: "text-primary border-primary/30",
  BLOCKED: "text-destructive border-destructive/30",
  FAILED: "text-destructive border-destructive/30",
  CANCELLED: "text-muted-foreground border-muted-foreground/30",
};

const statusLabels: Record<string, string> = {
  DONE: "Concluída",
  PENDING: "Pendente",
  IN_BANK_PROCESSING: "Processando",
  BLOCKED: "Bloqueada",
  FAILED: "Falhou",
  CANCELLED: "Cancelada",
  CREATED: "Criada",
};

interface TransferItemProps {
  transfer: AsaasTransfer;
}

export function TransferItem({ transfer: t }: TransferItemProps) {
  const bankName = t.bank_account?.bank?.name || t.bank_account?.bankName || null;
  const bankInfo = bankName
    ? `${bankName}${t.bank_account?.accountDigit ? ` ••${t.bank_account.accountDigit}` : ""}`
    : null;

  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
      <div className="flex-shrink-0 h-9 w-9 rounded-full flex items-center justify-center bg-primary/[0.08] text-primary">
        <ArrowUpDown className="h-4 w-4" />
      </div>

      <div className="flex-1 min-w-0 space-y-0.5">
        <p className="text-sm font-medium truncate">
          {t.description || `Transferência ${t.type || ""}`.trim()}
        </p>

        <div className="flex items-center gap-1.5 flex-wrap">
          {t.scheduled_date && (
            <span className="text-xs text-muted-foreground">
              {new Date(t.scheduled_date + "T00:00:00").toLocaleDateString("pt-BR")}
            </span>
          )}
          {bankInfo && (
            <span className="text-xs text-muted-foreground">• {bankInfo}</span>
          )}
          {t.type && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {t.type}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-1 flex-wrap">
          <Badge
            variant="outline"
            className={`text-[10px] px-1.5 py-0 ${statusColors[t.status] || ""}`}
          >
            {statusLabels[t.status] || t.status}
          </Badge>
          {t.fee && Number(t.fee) > 0 && (
            <span className="text-[10px] text-muted-foreground">
              Taxa: {fmt(Number(t.fee))}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-sm font-semibold font-mono text-destructive">
          -{fmt(Number(t.value || 0))}
        </span>
        {t.transaction_receipt_url && (
          <a
            href={t.transaction_receipt_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
    </div>
  );
}
