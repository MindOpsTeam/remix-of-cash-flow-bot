import { AppLayout } from "@/components/AppLayout";
import { TransactionRow } from "@/components/TransactionRow";
import { mockTransactions } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Filter } from "lucide-react";

export default function Transactions() {
  return (
    <AppLayout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Lançamentos</h1>
          <p className="text-sm text-muted-foreground mt-1">Receitas e despesas da empresa</p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Lançamento
        </Button>
      </div>

      <div className="glass-card p-5">
        <div className="flex gap-3 mb-6">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar lançamentos..." className="pl-9 bg-background/50" />
          </div>
          <Button variant="outline" size="icon" className="shrink-0">
            <Filter className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-0.5">
          {mockTransactions.map((t) => (
            <TransactionRow key={t.id} transaction={t} />
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
