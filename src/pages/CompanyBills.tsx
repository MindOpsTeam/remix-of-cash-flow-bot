import { useMemo, useState, useCallback } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Receipt, FileText, ExternalLink, AlertTriangle, Plus } from "lucide-react";
import { useCompanyAsaasBills } from "@/hooks/useCompanyAsaasBills";
import { BillItem } from "@/components/asaas/BillItem";
import { useCompany } from "@/hooks/useCompany";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

function fmt(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

const invoiceStatusLabels: Record<string, string> = {
  SCHEDULED: "Agendada",
  AUTHORIZED: "Autorizada",
  PROCESSING_CANCELLATION: "Cancelando",
  CANCELED: "Cancelada",
  CANCELLATION_DENIED: "Cancelamento Negado",
  ERROR: "Erro",
  CREATED: "Criada",
  UPDATED: "Atualizada",
  SYNCHRONIZED: "Sincronizada",
};

const emptyBillForm = {
  description: "",
  amount: "",
  due_date: new Date().toISOString().split("T")[0],
  status: "pending" as string,
};

export default function CompanyBills() {
  const { bills, invoices, billsSummary, invoicesSummary, isLoading } = useCompanyAsaasBills();
  const { company } = useCompany();
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyBillForm });
  const [saving, setSaving] = useState(false);

  const handleCreateBill = useCallback(async () => {
    if (!company) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const amount = parseFloat(form.amount);
    if (!form.description.trim() || isNaN(amount) || amount <= 0 || !form.due_date) {
      toast.error("Preencha todos os campos corretamente");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("transactions").insert({
      company_id: company.id,
      user_id: user.id,
      description: form.description.trim(),
      amount,
      date: form.due_date,
      type: "expense",
      status: form.status,
      source: "manual",
    });
    setSaving(false);
    if (error) {
      toast.error("Erro ao criar conta a pagar");
    } else {
      toast.success("Conta a pagar criada!");
      setFormOpen(false);
      setForm({ ...emptyBillForm });
    }
  }, [company, form]);

  const groupedBills = useMemo(() => {
    const groups: Record<string, typeof bills> = {};
    for (const b of bills) {
      const key = b.due_date || b.created_at?.split("T")[0] || "sem-data";
      if (!groups[key]) groups[key] = [];
      groups[key].push(b);
    }
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [bills]);

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-[-0.02em]">Contas a Pagar</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Boletos, contas e notas fiscais da empresa
            </p>
          </div>
          <Button className="gap-2" variant="accent" onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" /> Nova Conta
          </Button>
        </div>

        <Tabs defaultValue="bills">
          <TabsList>
            <TabsTrigger value="bills" className="gap-1.5"><Receipt className="h-3.5 w-3.5" /> Contas a Pagar</TabsTrigger>
            <TabsTrigger value="invoices" className="gap-1.5"><FileText className="h-3.5 w-3.5" /> Notas Fiscais</TabsTrigger>
          </TabsList>

          <TabsContent value="bills" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Total a Pagar</p><p className="text-xl font-bold font-mono">{fmt(billsSummary.totalDue)}</p><p className="text-[10px] text-muted-foreground">{billsSummary.count} contas</p></CardContent></Card>
              <Card className={billsSummary.overdueCount > 0 ? "border-destructive/50" : ""}><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Vencidas</p><p className={`text-xl font-bold font-mono ${billsSummary.overdueCount > 0 ? "text-destructive" : ""}`}>{billsSummary.overdueCount}</p>{billsSummary.overdueCount > 0 && <p className="text-[10px] text-destructive flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Atenção</p>}</CardContent></Card>
              <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Pagas no Mês</p><p className="text-xl font-bold font-mono text-revenue">{fmt(billsSummary.paidThisMonth)}</p></CardContent></Card>
            </div>
            <div className="space-y-2">
              {isLoading ? (
                <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">Carregando...</CardContent></Card>
              ) : groupedBills.length === 0 ? (
                <Card><CardContent className="text-center py-12"><Receipt className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" /><p className="text-muted-foreground text-sm">Nenhuma conta a pagar encontrada.</p></CardContent></Card>
              ) : (
                groupedBills.map(([dateKey, items]) => (
                  <div key={dateKey}>
                    <div className="px-2 py-1.5"><span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{dateKey === "sem-data" ? "Sem data" : format(parseISO(dateKey), "dd 'de' MMM", { locale: ptBR })}</span></div>
                    <div className="bg-card border border-border rounded-lg divide-y divide-border">
                      {items.map((b) => <BillItem key={b.id} bill={b} />)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="invoices" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Total Faturado</p><p className="text-xl font-bold font-mono">{fmt(invoicesSummary.total)}</p><p className="text-[10px] text-muted-foreground">{invoicesSummary.count} notas</p></CardContent></Card>
              <Card className={invoicesSummary.errorCount > 0 ? "border-destructive/50" : ""}><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Com Erro</p><p className={`text-xl font-bold font-mono ${invoicesSummary.errorCount > 0 ? "text-destructive" : ""}`}>{invoicesSummary.errorCount}</p></CardContent></Card>
              <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">NFS-e Emitidas</p><p className="text-xl font-bold font-mono">{invoicesSummary.count}</p></CardContent></Card>
            </div>
            {isLoading ? (
              <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">Carregando...</CardContent></Card>
            ) : invoices.length === 0 ? (
              <Card><CardContent className="text-center py-12"><FileText className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" /><p className="text-muted-foreground text-sm">Nenhuma nota fiscal encontrada.</p></CardContent></Card>
            ) : (
              <div className="bg-card border border-border rounded-lg divide-y divide-border">
                {invoices.map((inv) => (
                  <div key={inv.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                    <div className="flex-shrink-0 h-9 w-9 rounded-full flex items-center justify-center bg-success/[0.08] text-success"><FileText className="h-4 w-4" /></div>
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <p className="text-sm font-medium truncate">{inv.number ? `NFS-e #${inv.number}` : "Nota Fiscal"}</p>
                      {inv.service_description && <p className="text-xs text-muted-foreground truncate">{inv.service_description}</p>}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {inv.effective_date && <span className="text-xs text-muted-foreground">{new Date(inv.effective_date + "T00:00:00").toLocaleDateString("pt-BR")}</span>}
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${inv.status === "AUTHORIZED" ? "text-revenue border-revenue/30" : inv.status === "ERROR" ? "text-destructive border-destructive/30" : ""}`}>{invoiceStatusLabels[inv.status] || inv.status}</Badge>
                        {inv.error_message && <span className="text-[10px] text-destructive truncate max-w-[200px]">{inv.error_message}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-sm font-semibold font-mono">{fmt(Number(inv.value || 0))}</span>
                      {inv.pdf_url && <a href={inv.pdf_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground" title="PDF"><ExternalLink className="h-3.5 w-3.5" /></a>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* New Bill Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova Conta a Pagar</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Descrição</Label>
              <Input className="mt-1" placeholder="Ex: Aluguel escritório" value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div>
              <Label>Valor (R$)</Label>
              <Input className="mt-1" type="number" step="0.01" min="0.01" placeholder="0,00" value={form.amount} onChange={(e) => setForm(f => ({ ...f, amount: e.target.value }))} />
            </div>
            <div>
              <Label>Vencimento</Label>
              <Input className="mt-1" type="date" value={form.due_date} onChange={(e) => setForm(f => ({ ...f, due_date: e.target.value }))} />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="confirmed">Paga</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" onClick={handleCreateBill} disabled={saving}>
              {saving ? "Salvando..." : "Criar Conta a Pagar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
