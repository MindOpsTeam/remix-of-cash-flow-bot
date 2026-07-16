import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import type { ReceivableInput } from "@/hooks/useReceivables";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: ReceivableInput) => void;
  initialData?: Partial<ReceivableInput> & { id?: string };
  isPending?: boolean;
}

type Contact = { id: string; name: string };
type Account = { id: string; name: string; code: string | null; type: string };
type CostCenter = { id: string; name: string };

export function ReceivableFormDialog({ open, onOpenChange, onSubmit, initialData, isPending }: Props) {
  const { company } = useCompany();
  const isEdit = !!initialData?.id;

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);

  const [contactId, setContactId] = useState(initialData?.contact_id ?? "");
  const [description, setDescription] = useState(initialData?.description ?? "");
  const [amount, setAmount] = useState(initialData?.amount?.toString() ?? "");
  const [dueDate, setDueDate] = useState(initialData?.due_date ?? "");
  const [accountId, setAccountId] = useState(initialData?.account_id ?? "");
  const [costCenterId, setCostCenterId] = useState(initialData?.cost_center_id ?? "");

  useEffect(() => {
    if (!company || !open) return;
    (async () => {
      const [c, a, cc] = await Promise.all([
        supabase.from("contacts").select("id, name").eq("company_id", company.id).eq("active", true).order("name"),
        supabase.from("chart_of_accounts").select("id, name, code, type").eq("company_id", company.id).order("code"),
        supabase.from("cost_centers").select("id, name").eq("company_id", company.id).eq("active", true).order("name"),
      ]);
      setContacts((c.data as Contact[]) ?? []);
      setAccounts((a.data as Account[]) ?? []);
      setCostCenters((cc.data as CostCenter[]) ?? []);
    })();
  }, [company, open]);

  const revenueAccounts = accounts.filter((a) => a.type === "revenue");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || !dueDate || !amount || !accountId || !costCenterId) return;
    onSubmit({
      contact_id: contactId || null,
      description,
      amount: parseFloat(amount),
      due_date: dueDate,
      account_id: accountId,
      cost_center_id: costCenterId,
    });
    if (!isEdit) {
      setContactId(""); setDescription(""); setAmount(""); setDueDate(""); setAccountId(""); setCostCenterId("");
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar conta a receber" : "Nova conta a receber"}</DialogTitle>
          <DialogDescription>
            A conta contábil e o centro de custo classificam a receita no DRE quando você der baixa.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Cliente</Label>
            <Select value={contactId} onValueChange={setContactId}>
              <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
              <SelectContent>
                {contacts.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex.: Mensalidade contábil" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Valor (R$)</Label>
              <Input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Vencimento</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Conta de receita</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger><SelectValue placeholder="Selecione a conta contábil" /></SelectTrigger>
              <SelectContent>
                {revenueAccounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.code ? `${a.code} · ` : ""}{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Centro de custo</Label>
            <Select value={costCenterId} onValueChange={setCostCenterId}>
              <SelectTrigger><SelectValue placeholder="Selecione o centro de custo" /></SelectTrigger>
              <SelectContent>
                {costCenters.map((cc) => <SelectItem key={cc.id} value={cc.id}>{cc.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={isPending}>{isEdit ? "Salvar" : "Criar"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
