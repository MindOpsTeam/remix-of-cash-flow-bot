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
import { Plus, Tag, Trash2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface PersonalCategory {
  id: string;
  name: string;
  type: string;
  icon: string | null;
  color: string | null;
  default_kakeibo_group: string | null;
  user_id: string | null;
}

const typeLabels: Record<string, string> = {
  expense: "Despesa",
  income: "Receita",
  transfer: "Transferência",
};

const kakeeboLabels: Record<string, string> = {
  necessidade: "Necessidade",
  desejo: "Desejo",
  cultura: "Cultura",
  extra: "Extra",
  investimento: "Investimento",
};

const defaultIcons = ["🏠", "🍔", "🚗", "💊", "📚", "🎬", "👕", "💰", "💼", "🎁", "📱", "✈️"];

const emptyForm = {
  name: "",
  type: "expense",
  icon: "",
  color: "#6366f1",
  default_kakeibo_group: "",
};

export default function PersonalCategories() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["personal_categories", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("personal_categories")
        .select("*")
        .or(`user_id.eq.${user.id},user_id.is.null`)
        .order("name");
      if (error) throw error;
      return data as PersonalCategory[];
    },
    enabled: !!user,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof emptyForm) => {
      if (!user) throw new Error("Não autenticado");
      const { error } = await supabase.from("personal_categories").insert({
        user_id: user.id,
        name: data.name.trim(),
        type: data.type,
        icon: data.icon || null,
        color: data.color || null,
        default_kakeibo_group: data.default_kakeibo_group || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personal_categories"] });
      toast.success("Categoria criada!");
      setFormOpen(false);
      setForm({ ...emptyForm });
    },
    onError: () => toast.error("Erro ao criar categoria"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("personal_categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personal_categories"] });
      toast.success("Categoria excluída!");
    },
    onError: () => toast.error("Erro ao excluir categoria. Pode estar em uso."),
  });

  const handleSubmit = () => {
    if (!form.name.trim()) return;
    createMutation.mutate(form);
  };

  const userCategories = categories.filter((c) => c.user_id !== null);
  const systemCategories = categories.filter((c) => c.user_id === null);

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-[-0.02em]">Categorias</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Organize suas transações com categorias personalizadas
            </p>
          </div>
          <Button className="gap-2" variant="accent" onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" /> Nova Categoria
          </Button>
        </div>

        {isLoading ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground text-sm">
              Carregando...
            </CardContent>
          </Card>
        ) : categories.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <Tag className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground text-sm">Nenhuma categoria encontrada.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* User categories */}
            {userCategories.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-muted-foreground mb-2">
                  Suas Categorias ({userCategories.length})
                </h2>
                <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                  {userCategories.map((cat) => (
                    <div
                      key={cat.id}
                      className="flex items-center gap-3 bg-card border border-border rounded-lg px-4 py-3 hover:bg-muted/30 transition-colors"
                    >
                      <div
                        className="h-9 w-9 rounded-full flex items-center justify-center text-lg shrink-0"
                        style={{ backgroundColor: cat.color ? `${cat.color}20` : "hsl(var(--muted))" }}
                      >
                        {cat.icon || "•"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{cat.name}</p>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span>{typeLabels[cat.type] || cat.type}</span>
                          {cat.default_kakeibo_group && (
                            <span>• {kakeeboLabels[cat.default_kakeibo_group] || cat.default_kakeibo_group}</span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => setDeleteId(cat.id)}
                        className="text-muted-foreground hover:text-destructive transition-colors p-1"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* System categories */}
            {systemCategories.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-muted-foreground mb-2">
                  Categorias do Sistema ({systemCategories.length})
                </h2>
                <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                  {systemCategories.map((cat) => (
                    <div
                      key={cat.id}
                      className="flex items-center gap-3 bg-card border border-border rounded-lg px-4 py-3 opacity-75"
                    >
                      <div
                        className="h-9 w-9 rounded-full flex items-center justify-center text-lg shrink-0"
                        style={{ backgroundColor: cat.color ? `${cat.color}20` : "hsl(var(--muted))" }}
                      >
                        {cat.icon || "•"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{cat.name}</p>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span>{typeLabels[cat.type] || cat.type}</span>
                          {cat.default_kakeibo_group && (
                            <span>• {kakeeboLabels[cat.default_kakeibo_group] || cat.default_kakeibo_group}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Create Form Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Categoria</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ex: Alimentação, Transporte..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tipo</Label>
                <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="expense">Despesa</SelectItem>
                    <SelectItem value="income">Receita</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Grupo Kakeibo</Label>
                <Select
                  value={form.default_kakeibo_group}
                  onValueChange={(v) => setForm((f) => ({ ...f, default_kakeibo_group: v }))}
                >
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Opcional" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="necessidade">Necessidade</SelectItem>
                    <SelectItem value="desejo">Desejo</SelectItem>
                    <SelectItem value="cultura">Cultura</SelectItem>
                    <SelectItem value="extra">Extra</SelectItem>
                    <SelectItem value="investimento">Investimento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Ícone</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {defaultIcons.map((icon) => (
                  <button
                    key={icon}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, icon }))}
                    className={`h-9 w-9 rounded-md flex items-center justify-center text-lg border transition-colors ${
                      form.icon === icon
                        ? "border-primary bg-primary/10"
                        : "border-border hover:bg-muted"
                    }`}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || !form.name.trim()} className="w-full">
              {createMutation.isPending ? "Criando..." : "Criar Categoria"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir categoria?</AlertDialogTitle>
            <AlertDialogDescription>
              Transações associadas a esta categoria não serão excluídas, apenas desvinculadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteId) {
                  deleteMutation.mutate(deleteId);
                  setDeleteId(null);
                }
              }}
              className="bg-destructive text-destructive-foreground"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
