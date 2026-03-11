import { useState, useMemo } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Zap, Upload, Pencil, Sparkles } from "lucide-react";
import { usePersonalTransactions, PersonalTransactionFormData } from "@/hooks/usePersonalTransactions";
import { usePersonalAccounts } from "@/hooks/usePersonalAccounts";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { TransactionItem } from "@/components/personal/TransactionItem";
import { format, isToday, isYesterday, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

function fmt(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

function formatGroupDate(dateStr: string): string {
  const d = parseISO(dateStr);
  if (isToday(d)) return "Hoje";
  if (isYesterday(d)) return "Ontem";
  return format(d, "dd 'de' MMM", { locale: ptBR });
}

export default function PersonalTransactions() {
  const { transactions, isLoading, filters, setFilters, summary, createTransaction, deleteTransaction, isCreating } =
    usePersonalTransactions();
  const { accounts } = usePersonalAccounts();
  const { user } = useAuth();
  const [formOpen, setFormOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [classifying, setClassifying] = useState(false);

  const { data: categories = [] } = useQuery({
    queryKey: ["personal_categories", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("personal_categories")
        .select("id, name, type, icon")
        .or(`user_id.eq.${user.id},user_id.is.null`)
        .order("name");
      if (error) throw error;
      return data as { id: string; name: string; type: string; icon: string | null }[];
    },
    enabled: !!user,
  });

  const [form, setForm] = useState<PersonalTransactionFormData>({
    title: "", amount: 0, type: "despesa", date: new Date().toISOString().split("T")[0],
  });

  const handleAiClassify = async () => {
    if (!form.title || !user) return;
    setClassifying(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-classify-personal", {
        body: { description: form.title, type: form.type, user_id: user.id },
      });
      if (error) throw error;
      if (data?.category_id) {
        setForm((f) => ({ ...f, category_id: data.category_id }));
        const catName = categories.find((c) => c.id === data.category_id)?.name;
        toast.success(`Classificado: ${catName || "Categoria encontrada"}`);
      } else {
        toast.info("Não foi possível classificar automaticamente");
      }
    } catch {
      toast.error("Erro na classificação IA");
    } finally {
      setClassifying(false);
    }
  };

  const handleSubmit = () => {
    if (!form.title || !form.amount) return;
    createTransaction(form, {
      onSuccess: () => {
        setFormOpen(false);
        setForm({ title: "", amount: 0, type: "despesa", date: new Date().toISOString().split("T")[0] });
      },
    });
  };

  // Group transactions by date
  const grouped = useMemo(() => {
    const groups: Record<string, typeof transactions> = {};
    for (const t of transactions) {
      const key = t.date || "sem-data";
      if (!groups[key]) groups[key] = [];
      groups[key].push(t);
    }
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [transactions]);

  const receitaCount = transactions.filter((t) => t.type === "receita").length;
  const despesaCount = transactions.filter((t) => t.type === "despesa").length;

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-[-0.02em]">Transações Pessoais</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {summary.count} transações no período
            </p>
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
              <p className="text-[10px] text-muted-foreground">{receitaCount} transações</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Despesas</p>
              <p className="text-xl font-bold font-mono text-destructive">{fmt(summary.despesas)}</p>
              <p className="text-[10px] text-muted-foreground">{despesaCount} transações</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Saldo</p>
              <p className={`text-xl font-bold font-mono ${summary.saldo >= 0 ? "text-revenue" : "text-destructive"}`}>{fmt(summary.saldo)}</p>
              <p className="text-[10px] text-muted-foreground">{summary.count} total</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
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
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="this_month">Este mês</SelectItem>
              <SelectItem value="last_month">Mês passado</SelectItem>
              <SelectItem value="last_3_months">Últimos 3 meses</SelectItem>
              <SelectItem value="all">Tudo</SelectItem>
            </SelectContent>
          </Select>

          {/* Type toggle */}
          <ToggleGroup
            type="single"
            value={filters.types.length === 1 ? filters.types[0] : "all"}
            onValueChange={(v) => setFilters((f) => ({ ...f, types: v && v !== "all" ? [v] : [] }))}
            size="sm"
            variant="outline"
          >
            <ToggleGroupItem value="all" className="text-xs px-2.5">Todos</ToggleGroupItem>
            <ToggleGroupItem value="receita" className="text-xs px-2.5">Receitas</ToggleGroupItem>
            <ToggleGroupItem value="despesa" className="text-xs px-2.5">Despesas</ToggleGroupItem>
          </ToggleGroup>
        </div>

        {/* Source filter badges */}
        <div className="flex gap-2 flex-wrap">
          {[
            { key: "manual", icon: Pencil, label: "Manual" },
            { key: "imported", icon: Upload, label: "Importado" },
            { key: "asaas", icon: Zap, label: "Asaas" },
            { key: "whatsapp", icon: Zap, label: "WhatsApp" },
            { key: "reconciled", icon: Sparkles, label: "Conciliado" },
          ].map(({ key, icon: Icon, label }) => {
            const active = filters.sources.includes(key);
            return (
              <Badge
                key={key}
                variant={active ? "default" : "outline"}
                className="cursor-pointer gap-1 select-none"
                onClick={() =>
                  setFilters((f) => ({
                    ...f,
                    sources: active ? f.sources.filter((s) => s !== key) : [...f.sources, key],
                  }))
                }
              >
                <Icon className="h-3 w-3" /> {label}
              </Badge>
            );
          })}
        </div>

        {/* Transaction list grouped by date */}
        <div className="space-y-2">
          {isLoading ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">Carregando...</CardContent></Card>
          ) : grouped.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <p className="text-muted-foreground text-sm">Nenhuma transação encontrada.</p>
                <Button variant="outline" className="mt-4 gap-2" onClick={() => setFormOpen(true)}>
                  <Plus className="h-4 w-4" /> Criar primeira transação
                </Button>
              </CardContent>
            </Card>
          ) : (
            grouped.map(([dateKey, items]) => {
              const dayTotal = items.reduce((s, t) => s + (t.type === "receita" ? Number(t.amount) : -Number(t.amount)), 0);
              return (
                <div key={dateKey}>
                  <div className="flex items-center justify-between px-2 py-1.5">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {dateKey === "sem-data" ? "Sem data" : formatGroupDate(dateKey)}
                    </span>
                    <span className={`text-xs font-mono font-medium ${dayTotal >= 0 ? "text-revenue" : "text-destructive"}`}>
                      {fmt(dayTotal)}
                    </span>
                  </div>
                  <div className="bg-card border border-border rounded-lg divide-y divide-border">
                    {items.map((t) => (
                      <TransactionItem key={t.id} transaction={t} onDelete={(id) => setDeleteId(id)} />
                    ))}
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
              <div className="flex items-center justify-between">
                <Label>Categoria</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="gap-1 text-xs h-6"
                  disabled={classifying || !form.title}
                  onClick={handleAiClassify}
                >
                  <Sparkles className="h-3 w-3" />
                  {classifying ? "Classificando..." : "IA"}
                </Button>
              </div>
              <Select value={form.category_id || ""} onValueChange={(v) => setForm((f) => ({ ...f, category_id: v || null }))}>
                <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                <SelectContent>
                  {categories
                    .filter((c) => form.type === "receita" ? (c.type === "income" || c.type === "receita") : (c.type === "expense" || c.type === "despesa"))
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.icon || "•"} {c.name}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
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
