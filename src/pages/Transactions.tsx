import { mensagemDeErro } from "@/lib/erros";
import { useState, useEffect, useCallback, useMemo } from "react";
import { AppLayout } from "@/components/AppLayout";
import { TransactionRow } from "@/components/TransactionRow";
import { TransactionForm } from "@/components/TransactionForm";
import { TransactionEditForm } from "@/components/TransactionEditForm";
import { ImportarExtrato } from "@/components/importar/ImportarExtrato";
import { LancamentoRapido } from "@/components/lancamentos/LancamentoRapido";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { useRealtimeInvalidation } from "@/hooks/useRealtimeInvalidation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Search, ChevronLeft, ChevronRight, ClipboardPaste, Inbox } from "lucide-react";
import { Link as RouterLink } from "react-router-dom";
import { ConnectFirstCTA } from "@/components/openfinance/ConnectFirstCTA";
import { toast } from "sonner";
import type { TransactionRowData } from "@/components/TransactionRow";

const ITEMS_PER_PAGE = 25;

export default function Transactions() {
  const { company } = useCompany();
  const [transactions, setTransactions] = useState<TransactionRowData[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [editingTransaction, setEditingTransaction] = useState<TransactionRowData | null>(null);
  const [deletingTransaction, setDeletingTransaction] = useState<TransactionRowData | null>(null);

  const realtimeConfigs = useMemo(() => {
    if (!company?.id) return [];
    return [{
      table: "transactions",
      filter: `company_id=eq.${company.id}`,
      queryKeys: [] as string[][],
    }];
  }, [company?.id]);

  // We use a custom approach: on realtime event, bump refreshKey to trigger refetch
  useEffect(() => {
    if (!company?.id) return;

    const channel = supabase
      .channel(`pj-transactions-${company.id}`)
      .on(
        "postgres_changes" as any,
        {
          event: "*",
          schema: "public",
          table: "transactions",
          filter: `company_id=eq.${company.id}`,
        },
        () => {
          setRefreshKey((k) => k + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [company?.id]);

  const fetchTransactions = useCallback(async () => {
    if (!company) return;

    let query = supabase
      .from("transactions")
      .select("*, chart_of_accounts(name), cost_centers(name)", { count: "exact" })
      .eq("company_id", company.id)
      .order("date", { ascending: false });

    if (search.trim()) {
      query = query.ilike("description", `%${search.trim()}%`);
    }

    const from = page * ITEMS_PER_PAGE;
    const to = from + ITEMS_PER_PAGE - 1;
    query = query.range(from, to);

    const { data, count } = await query;

    if (data) {
      setTransactions(
        data.map((t: any) => ({
          id: t.id,
          date: t.date,
          description: t.description,
          amount: Number(t.amount),
          type: t.type,
          status: t.status,
          source: t.source,
          account_name: t.chart_of_accounts?.name || "",
          cost_center_name: t.cost_centers?.name || "",
        }))
      );
    }
    if (count !== null) setTotalCount(count);
  }, [company, page, search]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions, refreshKey]);

  useEffect(() => {
    setPage(0);
  }, [search]);

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);
  const showingFrom = totalCount > 0 ? page * ITEMS_PER_PAGE + 1 : 0;
  const showingTo = Math.min((page + 1) * ITEMS_PER_PAGE, totalCount);

  return (
    <AppLayout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-[-0.02em]">Lançamentos</h1>
          <p className="text-sm text-muted-foreground mt-1">Receitas e despesas da empresa</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ImportarExtrato
            trigger={
              <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground">
                <ClipboardPaste className="h-4 w-4" />
                Colar extrato
              </Button>
            }
            onImportado={fetchTransactions}
          />
          <Button asChild variant="outline" className="gap-2">
            <RouterLink to="/bank-inbox">
              <Inbox className="h-4 w-4" />
              Extrato bancário
            </RouterLink>
          </Button>
          <Button className="gap-2" variant="accent" onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" />
            Novo Lançamento
          </Button>
        </div>
      </div>

      <div className="mb-6">
        <LancamentoRapido onLancado={fetchTransactions} />
      </div>

      <div className="bg-card border border-border rounded-lg p-5">
        <div className="flex gap-3 mb-6">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar lançamentos..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {transactions.length === 0 ? (
          <div className="py-12">
            <ConnectFirstCTA onImportado={fetchTransactions} />
            <div className="mt-3 flex justify-center">
              <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground" onClick={() => setFormOpen(true)}>
                <Plus className="h-4 w-4" />
                ou crie um lançamento manual
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-0">
              {transactions.map((t) => (
                <TransactionRow
                  key={t.id}
                  transaction={t}
                  onEdit={setEditingTransaction}
                  onDelete={setDeletingTransaction}
                />
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
                <p className="text-sm text-muted-foreground">
                  {showingFrom}–{showingTo} de {totalCount}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                    aria-label="Página anterior"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground px-2">
                    {page + 1} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                    aria-label="Próxima página"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <TransactionForm open={formOpen} onOpenChange={setFormOpen} onSuccess={fetchTransactions} />

      <TransactionEditForm
        open={!!editingTransaction}
        onOpenChange={(open) => { if (!open) setEditingTransaction(null); }}
        transaction={editingTransaction}
        onSuccess={() => { setRefreshKey((k) => k + 1); }}
      />

      <AlertDialog open={!!deletingTransaction} onOpenChange={() => setDeletingTransaction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lançamento?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita. O lançamento será removido permanentemente.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!deletingTransaction) return;
                const { error } = await supabase.from("transactions").delete().eq("id", deletingTransaction.id);
                if (error) toast.error("Erro ao excluir: " + mensagemDeErro(error));
                else { toast.success("Lançamento excluído!"); setRefreshKey((k) => k + 1); }
                setDeletingTransaction(null);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
