import { formatCurrency, formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MessageSquare, Building2, Pencil, Trash2 } from "lucide-react";
import { RatearLancamento } from "@/components/lancamentos/RatearLancamento";
import { useDetalhe } from "@/components/detalhe/DetalheProvider";

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
  onEdit?: (transaction: TransactionRowData) => void;
  onDelete?: (transaction: TransactionRowData) => void;
}

export function TransactionRow({ transaction, onEdit, onDelete }: TransactionRowProps) {
  const isRevenue = transaction.type === "revenue";
  const isExternal = transaction.source === "asaas" || transaction.source === "bank";

  const { abrirDetalhe } = useDetalhe();
  // A própria linha tem role="button": excluir currentTarget, senão o closest
  // encontra a si mesma e nenhum clique passa.
  const alvoInterativo = (e: { target: unknown; currentTarget: unknown }) => {
    const alvo = (e.target as HTMLElement | null)?.closest?.("button, a, input, [role='button']");
    return !!alvo && alvo !== e.currentTarget;
  };

  return (
    // A linha inteira abre o lançamento; os botões de ação seguem intactos.
    <div
      role="button"
      tabIndex={0}
      aria-label={`Abrir detalhes de ${transaction.description}`}
      onClick={(e) => { if (!alvoInterativo(e)) abrirDetalhe({ tipo: "transaction", id: transaction.id }); }}
      onKeyDown={(e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        if (alvoInterativo(e)) return;
        e.preventDefault();
        abrirDetalhe({ tipo: "transaction", id: transaction.id });
      }}
      className="group flex cursor-pointer items-center justify-between border-b border-border/70 px-4 py-3 transition-colors duration-150 hover:bg-muted/40 focus:outline-none focus-visible:bg-muted/50 focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-primary/40"
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className={`h-8 w-8 rounded-md flex items-center justify-center shrink-0 ${
          isRevenue ? "bg-success/[0.08] text-revenue" : "bg-destructive/[0.08] text-expense"
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
      <div className="flex items-center gap-3">
        <Badge variant={transaction.status === "pending" ? "outline" : "secondary"} className="text-[11px] hidden sm:flex">
          {statusLabels[transaction.status] || transaction.status}
        </Badge>
        <span className={`text-sm font-semibold font-mono tabular-nums ${isRevenue ? "text-revenue" : "text-expense"}`}>
          {isRevenue ? "+" : "-"} {formatCurrency(transaction.amount)}
        </span>
        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <RatearLancamento
            transactionId={transaction.id}
            descricao={transaction.description}
            valor={Number(transaction.amount)}
          />
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit?.(transaction)}>
            <Pencil className="h-3 w-3" />
          </Button>
          {!isExternal && (
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onDelete?.(transaction)}>
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
