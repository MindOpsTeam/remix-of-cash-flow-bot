import { formatCurrency, formatDate } from "@/lib/mock-data";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Building2, Pencil } from "lucide-react";

const sourceIcons: Record<string, React.ReactNode> = {
  whatsapp: <MessageSquare className="h-3 w-3" />,
  bank: <Building2 className="h-3 w-3" />,
  manual: <Pencil className="h-3 w-3" />,
};

const statusLabels: Record<string, string> = {
  confirmed: "Confirmado",
  pending: "Pendente",
  reconciled: "Conciliado",
};

export interface TransactionRowData {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: "revenue" | "expense" | string;
  status: string;
  source: string;
  account_name?: string;
  cost_center_name?: string;
  category?: string;
}

interface TransactionRowProps {
  transaction: TransactionRowData;
}

export function TransactionRow({ transaction }: TransactionRowProps) {
  const isRevenue = transaction.type === "revenue";

  return (
    <div className="flex items-center justify-between py-3 px-4 border-b border-border/50 hover:bg-secondary/40 transition-colors duration-150">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
          isRevenue ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"
        }`}>
          {sourceIcons[transaction.source]}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{transaction.description}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-xs text-muted-foreground">{formatDate(transaction.date)}</span>
            {transaction.account_name && (
              <>
                <span className="text-xs text-muted-foreground">•</span>
                <span className="text-xs text-muted-foreground">{transaction.account_name}</span>
              </>
            )}
            {transaction.cost_center_name && (
              <>
                <span className="text-xs text-muted-foreground">•</span>
                <span className="text-xs text-primary font-medium">{transaction.cost_center_name}</span>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <Badge variant={transaction.status === "pending" ? "outline" : "secondary"} className="text-xs hidden sm:flex">
          {statusLabels[transaction.status] || transaction.status}
        </Badge>
        <span className={`text-sm font-semibold tabular-nums ${isRevenue ? "text-revenue" : "text-expense"}`}>
          {isRevenue ? "+" : "-"} {formatCurrency(transaction.amount)}
        </span>
      </div>
    </div>
  );
}
