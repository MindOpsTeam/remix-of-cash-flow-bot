import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Receipt, Check } from "lucide-react";
import type { AsaasBill } from "@/hooks/useCompanyAsaasBills";

function fmt(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

const statusColors: Record<string, string> = {
  PAID: "text-revenue border-revenue/30",
  PENDING: "text-warning border-warning/30",
  BANK_PROCESSING: "text-primary border-primary/30",
  CANCELLED: "text-muted-foreground border-muted-foreground/30",
  FAILED: "text-destructive border-destructive/30",
  REFUNDED: "text-primary border-primary/30",
};

const statusLabels: Record<string, string> = {
  PAID: "Pago",
  PENDING: "Pendente",
  BANK_PROCESSING: "Processando",
  CANCELLED: "Cancelado",
  FAILED: "Falhou",
  REFUNDED: "Estornado",
  CREATED: "Criado",
};

interface BillItemProps {
  bill: AsaasBill;
  onMarkPaid?: (id: string) => void;
}

export function BillItem({ bill: b, onMarkPaid }: BillItemProps) {
  const today = new Date().toISOString().split("T")[0];
  const isOverdue = b.due_date && b.due_date < today && b.status === "PENDING";
  const isManual = b._source === "manual";

  return (
    <div className={`flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors ${isOverdue ? "border-l-2 border-l-destructive" : ""}`}>
      <div className={`flex-shrink-0 h-9 w-9 rounded-full flex items-center justify-center ${isOverdue ? "bg-destructive/10 text-destructive" : "bg-warning/[0.08] text-warning"}`}>
        <Receipt className="h-4 w-4" />
      </div>

      <div className="flex-1 min-w-0 space-y-0.5">
        <p className="text-sm font-medium truncate">
          {b.company_name || b.description || "Conta a Pagar"}
        </p>

        {b.description && b.company_name && (
          <p className="text-xs text-muted-foreground truncate">{b.description}</p>
        )}

        <div className="flex items-center gap-1.5 flex-wrap">
          {b.due_date && (
            <span className={`text-xs ${isOverdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
              Vence: {new Date(b.due_date + "T00:00:00").toLocaleDateString("pt-BR")}
            </span>
          )}
          {b.type && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {b.type}
            </Badge>
          )}
          {isManual && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-primary border-primary/30">
              Manual
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-1 flex-wrap">
          <Badge
            variant="outline"
            className={`text-[10px] px-1.5 py-0 ${statusColors[b.status] || ""}`}
          >
            {statusLabels[b.status] || b.status}
          </Badge>
          {isOverdue && (
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
              Vencida
            </Badge>
          )}
          {b.fee && Number(b.fee) > 0 && (
            <span className="text-[10px] text-muted-foreground">
              Taxa: {fmt(Number(b.fee))}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-sm font-semibold font-mono text-destructive">
          -{fmt(Number(b.value || 0))}
        </span>
        {isManual && b.status === "PENDING" && onMarkPaid && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs gap-1 text-revenue hover:text-revenue"
            onClick={() => onMarkPaid(b.id)}
          >
            <Check className="h-3 w-3" /> Pagar
          </Button>
        )}
      </div>
    </div>
  );
}
