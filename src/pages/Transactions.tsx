import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/AppLayout";
import { TransactionRow } from "@/components/TransactionRow";
import { TransactionForm } from "@/components/TransactionForm";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { formatCurrency, formatDate } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Filter } from "lucide-react";
import type { Transaction } from "@/lib/mock-data";

export default function Transactions() {
  const { company } = useCompany();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [search, setSearch] = useState("");

  const fetchTransactions = useCallback(async () => {
    if (!company) return;
    const { data } = await supabase
      .from("transactions")
      .select("*")
      .eq("company_id", company.id)
      .order("date", { ascending: false });

    if (data) {
      setTransactions(
        data.map((t) => ({
          id: t.id,
          date: t.date,
          description: t.description,
          amount: Number(t.amount),
          type: t.type as "revenue" | "expense",
          category: "",
          account: "",
          status: t.status as any,
          source: t.source as any,
        }))
      );
    }
  }, [company]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const filtered = transactions.filter((t) =>
    t.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Lançamentos</h1>
          <p className="text-sm text-muted-foreground mt-1">Receitas e despesas da empresa</p>
        </div>
        <Button className="gap-2" onClick={() => setFormOpen(true)}>
          <Plus className="h-4 w-4" />
          Novo Lançamento
        </Button>
      </div>

      <div className="glass-card p-5">
        <div className="flex gap-3 mb-6">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar lançamentos..."
              className="pl-9 bg-background/50"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground text-sm">Nenhum lançamento encontrado.</p>
            <Button variant="outline" className="mt-4 gap-2" onClick={() => setFormOpen(true)}>
              <Plus className="h-4 w-4" />
              Criar primeiro lançamento
            </Button>
          </div>
        ) : (
          <div className="space-y-0.5">
            {filtered.map((t) => (
              <TransactionRow key={t.id} transaction={t} />
            ))}
          </div>
        )}
      </div>

      <TransactionForm open={formOpen} onOpenChange={setFormOpen} onSuccess={fetchTransactions} />
    </AppLayout>
  );
}
