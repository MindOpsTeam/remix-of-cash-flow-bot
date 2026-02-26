import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Trash2, Zap } from "lucide-react";
import { usePersonalTransactions, PersonalTransactionFormData } from "@/hooks/usePersonalTransactions";
import { usePersonalAccounts } from "@/hooks/usePersonalAccounts";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

function fmt(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

export default function PersonalTransactions() {
  const { transactions, isLoading, filters, setFilters, summary, createTransaction, deleteTransaction, isCreating } =
    usePersonalTransactions();
  const { accounts } = usePersonalAccounts();
  const [formOpen, setFormOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [form, setForm] = useState<PersonalTransactionFormData>({
    title: "", amount: 0, type: "despesa", date: new Date().toISOString().split("T")[0],
  });

  const handleSubmit = () => {
    if (!form.title || !form.amount) return;
    createTransaction(form, {
      onSuccess: () => {
        setFormOpen(false);
        setForm({ title: "", amount: 0, type: "despesa", date: new Date().toISOString().split("T")[0] });
      },
    });
  };

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-[-0.02em]">Transações Pessoais</h1>
            <p className="text-sm text-muted-foreground mt-1">Receitas e despesas pessoais</p>
          </div>
          <Button className="gap-2" onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" /> Nova Transação
          </Button>
        </div>

        {/* Summary */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Receitas</p>
              <p className="text-xl font-bold font-mono text-revenue">{fmt(summary.receitas)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Despesas</p>
              <p className="text-xl font-bold font-mono text-destructive">{fmt(summary.despesas)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Saldo</p>
              <p className={`text-xl font-bold font-mono ${summary.saldo >= 0 ? "text-revenue" : "text-destructive"}`}>{fmt(summary.saldo)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              className="pl-9 bg-background/50"
              value={filters.search || ""}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            />
          </div>
          <Select value={filters.period} onValueChange={(v: any) => setFilters((f) => ({ ...f, period: v }))}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="this_month">Este mês</SelectItem>
              <SelectItem value="last_month">Mês passado</SelectItem>
              <SelectItem value="last_3_months">Últimos 3 meses</SelectItem>
              <SelectItem value="all">Tudo</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* List */}
        <div className="bg-card border border-border rounded-lg divide-y divide-border">
          {isLoading ? (
            <p className="p-6 text-center text-muted-foreground text-sm">Carregando...</p>
          ) : transactions.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground text-sm">Nenhuma transação encontrada.</p>
              <Button variant="outline" className="mt-4 gap-2" onClick={() => setFormOpen(true)}>
                <Plus className="h-4 w-4" /> Criar primeira transação
              </Button>
            </div>
          ) : (
            transactions.map((t) => {
              const isAsaas = t.source === "asaas";
              return (
                <div key={t.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{t.title}</p>
                      {isAsaas && (
                        <Badge variant="outline" className="text-xs gap-1 border-primary/30 text-primary">
                          <Zap className="h-3 w-3" /> Asaas
                        </Badge>
                      )}
                      {t.personal_categories && (
                        <Badge variant="secondary" className="text-xs">{t.personal_categories.name}</Badge>
                      )}
                      {isAsaas && t.billing_type && (
                        <Badge variant="secondary" className="text-[10px]">{t.billing_type}</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t.date ? new Date(t.date + "T00:00:00").toLocaleDateString("pt-BR") : "—"}
                      {t.personal_accounts && ` • ${t.personal_accounts.name}`}
                      {isAsaas && t.person && ` • ${t.person}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-semibold font-mono ${t.type === "receita" ? "text-revenue" : "text-destructive"}`}>
                      {t.type === "receita" ? "+" : "-"}{fmt(Number(t.amount))}
                    </span>
                    {!isAsaas && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDeleteId(t.id)}>
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Create Form Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova Transação</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Título</Label>
              <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Valor</Label>
                <Input type="number" step="0.01" value={form.amount || ""} onChange={(e) => setForm((f) => ({ ...f, amount: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div>
                <Label>Tipo</Label>
                <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="despesa">Despesa</SelectItem>
                    <SelectItem value="receita">Receita</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Data</Label>
                <Input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
              </div>
              <div>
                <Label>Conta</Label>
                <Select value={form.account_id || ""} onValueChange={(v) => setForm((f) => ({ ...f, account_id: v || null }))}>
                  <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Descrição (opcional)</Label>
              <Input value={form.description || ""} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <Button onClick={handleSubmit} disabled={isCreating} className="w-full">
              {isCreating ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir transação?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deleteId) { deleteTransaction(deleteId); setDeleteId(null); } }} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
