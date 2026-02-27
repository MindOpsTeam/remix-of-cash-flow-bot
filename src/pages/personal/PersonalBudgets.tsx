import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, PiggyBank, Trash2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { startOfMonth, endOfMonth, format } from "date-fns";

function fmt(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

interface Budget {
  id: string;
  category_id: string;
  monthly_limit: number;
  alert_threshold: number;
  is_active: boolean;
  personal_categories?: { name: string; icon: string | null; color: string | null } | null;
}

export default function PersonalBudgets() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ category_id: "", monthly_limit: 0, alert_threshold: 80 });

  const { data: budgets = [], isLoading } = useQuery({
    queryKey: ["personal_budgets", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("personal_budgets")
        .select("*, personal_categories(name, icon, color)")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("monthly_limit", { ascending: false });
      if (error) throw error;
      return data as Budget[];
    },
    enabled: !!user,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["personal_categories_for_budget", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("personal_categories")
        .select("id, name, icon, type")
        .or(`user_id.eq.${user.id},user_id.is.null`)
        .in("type", ["expense", "despesa"])
        .order("name");
      if (error) throw error;
      return data as { id: string; name: string; icon: string | null; type: string }[];
    },
    enabled: !!user,
  });

  // Fetch current month spending per category
  const { data: spending = {} } = useQuery({
    queryKey: ["personal_spending_month", user?.id],
    queryFn: async () => {
      if (!user) return {};
      const now = new Date();
      const start = format(startOfMonth(now), "yyyy-MM-dd");
      const end = format(endOfMonth(now), "yyyy-MM-dd");
      const { data, error } = await supabase
        .from("personal_transactions")
        .select("category_id, amount")
        .eq("user_id", user.id)
        .eq("type", "despesa")
        .gte("date", start)
        .lte("date", end);
      if (error) throw error;
      const map: Record<string, number> = {};
      (data || []).forEach((t: any) => {
        if (t.category_id) {
          map[t.category_id] = (map[t.category_id] || 0) + Number(t.amount);
        }
      });
      return map;
    },
    enabled: !!user,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      if (!user) throw new Error("Não autenticado");
      const { error } = await supabase.from("personal_budgets").insert({
        user_id: user.id,
        category_id: data.category_id,
        monthly_limit: data.monthly_limit,
        alert_threshold: data.alert_threshold,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personal_budgets"] });
      toast.success("Orçamento criado!");
      setFormOpen(false);
      setForm({ category_id: "", monthly_limit: 0, alert_threshold: 80 });
    },
    onError: () => toast.error("Erro ao criar orçamento"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error("Não autenticado");
      const { error } = await supabase.from("personal_budgets").update({ is_active: false }).eq("id", id).eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personal_budgets"] });
      toast.success("Orçamento removido!");
    },
    onError: () => toast.error("Erro ao remover orçamento"),
  });

  const usedCategoryIds = budgets.map((b) => b.category_id);
  const availableCategories = categories.filter((c) => !usedCategoryIds.includes(c.id));

  const totalBudget = budgets.reduce((s, b) => s + Number(b.monthly_limit), 0);
  const totalSpent = budgets.reduce((s, b) => s + (spending[b.category_id] || 0), 0);

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-[-0.02em]">Orçamentos</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Defina limites de gastos por categoria
            </p>
          </div>
          <Button className="gap-2" variant="accent" onClick={() => setFormOpen(true)} disabled={availableCategories.length === 0}>
            <Plus className="h-4 w-4" /> Novo Orçamento
          </Button>
        </div>

        {/* Summary */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Orçamento Total</p>
              <p className="text-xl font-bold font-mono">{fmt(totalBudget)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Gasto no Mês</p>
              <p className="text-xl font-bold font-mono text-destructive">{fmt(totalSpent)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Disponível</p>
              <p className={`text-xl font-bold font-mono ${totalBudget - totalSpent >= 0 ? "text-revenue" : "text-destructive"}`}>
                {fmt(totalBudget - totalSpent)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Budget cards */}
        {isLoading ? (
          <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">Carregando...</CardContent></Card>
        ) : budgets.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <PiggyBank className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground text-sm">Nenhum orçamento definido.</p>
              <p className="text-xs text-muted-foreground mt-1">Crie orçamentos para controlar seus gastos por categoria.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {budgets.map((b) => {
              const spent = spending[b.category_id] || 0;
              const pct = b.monthly_limit > 0 ? (spent / b.monthly_limit) * 100 : 0;
              const isOver = pct >= 100;
              const isWarning = pct >= b.alert_threshold && !isOver;
              return (
                <div key={b.id} className="bg-card border border-border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{b.personal_categories?.icon || "•"}</span>
                      <span className="text-sm font-medium">{b.personal_categories?.name || "Categoria"}</span>
                    </div>
                    <button onClick={() => setDeleteId(b.id)} className="text-muted-foreground hover:text-destructive transition-colors p-1">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                    <span>{fmt(spent)} gasto</span>
                    <span>Limite: {fmt(b.monthly_limit)}</span>
                  </div>
                  <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${isOver ? "bg-destructive" : isWarning ? "bg-yellow-500" : "bg-revenue"}`}
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                  <p className={`text-xs mt-1.5 font-medium ${isOver ? "text-destructive" : isWarning ? "text-yellow-600" : "text-muted-foreground"}`}>
                    {isOver ? `Estourou! ${fmt(spent - b.monthly_limit)} acima` : `${pct.toFixed(0)}% usado • ${fmt(b.monthly_limit - spent)} disponível`}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Form */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Orçamento</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Categoria</Label>
              <Select value={form.category_id} onValueChange={(v) => setForm((f) => ({ ...f, category_id: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {availableCategories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.icon || "•"} {c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Limite Mensal (R$)</Label>
                <Input type="number" step="0.01" value={form.monthly_limit || ""} onChange={(e) => setForm((f) => ({ ...f, monthly_limit: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div>
                <Label>Alerta em (%)</Label>
                <Input type="number" min="50" max="100" value={form.alert_threshold} onChange={(e) => setForm((f) => ({ ...f, alert_threshold: parseInt(e.target.value) || 80 }))} />
              </div>
            </div>
            <Button onClick={() => createMutation.mutate(form)} disabled={createMutation.isPending || !form.category_id || !form.monthly_limit} className="w-full">
              {createMutation.isPending ? "Criando..." : "Criar Orçamento"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover orçamento?</AlertDialogTitle>
            <AlertDialogDescription>O orçamento será desativado. Suas transações não serão afetadas.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deleteId) { deleteMutation.mutate(deleteId); setDeleteId(null); } }} className="bg-destructive text-destructive-foreground">Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
