import { mensagemDeErro } from "@/lib/erros";
import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

interface Account {
  id: string;
  name: string;
  code: string | null;
  type: string;
  deducao?: boolean;
  editable: boolean;
}

export default function ChartOfAccountsPage() {
  const { company } = useCompany();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [form, setForm] = useState({ name: "", code: "", type: "expense", deducao: false });

  const fetch = useCallback(async () => {
    if (!company) return;
    const { data } = await supabase
      .from("chart_of_accounts")
      .select("id, name, code, type, editable, deducao")
      .eq("company_id", company.id)
      .order("code");
    // Cast enquanto os tipos gerados (regerados pelo Lovable) não conhecem a
    // coluna `deducao`. O formato está fixado em Account.
    if (data) setAccounts(data as unknown as Account[]);
  }, [company]);

  useEffect(() => { fetch(); }, [fetch]);

  const openNew = () => {
    setEditing(null);
    setForm({ name: "", code: "", type: "expense", deducao: false });
    setDialogOpen(true);
  };

  const openEdit = (a: Account) => {
    setEditing(a);
    setForm({ name: a.name, code: a.code || "", type: a.type, deducao: a.deducao ?? false });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!company || !form.name.trim()) return;
    if (editing) {
      const { error } = await supabase.from("chart_of_accounts").update({ name: form.name.trim(), code: form.code.trim() || null, type: form.type, deducao: form.deducao }).eq("id", editing.id);
      if (error) { toast.error(mensagemDeErro(error)); return; }
      toast.success("Conta atualizada!");
    } else {
      const { error } = await supabase.from("chart_of_accounts").insert({ company_id: company.id, name: form.name.trim(), code: form.code.trim() || null, type: form.type, deducao: form.deducao });
      if (error) { toast.error(mensagemDeErro(error)); return; }
      toast.success("Conta criada!");
    }
    setDialogOpen(false);
    fetch();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir esta conta contábil?")) return;
    const { error } = await supabase.from("chart_of_accounts").delete().eq("id", id);
    if (error) { toast.error(mensagemDeErro(error)); return; }
    toast.success("Conta excluída!");
    fetch();
  };

  const revenueAccounts = accounts.filter((a) => a.type === "revenue");
  const expenseAccounts = accounts.filter((a) => a.type === "expense");

  const renderGroup = (title: string, items: Account[]) => (
    <div className="mb-6">
      <h3 className="text-sm font-semibold text-primary mb-3">{title}</h3>
      <div className="space-y-1">
        {items.map((a) => (
          <div key={a.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-accent/30 transition-colors group">
            <span className="text-sm text-foreground">
              {a.code && <span className="text-muted-foreground mr-2">{a.code}</span>}
              {a.name}
            </span>
            {a.editable !== false && (
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(a)} aria-label="Editar conta"><Pencil className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(a.id)} aria-label="Excluir conta"><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            )}
          </div>
        ))}
        {items.length === 0 && <p className="text-xs text-muted-foreground px-3">Nenhuma conta nesta categoria.</p>}
      </div>
    </div>
  );

  return (
    <AppLayout>
      <div className="flex items-center gap-3 mb-8">
        <Link to="/settings">
          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Voltar"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground tracking-[-0.02em]">Plano de Contas</h1>
          <p className="text-sm text-muted-foreground mt-1">Gerencie suas contas contábeis</p>
        </div>
        <Button className="gap-2" onClick={openNew}><Plus className="h-4 w-4" />Nova Conta</Button>
      </div>

      <div className="bg-card border border-border rounded-lg p-5 max-w-2xl">
        {renderGroup("RECEITAS", revenueAccounts)}
        {renderGroup("CUSTOS E DESPESAS", expenseAccounts)}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader><DialogTitle>{editing ? "Editar Conta" : "Nova Conta"}</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>Nome *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 bg-background/50" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Código</Label>
                <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="Ex: 5.1.1" className="mt-1 bg-background/50" />
              </div>
              <div>
                <Label>Tipo</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger className="mt-1 bg-background/50"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="revenue">Receita</SelectItem>
                    <SelectItem value="expense">Despesa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-medium">Conta redutora de receita</p>
                <p className="text-xs text-muted-foreground">
                  Imposto sobre venda, devolução ou desconto incondicional. Entra entre a Receita Bruta e a
                  Receita Líquida do DRE, em vez de virar despesa.
                </p>
              </div>
              <Switch
                checked={form.deducao}
                onCheckedChange={(v) => setForm({ ...form, deducao: v })}
                aria-label="Conta redutora de receita"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button className="flex-1" onClick={handleSave}>{editing ? "Salvar" : "Criar"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
