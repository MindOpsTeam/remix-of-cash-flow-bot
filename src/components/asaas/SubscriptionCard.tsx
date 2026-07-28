import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Repeat, CalendarClock } from "lucide-react";
import type { AsaasSubscription } from "@/types/asaas";

function fmt(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

const cycleLabels: Record<string, string> = {
  WEEKLY: "Semanal",
  BIWEEKLY: "Quinzenal",
  MONTHLY: "Mensal",
  BIMONTHLY: "Bimestral",
  QUARTERLY: "Trimestral",
  SEMIANNUALLY: "Semestral",
  YEARLY: "Anual",
};

const statusConfig: Record<string, { label: string; className: string }> = {
  ACTIVE: { label: "Ativa", className: "bg-revenue/10 text-revenue border-revenue/30" },
  INACTIVE: { label: "Inativa", className: "bg-muted text-muted-foreground" },
  EXPIRED: { label: "Expirada", className: "bg-muted text-muted-foreground" },
  DELETED: { label: "Excluída", className: "bg-destructive/10 text-destructive border-destructive/30" },
};

interface SubscriptionCardProps {
  subscription: AsaasSubscription;
}

export function SubscriptionCard({ subscription: s }: SubscriptionCardProps) {
  const cfg = statusConfig[s.status] || { label: s.status, className: "" };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center bg-primary/10 text-primary">
              <Repeat className="h-4 w-4" />
            </div>
            <p className="text-sm font-medium truncate">
              {s.description || "Assinatura"}
            </p>
          </div>
          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 flex-shrink-0 ${cfg.className}`}>
            {cfg.label}
          </Badge>
        </div>

        <div className="flex items-baseline justify-between">
          <span className="text-xl font-bold font-mono">{fmt(Number(s.value || 0))}</span>
          {s.cycle && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {cycleLabels[s.cycle] || s.cycle}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {s.next_due_date && (
            <span className="flex items-center gap-1">
              <CalendarClock className="h-3 w-3" />
              Próx: {new Date(s.next_due_date + "T00:00:00").toLocaleDateString("pt-BR")}
            </span>
          )}
          {s.billing_type && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {s.billing_type}
            </Badge>
          )}
        </div>

        {s.payment_count != null && s.max_payments != null && (
          <div className="text-xs text-muted-foreground">
            {s.payment_count}/{s.max_payments} pagamentos
          </div>
        )}
      </CardContent>
    </Card>
  );
}
