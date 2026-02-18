import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { X } from "lucide-react";

interface TransactionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function TransactionForm({ open, onOpenChange, onSuccess }: TransactionFormProps) {
  const { company } = useCompany();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<{ id: string; name: string; type: string }[]>([]);
  const [costCenters, setCostCenters] = useState<{ id: string; name: string }[]>([]);
  const [bankAccounts, setBankAccounts] = useState<{ id: string; name: string }[]>([]);

  const [form, setForm] = useState({
    date: new Date().toISOString().split("T")[0],
    description: "",
    amount: "",
    type: "expense" as "revenue" | "expense",
    account_id: "",
    cost_center_id: "",
    bank_account_id: "",
  });

  useEffect(() => {
    if (!company) return;

    const fetchOptions = async () => {
      const [accts, ccs, banks] = await Promise.all([
        supabase.from("chart_of_accounts").select("id, name, type").eq("company_id", company.id),
        supabase.from("cost_centers").select("id, name").eq("company_id", company.id),
        supabase.from("bank_accounts").select("id, name").eq("company_id", company.id),
      ]);

      if (accts.data) setAccounts(accts.data);
      if (ccs.data) setCostCenters(ccs.data);
      if (banks.data) setBankAccounts(banks.data);
    };

    fetchOptions();
  }, [company]);

  const filteredAccounts = accounts.filter((a) => a.type === form.type);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company || !user) return;

    const amount = parseFloat(form.amount.replace(",", "."));
    if (isNaN(amount) || amount <= 0) {
      toast.error("Informe um valor válido.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.from("transactions").insert({
      company_id: company.id,
      user_id: user.id,
      date: form.date,
      description: form.description.trim(),
      amount,
      type: form.type,
      account_id: form.account_id || null,
      cost_center_id: form.cost_center_id || null,
      bank_account_id: form.bank_account_id || null,
      status: "confirmed",
      source: "manual",
    });

    if (error) {
      toast.error("Erro ao salvar: " + error.message);
    } else {
      toast.success("Lançamento criado com sucesso!");
      setForm({
        date: new Date().toISOString().split("T")[0],
        description: "",
        amount: "",
        type: "expense",
        account_id: "",
        cost_center_id: "",
        bank_account_id: "",
      });
      onSuccess();
      onOpenChange(false);
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">Novo Lançamento</DialogTitle>
          <DialogDescription>Registre uma receita ou despesa</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Tipo</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as any, account_id: "" })}>
                <SelectTrigger className="mt-1 bg-background/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="revenue">Receita</SelectItem>
                  <SelectItem value="expense">Despesa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data</Label>
              <Input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                required
                className="mt-1 bg-background/50"
              />
            </div>
          </div>

          <div>
            <Label>Descrição</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Descreva o lançamento..."
              required
              className="mt-1 bg-background/50 min-h-[60px]"
            />
          </div>

          <div>
            <Label>Valor (R$)</Label>
            <Input
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              placeholder="0,00"
              required
              className="mt-1 bg-background/50"
            />
          </div>

          <div>
            <Label>Conta Contábil</Label>
            <Select value={form.account_id} onValueChange={(v) => setForm({ ...form, account_id: v })}>
              <SelectTrigger className="mt-1 bg-background/50">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {filteredAccounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Centro de Custo</Label>
              <Select value={form.cost_center_id} onValueChange={(v) => setForm({ ...form, cost_center_id: v })}>
                <SelectTrigger className="mt-1 bg-background/50">
                  <SelectValue placeholder="Opcional" />
                </SelectTrigger>
                <SelectContent>
                  {costCenters.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Conta Bancária</Label>
              <Select value={form.bank_account_id} onValueChange={(v) => setForm({ ...form, bank_account_id: v })}>
                <SelectTrigger className="mt-1 bg-background/50">
                  <SelectValue placeholder="Opcional" />
                </SelectTrigger>
                <SelectContent>
                  {bankAccounts.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
