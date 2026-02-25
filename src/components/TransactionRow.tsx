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
    <div className="flex items-center justify-between py-3 px-4 border-b border-[hsl(240,5%,96%)] hover:bg-background transition-colors duration-150 group">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className={`h-8 w-8 rounded-md flex items-center justify-center shrink-0 ${
          isRevenue ? "bg-[hsl(152,81%,96%)] text-revenue" : "bg-[hsl(356,100%,97%)] text-expense"
        }`}>
          {sourceIcons[transaction.source]}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{transaction.description}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-[11px] text-muted-foreground">{formatDate(transaction.date)}</span>
            {transaction.account_name && (
              <>
                <span className="text-[11px] text-muted-foreground">•</span>
                <span className="text-[11px] text-muted-foreground">{transaction.account_name}</span>
              </>
            )}
            {transaction.cost_center_name && (
              <>
                <span className="text-[11px] text-muted-foreground">•</span>
                <span className="text-[11px] text-primary font-medium">{transaction.cost_center_name}</span>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <Badge variant={transaction.status === "pending" ? "outline" : "secondary"} className="text-[11px] hidden sm:flex">
          {statusLabels[transaction.status] || transaction.status}
        </Badge>
        <span className={`text-sm font-semibold font-mono tabular-nums ${isRevenue ? "text-revenue" : "text-expense"}`}>
          {isRevenue ? "+" : "-"} {formatCurrency(transaction.amount)}
        </span>
      </div>
    </div>
  );
}
