import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { CYCLE_LABEL, PAYMENT_METHOD_LABEL } from "@/lib/receivables";
import type { ContractInput } from "@/hooks/useContracts";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: ContractInput) => void;
  isPending?: boolean;
}

type Contact = { id: string; name: string; document: string | null };
type Account = { id: string; name: string; code: string | null; type: string };
type CostCenter = { id: string; name: string };

const today = () => new Date().toISOString().split("T")[0];

export function ContractFormDialog({ open, onOpenChange, onSubmit, isPending }: Props) {
  const { company } = useCompany();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);

  const [contactId, setContactId] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [cycle, setCycle] = useState("MONTHLY");
  const [billingDay, setBillingDay] = useState("5");
  const [paymentMethod, setPaymentMethod] = useState("BOLETO");
  const [startDate, setStartDate] = useState(today());
  const [endDate, setEndDate] = useState("");
  const [accountId, setAccountId] = useState("");
  const [costCenterId, setCostCenterId] = useState("");
  const [autoBilling, setAutoBilling] = useState(true);

  useEffect(() => {
    if (!company || !open) return;
    (async () => {
      const [c, a, cc] = await Promise.all([
        supabase.from("contacts").select("id, name, document").eq("company_id", company.id).eq("active", true).order("name"),
        supabase.from("chart_of_accounts").select("id, name, code, type").eq("company_id", company.id).order("code"),
        supabase.from("cost_centers").select("id, name").eq("company_id", company.id).eq("active", true).order("name"),
      ]);
      setContacts((c.data as Contact[]) ?? []);
      setAccounts((a.data as Account[]) ?? []);
      setCostCenters((cc.data as CostCenter[]) ?? []);
    })();
  }, [company, open]);

  const revenueAccounts = accounts.filter((a) => a.type === "revenue");
  const selectedContact = contacts.find((c) => c.id === contactId);
  const contactHasDoc = !!selectedContact?.document;

  const reset = () => {
    setContactId(""); setDescription(""); setAmount(""); setCycle("MONTHLY");
    setBillingDay("5"); setPaymentMethod("BOLETO"); setStartDate(today()); setEndDate("");
    setAccountId(""); setCostCenterId(""); setAutoBilling(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactId || !description || !amount || !accountId || !costCenterId) return;
    onSubmit({
      contact_id: contactId,
      description,
      amount: parseFloat(amount),
      cycle,
      billing_day: parseInt(billingDay, 10),
      payment_method: paymentMethod,
      start_date: startDate,
      end_date: endDate || null,
      account_id: accountId,
      cost_center_id: costCenterId,
      auto_billing: autoBilling,
    });
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo contrato</DialogTitle>
          <DialogDescription>
            Todo período o contrato gera uma conta a receber. Com cobrança automática, o Asaas emite o boleto e envia ao cliente.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Cliente</Label>
            <Select value={contactId} onValueChange={setContactId}>
              <SelectTrigger><SelectValue placeholder="Selecione o cliente" /></SelectTrigger>
              <SelectContent>
                {contacts.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex.: Honorários contábeis mensais" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Valor (R$)</Label>
              <Input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Periodicidade</Label>
              <Select value={cycle} onValueChange={setCycle}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CYCLE_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Dia de cobrança (1-28)</Label>
              <Input type="number" min="1" max="28" value={billingDay} onChange={(e) => setBillingDay(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Forma de cobrança</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["BOLETO", "PIX", "CREDIT_CARD", "UNDEFINED"].map((k) => (
                    <SelectItem key={k} value={k}>{PAYMENT_METHOD_LABEL[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Início</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Fim (opcional)</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
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
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="pr-3">
              <Label className="text-sm">Cobrança automática (Asaas)</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                {contactId && !contactHasDoc
                  ? "Cliente sem CPF/CNPJ — cadastre o documento para ativar o boleto automático."
                  : "Cria a assinatura no Asaas: boleto mensal gerado e enviado ao cliente."}
              </p>
            </div>
            <Switch checked={autoBilling} onCheckedChange={setAutoBilling} disabled={!!contactId && !contactHasDoc} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={isPending}>Criar contrato</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
