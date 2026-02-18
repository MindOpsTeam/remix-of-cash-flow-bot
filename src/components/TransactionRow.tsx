import { formatCurrency, formatDate, type Transaction } from "@/lib/mock-data";
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

interface TransactionRowProps {
  transaction: Transaction;
}

export function TransactionRow({ transaction }: TransactionRowProps) {
  const isRevenue = transaction.type === "revenue";

  return (
    <div className="flex items-center justify-between py-3 px-4 hover:bg-accent/30 rounded-lg transition-colors group">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
          isRevenue ? "bg-revenue/10 text-revenue" : "bg-expense/10 text-expense"
        }`}>
          {sourceIcons[transaction.source]}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{transaction.description}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-muted-foreground">{formatDate(transaction.date)}</span>
            <span className="text-xs text-muted-foreground">•</span>
            <span className="text-xs text-muted-foreground">{transaction.category}</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <Badge variant={transaction.status === "pending" ? "outline" : "secondary"} className="text-xs hidden sm:flex">
          {statusLabels[transaction.status]}
        </Badge>
        <span className={`text-sm font-semibold tabular-nums ${isRevenue ? "text-revenue" : "text-expense"}`}>
          {isRevenue ? "+" : "-"} {formatCurrency(transaction.amount)}
        </span>
      </div>
    </div>
  );
}
