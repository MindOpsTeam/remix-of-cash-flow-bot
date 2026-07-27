import { AppLayout } from "@/components/AppLayout";
import { ArrowLeft, Plus, Pencil, Trash2, Landmark } from "lucide-react";
import { OpenFinanceConnect } from "@/components/openfinance/OpenFinanceConnect";
import { Link } from "react-router-dom";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "@/hooks/useCompany";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface BankAccount {
  id: string;
  name: string;
  bank_name: string | null;
  created_at: string;
}

interface FormState {
  name: string;
  bank_name: string;
}

const emptyForm: FormState = { name: "", bank_name: "" };

export default function BankAccounts() {
  const { company } = useCompany();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ["bank_accounts", company?.id],
    enabled: !!company,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_accounts")
        .select("id, name, bank_name, created_at")
        .eq("company_id", company!.id)
        .order("created_at");
      if (error) throw error;
      return data as BankAccount[];
    },
  });

  const openCreate = () => {
    setEditId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (acc: BankAccount) => {
    setEditId(acc.id);
    setForm({ name: acc.name, bank_name: acc.bank_name ?? "" });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!company || !form.name.trim()) {
      toast({ title: "Nome obrigatório", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      bank_name: form.bank_name.trim() || null,
    };
    let error;
    if (editId) {
      ({ error } = await supabase.from("bank_accounts").update(payload).eq("id", editId));
    } else {
      ({ error } = await supabase.from("bank_accounts").insert({ ...payload, company_id: company.id }));
    }
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: editId ? "Conta atualizada" : "Conta criada" });
      qc.invalidateQueries({ queryKey: ["bank_accounts", company.id] });
      setDialogOpen(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId || !company) return;
    const { error } = await supabase.from("bank_accounts").delete().eq("id", deleteId);
    setDeleteId(null);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Conta excluída" });
      qc.invalidateQueries({ queryKey: ["bank_accounts", company.id] });
    }
  };

  return (
    <AppLayout>
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/settings" className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-[-0.02em]">Contas Bancárias</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Bancos e carteiras da empresa</p>
          </div>
        </div>
        <Button size="sm" onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Nova conta
        </Button>
      </div>

      <div className="mb-6 space-y-2">
        <OpenFinanceConnect />
        <p className="text-xs text-muted-foreground">
          Credenciais da Pluggy, ambiente e bancos já conectados ficam em{" "}
          <Link to="/settings/integrations/openfinance" className="underline hover:text-foreground">
            Integrações &gt; Open Finance
          </Link>
          .
        </p>
      </div>

      <div className="max-w-lg">
        {isLoading && (
          <div className="text-sm text-muted-foreground py-4">Carregando...</div>
        )}

        {!isLoading && accounts.length === 0 && (
          <div className="bg-card border border-border rounded-lg p-8 text-center">
            <Landmark className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-medium text-foreground">Nenhuma conta cadastrada</p>
            <p className="text-xs text-muted-foreground mt-1">Crie a primeira conta bancária da empresa.</p>
          </div>
        )}

        {accounts.length > 0 && (
          <div className="bg-card border border-border rounded-lg divide-y divide-border">
            {accounts.map((acc) => (
              <div key={acc.id} className="flex items-center gap-3 p-4">
                <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Landmark className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{acc.name}</p>
                  {acc.bank_name && (
                    <p className="text-xs text-muted-foreground">{acc.bank_name}</p>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    onClick={() => openEdit(acc)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => setDeleteId(acc.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editId ? "Editar conta" : "Nova conta bancária"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nome da conta *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ex: Conta Principal, Carteira Física"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Banco</Label>
              <Input
                value={form.bank_name}
                onChange={(e) => setForm((f) => ({ ...f, bank_name: e.target.value }))}
                placeholder="Ex: Itaú, Bradesco, Inter, Nubank"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir conta?</AlertDialogTitle>
            <AlertDialogDescription>
              Lançamentos existentes não serão afetados, mas a conta deixará de estar disponível para novos registros.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
