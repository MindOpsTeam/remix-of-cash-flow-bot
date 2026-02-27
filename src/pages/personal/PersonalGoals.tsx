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
import { Plus, Target, Trash2, TrendingUp } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { format, parseISO, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";

function fmt(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

interface Goal {
  id: string;
  name: string;
  description: string | null;
  target_amount: number;
  current_amount: number;
  deadline: string;
  priority: string;
  is_emergency_fund: boolean;
  color: string | null;
  icon: string | null;
  is_active: boolean;
}

const priorityLabels: Record<string, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
};

const priorityColors: Record<string, string> = {
  low: "text-muted-foreground",
  medium: "text-yellow-600",
  high: "text-destructive",
};

const defaultEmoji = ["🎯", "🏠", "🚗", "✈️", "📚", "💰", "🛡️", "🎁", "💍", "🏥"];

const emptyForm = {
  name: "",
  target_amount: 0,
  current_amount: 0,
  deadline: "",
  priority: "medium",
  description: "",
  icon: "🎯",
  is_emergency_fund: false,
};

export default function PersonalGoals() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [depositGoalId, setDepositGoalId] = useState<string | null>(null);
  const [depositAmount, setDepositAmount] = useState(0);
  const [form, setForm] = useState({ ...emptyForm });

  const { data: goals = [], isLoading } = useQuery({
    queryKey: ["personal_goals", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("personal_goals")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("deadline", { ascending: true });
      if (error) throw error;
      return data as Goal[];
    },
    enabled: !!user,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof emptyForm) => {
      if (!user) throw new Error("Não autenticado");
      const { error } = await supabase.from("personal_goals").insert({
        user_id: user.id,
        name: data.name.trim(),
        target_amount: data.target_amount,
        current_amount: data.current_amount,
        deadline: data.deadline,
        priority: data.priority,
        description: data.description || null,
        icon: data.icon || null,
        is_emergency_fund: data.is_emergency_fund,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personal_goals"] });
      toast.success("Meta criada!");
      setFormOpen(false);
      setForm({ ...emptyForm });
    },
    onError: () => toast.error("Erro ao criar meta"),
  });

  const depositMutation = useMutation({
    mutationFn: async ({ id, amount }: { id: string; amount: number }) => {
      const goal = goals.find((g) => g.id === id);
      if (!goal) throw new Error("Meta não encontrada");
      if (!user) throw new Error("Não autenticado");
      const { error } = await supabase
        .from("personal_goals")
        .update({ current_amount: goal.current_amount + amount })
        .eq("id", id)
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personal_goals"] });
      toast.success("Depósito registrado!");
      setDepositGoalId(null);
      setDepositAmount(0);
    },
    onError: () => toast.error("Erro ao registrar depósito"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error("Não autenticado");
      const { error } = await supabase.from("personal_goals").update({ is_active: false }).eq("id", id).eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personal_goals"] });
      toast.success("Meta removida!");
    },
    onError: () => toast.error("Erro ao remover meta"),
  });

  const totalTarget = goals.reduce((s, g) => s + Number(g.target_amount), 0);
  const totalSaved = goals.reduce((s, g) => s + Number(g.current_amount), 0);
  const completedCount = goals.filter((g) => g.current_amount >= g.target_amount).length;

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-[-0.02em]">Metas Financeiras</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Acompanhe seus objetivos de poupança
            </p>
          </div>
          <Button className="gap-2" variant="accent" onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" /> Nova Meta
          </Button>
        </div>

        {/* Summary */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Total a Alcançar</p>
              <p className="text-xl font-bold font-mono">{fmt(totalTarget)}</p>
              <p className="text-[10px] text-muted-foreground">{goals.length} meta(s) ativa(s)</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Total Poupado</p>
              <p className="text-xl font-bold font-mono text-revenue">{fmt(totalSaved)}</p>
              <p className="text-[10px] text-muted-foreground">{totalTarget > 0 ? `${((totalSaved / totalTarget) * 100).toFixed(0)}% do total` : "—"}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Metas Alcançadas</p>
              <p className="text-xl font-bold font-mono text-revenue">{completedCount}</p>
              <p className="text-[10px] text-muted-foreground">de {goals.length}</p>
            </CardContent>
          </Card>
        </div>

        {/* Goals */}
        {isLoading ? (
          <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">Carregando...</CardContent></Card>
        ) : goals.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <Target className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground text-sm">Nenhuma meta definida.</p>
              <p className="text-xs text-muted-foreground mt-1">Crie metas para acompanhar seus objetivos financeiros.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {goals.map((g) => {
              const pct = g.target_amount > 0 ? (g.current_amount / g.target_amount) * 100 : 0;
              const isComplete = pct >= 100;
              const daysLeft = differenceInDays(parseISO(g.deadline), new Date());
              return (
                <div key={g.id} className="bg-card border border-border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{g.icon || "🎯"}</span>
                      <div>
                        <p className="text-sm font-medium">{g.name}</p>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span className={priorityColors[g.priority]}>{priorityLabels[g.priority]}</span>
                          {g.is_emergency_fund && <span>• Reserva</span>}
                          {g.description && <span>• {g.description}</span>}
                        </div>
                      </div>
                    </div>
                    <button onClick={() => setDeleteId(g.id)} className="text-muted-foreground hover:text-destructive transition-colors p-1">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                    <span>{fmt(g.current_amount)}</span>
                    <span>{fmt(g.target_amount)}</span>
                  </div>
                  <div className="h-3 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${isComplete ? "bg-revenue" : "bg-primary"}`}
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-xs text-muted-foreground">
                      {isComplete ? "Meta alcançada!" : daysLeft > 0 ? `${daysLeft} dias restantes` : "Prazo vencido"}
                      {" • "}
                      {format(parseISO(g.deadline), "dd/MM/yyyy")}
                    </p>
                    {!isComplete && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1 text-xs h-7"
                        onClick={() => { setDepositGoalId(g.id); setDepositAmount(0); }}
                      >
                        <TrendingUp className="h-3 w-3" /> Depositar
                      </Button>
                    )}
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
          <DialogHeader><DialogTitle>Nova Meta</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome da Meta</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ex: Viagem, Casa própria..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Valor Alvo (R$)</Label>
                <Input type="number" step="0.01" value={form.target_amount || ""} onChange={(e) => setForm((f) => ({ ...f, target_amount: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div>
                <Label>Já Poupado (R$)</Label>
                <Input type="number" step="0.01" value={form.current_amount || ""} onChange={(e) => setForm((f) => ({ ...f, current_amount: parseFloat(e.target.value) || 0 }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Prazo</Label>
                <Input type="date" value={form.deadline} onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))} />
              </div>
              <div>
                <Label>Prioridade</Label>
                <Select value={form.priority} onValueChange={(v) => setForm((f) => ({ ...f, priority: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Baixa</SelectItem>
                    <SelectItem value="medium">Média</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Ícone</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {defaultEmoji.map((icon) => (
                  <button
                    key={icon}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, icon }))}
                    className={`h-9 w-9 rounded-md flex items-center justify-center text-lg border transition-colors ${
                      form.icon === icon ? "border-primary bg-primary/10" : "border-border hover:bg-muted"
                    }`}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>Descrição (opcional)</Label>
              <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <Button onClick={() => createMutation.mutate(form)} disabled={createMutation.isPending || !form.name || !form.target_amount || !form.deadline} className="w-full">
              {createMutation.isPending ? "Criando..." : "Criar Meta"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Deposit Dialog */}
      <Dialog open={!!depositGoalId} onOpenChange={() => setDepositGoalId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Registrar Depósito</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Valor do Depósito (R$)</Label>
              <Input type="number" step="0.01" value={depositAmount || ""} onChange={(e) => setDepositAmount(parseFloat(e.target.value) || 0)} autoFocus />
            </div>
            <Button
              onClick={() => { if (depositGoalId && depositAmount > 0) depositMutation.mutate({ id: depositGoalId, amount: depositAmount }); }}
              disabled={depositMutation.isPending || !depositAmount}
              className="w-full"
            >
              {depositMutation.isPending ? "Registrando..." : "Registrar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover meta?</AlertDialogTitle>
            <AlertDialogDescription>A meta será desativada.</AlertDialogDescription>
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
