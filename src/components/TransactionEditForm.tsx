import { mensagemDeErro } from "@/lib/erros";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import type { TransactionRowData } from "@/components/TransactionRow";

interface TransactionEditFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: TransactionRowData | null;
  onSuccess: () => void;
}

const paymentMethods = [
  { value: "pix", label: "PIX" },
  { value: "boleto", label: "Boleto" },
  { value: "credit_card", label: "Cartão de Crédito" },
  { value: "debit_card", label: "Cartão de Débito" },
  { value: "transfer", label: "Transferência" },
  { value: "cash", label: "Dinheiro" },
  { value: "other", label: "Outro" },
];

export function TransactionEditForm({ open, onOpenChange, transaction, onSuccess }: TransactionEditFormProps) {
  const { company } = useCompany();
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<{ id: string; name: string; code: string | null; type: string }[]>([]);
  const [costCenters, setCostCenters] = useState<{ id: string; name: string }[]>([]);
  const [bankAccounts, setBankAccounts] = useState<{ id: string; name: string }[]>([]);

  const [form, setForm] = useState({
    date: "",
    description: "",
    amount: "",
    type: "expense" as string,
    account_id: "",
    cost_center_id: "",
    bank_account_id: "",
    payment_method: "",
    project: "",
  });

  const isExternal = transaction?.source === "asaas" || transaction?.source === "bank";

  useEffect(() => {
    if (!transaction || !open) return;
    // Fetch full transaction data to populate form
    const fetchFull = async () => {
      const { data } = await supabase
        .from("transactions")
        .select("*")
        .eq("id", transaction.id)
        .single();
      if (data) {
        setForm({
          date: data.date,
          description: data.description,
          amount: String(data.amount),
          type: data.type,
          account_id: data.account_id || "",
          cost_center_id: data.cost_center_id || "",
          bank_account_id: data.bank_account_id || "",
          payment_method: data.payment_method || "",
          project: data.project || "",
        });
      }
    };
    fetchFull();
  }, [transaction, open]);

  useEffect(() => {
    if (!company) return;
    const fetchOptions = async () => {
      const [accts, ccs, banks] = await Promise.all([
        supabase.from("chart_of_accounts").select("id, name, code, type").eq("company_id", company.id).order("code"),
        supabase.from("cost_centers").select("id, name").eq("company_id", company.id).eq("active", true).order("name"),
        supabase.from("bank_accounts").select("id, name").eq("company_id", company.id).order("name"),
      ]);
      if (accts.data) setAccounts(accts.data);
      if (ccs.data) setCostCenters(ccs.data);
      if (banks.data) setBankAccounts(banks.data);
    };
    fetchOptions();
  }, [company]);

  const filteredAccounts = accounts.filter((a) =>
    form.type === "revenue" ? a.type === "revenue" : a.type === "expense"
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transaction) return;

    setLoading(true);

    const updates: Record<string, any> = {
      account_id: form.account_id || null,
      cost_center_id: form.cost_center_id || null,
      bank_account_id: form.bank_account_id || null,
      payment_method: form.payment_method || null,
      project: form.project.trim() || null,
    };

    // Only allow full edits for manual transactions
    if (!isExternal) {
      const amount = parseFloat(form.amount.replace(",", "."));
      if (isNaN(amount) || amount <= 0) { toast.error("Informe um valor válido."); setLoading(false); return; }
      updates.date = form.date;
      updates.description = form.description.trim();
      updates.amount = amount;
      updates.type = form.type;
    }

    const { error } = await supabase.from("transactions").update(updates).eq("id", transaction.id);
    if (error) { toast.error("Erro ao salvar: " + mensagemDeErro(e)); }
    else {
      toast.success("Lançamento atualizado!");
      onSuccess();
      onOpenChange(false);
    }
    setLoading(false);
  };

  const update = (key: string, value: string) => setForm({ ...form, [key]: value });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Lançamento</DialogTitle>
          <DialogDescription>
            {isExternal
              ? "Lançamento de integração — apenas classificação editável"
              : "Edite os dados do lançamento"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Tipo</Label>
              <Select value={form.type} onValueChange={(v) => update("type", v)} disabled={isExternal}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="revenue">Receita</SelectItem>
                  <SelectItem value="expense">Despesa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data</Label>
              <Input type="date" value={form.date} onChange={(e) => update("date", e.target.value)} disabled={isExternal} className="mt-1" />
            </div>
          </div>

          <div>
            <Label>Descrição</Label>
            <Textarea value={form.description} onChange={(e) => update("description", e.target.value)} disabled={isExternal} className="mt-1 min-h-[60px]" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Valor (R$)</Label>
              <Input value={form.amount} onChange={(e) => update("amount", e.target.value)} disabled={isExternal} className="mt-1" />
            </div>
            <div>
              <Label>Forma de Pagamento</Label>
              <Select value={form.payment_method} onValueChange={(v) => update("payment_method", v)}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {paymentMethods.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Conta Contábil</Label>
            <Select value={form.account_id} onValueChange={(v) => update("account_id", v)}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {filteredAccounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.code ? `${a.code} - ` : ""}{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Centro de Custo</Label>
              <Select value={form.cost_center_id} onValueChange={(v) => update("cost_center_id", v)}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {costCenters.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Conta Bancária</Label>
              <Select value={form.bank_account_id} onValueChange={(v) => update("bank_account_id", v)}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Opcional" /></SelectTrigger>
                <SelectContent>
                  {bankAccounts.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Projeto (opcional)</Label>
            <Input value={form.project} onChange={(e) => update("project", e.target.value)} className="mt-1" />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" variant="accent" className="flex-1" disabled={loading}>{loading ? "Salvando..." : "Salvar"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
