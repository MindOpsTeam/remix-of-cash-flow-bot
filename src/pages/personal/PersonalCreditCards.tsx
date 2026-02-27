import { useState, useMemo } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, CreditCard, Trash2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { startOfMonth, endOfMonth, format } from "date-fns";

function fmt(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

interface CreditCardData {
  id: string;
  name: string;
  brand: string | null;
  credit_limit: number;
  closing_day: number;
  due_day: number;
  is_active: boolean;
  color: string | null;
  icon: string | null;
  owner: string | null;
}

const emptyForm = {
  name: "",
  brand: "",
  credit_limit: 0,
  closing_day: 25,
  due_day: 5,
};

export default function PersonalCreditCards() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });

  const { data: cards = [], isLoading } = useQuery({
    queryKey: ["personal_credit_cards", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("personal_credit_cards")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as CreditCardData[];
    },
    enabled: !!user,
  });

  // Fetch spending per card this month
  const { data: spending = {} } = useQuery({
    queryKey: ["credit_card_spending", user?.id],
    queryFn: async () => {
      if (!user) return {};
      const now = new Date();
      const start = format(startOfMonth(now), "yyyy-MM-dd");
      const end = format(endOfMonth(now), "yyyy-MM-dd");
      const { data, error } = await supabase
        .from("personal_transactions")
        .select("credit_card_id, amount")
        .eq("user_id", user.id)
        .eq("type", "despesa")
        .not("credit_card_id", "is", null)
        .gte("date", start)
        .lte("date", end);
      if (error) throw error;
      const map: Record<string, number> = {};
      (data || []).forEach((t: any) => {
        if (t.credit_card_id) {
          map[t.credit_card_id] = (map[t.credit_card_id] || 0) + Number(t.amount);
        }
      });
      return map;
    },
    enabled: !!user,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof emptyForm) => {
      if (!user) throw new Error("Não autenticado");
      const { error } = await supabase.from("personal_credit_cards").insert({
        user_id: user.id,
        name: data.name.trim(),
        brand: data.brand || null,
        credit_limit: data.credit_limit,
        closing_day: data.closing_day,
        due_day: data.due_day,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personal_credit_cards"] });
      toast.success("Cartão cadastrado!");
      setFormOpen(false);
      setForm({ ...emptyForm });
    },
    onError: () => toast.error("Erro ao cadastrar cartão"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("personal_credit_cards").update({ is_active: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personal_credit_cards"] });
      toast.success("Cartão removido!");
    },
    onError: () => toast.error("Erro ao remover cartão"),
  });

  const totalLimit = cards.reduce((s, c) => s + Number(c.credit_limit), 0);
  const totalUsed = cards.reduce((s, c) => s + (spending[c.id] || 0), 0);

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-[-0.02em]">Cartões de Crédito</h1>
            <p className="text-sm text-muted-foreground mt-1">Gerencie seus cartões e acompanhe os gastos</p>
          </div>
          <Button className="gap-2" variant="accent" onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" /> Novo Cartão
          </Button>
        </div>

        {/* Summary */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Limite Total</p>
              <p className="text-xl font-bold font-mono">{fmt(totalLimit)}</p>
              <p className="text-[10px] text-muted-foreground">{cards.length} cartão(ões)</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Usado (mês)</p>
              <p className="text-xl font-bold font-mono text-destructive">{fmt(totalUsed)}</p>
              <p className="text-[10px] text-muted-foreground">{totalLimit > 0 ? `${((totalUsed / totalLimit) * 100).toFixed(0)}% do limite` : "—"}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Disponível</p>
              <p className="text-xl font-bold font-mono text-revenue">{fmt(totalLimit - totalUsed)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Cards */}
        {isLoading ? (
          <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">Carregando...</CardContent></Card>
        ) : cards.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <CreditCard className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground text-sm">Nenhum cartão cadastrado.</p>
              <p className="text-xs text-muted-foreground mt-1">Cadastre seus cartões para acompanhar gastos e faturas.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {cards.map((card) => {
              const used = spending[card.id] || 0;
              const pct = card.credit_limit > 0 ? (used / card.credit_limit) * 100 : 0;
              return (
                <div key={card.id} className="bg-card border border-border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-5 w-5 text-primary" />
                      <div>
                        <p className="text-sm font-medium">{card.name}</p>
                        {card.brand && <p className="text-xs text-muted-foreground">{card.brand}</p>}
                      </div>
                    </div>
                    <button onClick={() => setDeleteId(card.id)} className="text-muted-foreground hover:text-destructive transition-colors p-1">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                    <span>{fmt(used)} gasto</span>
                    <span>Limite: {fmt(card.credit_limit)}</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${pct >= 90 ? "bg-destructive" : pct >= 70 ? "bg-yellow-500" : "bg-primary"}`}
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                  <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                    <span>Fecha: dia {card.closing_day}</span>
                    <span>Vence: dia {card.due_day}</span>
                    {card.owner && <span>• {card.owner}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Form */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Cartão de Crédito</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome do Cartão</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ex: Nubank, Itaú Platinum..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Bandeira</Label>
                <Input value={form.brand} onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))} placeholder="Visa, Mastercard..." />
              </div>
              <div>
                <Label>Limite (R$)</Label>
                <Input type="number" step="0.01" value={form.credit_limit || ""} onChange={(e) => setForm((f) => ({ ...f, credit_limit: parseFloat(e.target.value) || 0 }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Dia do Fechamento</Label>
                <Input type="number" min="1" max="31" value={form.closing_day} onChange={(e) => setForm((f) => ({ ...f, closing_day: parseInt(e.target.value) || 25 }))} />
              </div>
              <div>
                <Label>Dia do Vencimento</Label>
                <Input type="number" min="1" max="31" value={form.due_day} onChange={(e) => setForm((f) => ({ ...f, due_day: parseInt(e.target.value) || 5 }))} />
              </div>
            </div>
            <Button onClick={() => createMutation.mutate(form)} disabled={createMutation.isPending || !form.name} className="w-full">
              {createMutation.isPending ? "Cadastrando..." : "Cadastrar Cartão"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover cartão?</AlertDialogTitle>
            <AlertDialogDescription>O cartão será desativado. Transações vinculadas não serão afetadas.</AlertDialogDescription>
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
