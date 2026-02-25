import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Wallet, Pencil, Trash2, Landmark } from "lucide-react";
import { usePersonalAccounts, PersonalAccount, PersonalAccountFormData } from "@/hooks/usePersonalAccounts";

function fmt(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

const accountTypes = [
  { value: "checking", label: "Conta Corrente" },
  { value: "savings", label: "Poupança" },
  { value: "investment", label: "Investimento" },
  { value: "wallet", label: "Carteira" },
];

export default function PersonalAccounts() {
  const { accounts, isLoading, summary, createAccount, updateAccount, deleteAccount, isCreating, isUpdating, isDeleting } =
    usePersonalAccounts();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PersonalAccount | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PersonalAccount | null>(null);
  const [form, setForm] = useState<PersonalAccountFormData>({
    name: "", type: "checking", initial_balance: 0, current_balance: 0,
  });

  const openNew = () => {
    setEditing(null);
    setForm({ name: "", type: "checking", initial_balance: 0, current_balance: 0 });
    setFormOpen(true);
  };

  const openEdit = (a: PersonalAccount) => {
    setEditing(a);
    setForm({ name: a.name, type: a.type, bank_name: a.bank_name, initial_balance: a.initial_balance, current_balance: a.current_balance, color: a.color, icon: a.icon, owner: a.owner });
    setFormOpen(true);
  };

  const handleSubmit = () => {
    if (!form.name) return;
    if (editing) {
      updateAccount({ id: editing.id, data: form }, { onSuccess: () => setFormOpen(false) });
    } else {
      createAccount(form, { onSuccess: () => setFormOpen(false) });
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-[-0.02em]">Contas</h1>
            <p className="text-sm text-muted-foreground mt-1">Gerencie suas contas e carteiras</p>
          </div>
          <Button onClick={openNew} className="gap-2"><Plus className="h-4 w-4" /> Nova Conta</Button>
        </div>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-32" />)}</div>
        ) : accounts.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center py-12 text-center">
                <div className="rounded-full bg-muted p-4 mb-4"><Wallet className="h-8 w-8 text-muted-foreground" /></div>
                <h3 className="text-lg font-semibold mb-2">Nenhuma conta cadastrada</h3>
                <p className="text-sm text-muted-foreground max-w-sm mb-4">Adicione suas contas para começar a controlar seu dinheiro.</p>
                <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" /> Adicionar conta</Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Summary */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card><CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Saldo Total</p>
                <p className="text-xl font-bold">{fmt(summary.totalBalance)}</p>
              </CardContent></Card>
              <Card><CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Contas Ativas</p>
                <p className="text-xl font-bold">{summary.accountCount}</p>
              </CardContent></Card>
              <Card><CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Maior Saldo</p>
                <p className="text-xl font-bold">{fmt(summary.highestBalance)}</p>
              </CardContent></Card>
            </div>

            {/* Account Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {accounts.map((a) => (
                <Card key={a.id}>
                  <CardContent className="pt-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="rounded-full bg-primary/10 p-2"><Landmark className="h-4 w-4 text-primary" /></div>
                        <div>
                          <p className="text-sm font-semibold">{a.name}</p>
                          {a.bank_name && <p className="text-xs text-muted-foreground">{a.bank_name}</p>}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(a)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDeleteTarget(a)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </div>
                    <p className={`text-lg font-bold font-mono ${Number(a.current_balance) >= 0 ? "text-revenue" : "text-destructive"}`}>{fmt(Number(a.current_balance))}</p>
                    <p className="text-xs text-muted-foreground mt-1">{accountTypes.find((t) => t.value === a.type)?.label || a.type}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Form */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar Conta" : "Nova Conta"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nome</Label><Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Tipo</Label>
                <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{accountTypes.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Banco</Label><Input value={form.bank_name || ""} onChange={(e) => setForm((f) => ({ ...f, bank_name: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Saldo Inicial</Label><Input type="number" step="0.01" value={form.initial_balance || ""} onChange={(e) => setForm((f) => ({ ...f, initial_balance: parseFloat(e.target.value) || 0 }))} /></div>
              <div><Label>Saldo Atual</Label><Input type="number" step="0.01" value={form.current_balance || ""} onChange={(e) => setForm((f) => ({ ...f, current_balance: parseFloat(e.target.value) || 0 }))} /></div>
            </div>
            <Button onClick={handleSubmit} disabled={isCreating || isUpdating} className="w-full">
              {isCreating || isUpdating ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir conta?</AlertDialogTitle>
            <AlertDialogDescription>A conta "{deleteTarget?.name}" será desativada.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deleteTarget) { deleteAccount(deleteTarget.id); setDeleteTarget(null); } }} disabled={isDeleting} className="bg-destructive text-destructive-foreground">
              {isDeleting ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
