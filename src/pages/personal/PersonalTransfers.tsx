import { useState, useMemo } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ArrowUpDown, ArrowRight, Plus, Repeat, TrendingDown, Trash2, Wallet } from "lucide-react";
import { useAsaasTransfers } from "@/hooks/useAsaasTransfers";
import { useAsaasSubscriptions } from "@/hooks/useAsaasSubscriptions";
import { usePersonalTransfers } from "@/hooks/usePersonalTransfers";
import { usePersonalAccounts } from "@/hooks/usePersonalAccounts";
import { TransferItem } from "@/components/asaas/TransferItem";
import { SubscriptionCard } from "@/components/asaas/SubscriptionCard";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

function fmt(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

function groupByDate<T extends { scheduled_date?: string | null; created_at: string }>(items: T[], dateKey: "scheduled_date") {
  const groups: Record<string, T[]> = {};
  for (const item of items) {
    const key = (item[dateKey] as string) || item.created_at?.split("T")[0] || "sem-data";
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  }
  return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
}

const emptyTransferForm = {
  from_account_id: "",
  to_account_id: "",
  amount: 0,
  date: new Date().toISOString().split("T")[0],
  description: "",
};

export default function PersonalTransfers() {
  const { transfers: asaasTransfers, anticipations, transfersSummary, anticipationsSummary, isLoading } = useAsaasTransfers();
  const { subscriptions, summary: subsSummary, isLoading: subsLoading } = useAsaasSubscriptions();
  const { transfers: internalTransfers, isLoading: internalLoading, createTransfer, deleteTransfer, isCreating } = usePersonalTransfers();
  const { accounts } = usePersonalAccounts();

  const [formOpen, setFormOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyTransferForm });

  const groupedAsaasTransfers = useMemo(() => groupByDate(asaasTransfers, "scheduled_date"), [asaasTransfers]);

  const groupedAnticipations = useMemo(() => {
    const groups: Record<string, typeof anticipations> = {};
    for (const a of anticipations) {
      const key = a.anticipation_date || a.created_at?.split("T")[0] || "sem-data";
      if (!groups[key]) groups[key] = [];
      groups[key].push(a);
    }
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [anticipations]);

  const internalSummary = useMemo(() => {
    const total = internalTransfers.reduce((s, t) => s + Number(t.amount), 0);
    return { total, count: internalTransfers.length };
  }, [internalTransfers]);

  const handleCreateTransfer = () => {
    createTransfer(
      { ...form, amount: Number(form.amount), description: form.description || null },
      {
        onSuccess: () => {
          setFormOpen(false);
          setForm({ ...emptyTransferForm });
        },
      }
    );
  };

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-[-0.02em]">Transferências</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Movimentações entre contas, assinaturas e antecipações
          </p>
        </div>

        <Tabs defaultValue="internal">
          <TabsList>
            <TabsTrigger value="internal" className="gap-1.5">
              <Wallet className="h-3.5 w-3.5" /> Entre Contas
            </TabsTrigger>
            <TabsTrigger value="transfers" className="gap-1.5">
              <ArrowUpDown className="h-3.5 w-3.5" /> Asaas
            </TabsTrigger>
            <TabsTrigger value="subscriptions" className="gap-1.5">
              <Repeat className="h-3.5 w-3.5" /> Assinaturas
            </TabsTrigger>
            <TabsTrigger value="anticipations" className="gap-1.5">
              <TrendingDown className="h-3.5 w-3.5" /> Antecipações
            </TabsTrigger>
          </TabsList>

          {/* INTERNAL TRANSFERS TAB */}
          <TabsContent value="internal" className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="grid gap-4 md:grid-cols-2 flex-1">
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground">Total Movimentado</p>
                    <p className="text-xl font-bold font-mono">{fmt(internalSummary.total)}</p>
                    <p className="text-[10px] text-muted-foreground">{internalSummary.count} transferência(s)</p>
                  </CardContent>
                </Card>
              </div>
              <Button className="gap-2 ml-4" variant="accent" onClick={() => setFormOpen(true)} disabled={accounts.length < 2}>
                <Plus className="h-4 w-4" /> Nova Transferência
              </Button>
            </div>

            {internalLoading ? (
              <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">Carregando...</CardContent></Card>
            ) : internalTransfers.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <Wallet className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                  <p className="text-muted-foreground text-sm">Nenhuma transferência entre contas.</p>
                  <p className="text-xs text-muted-foreground mt-1">Transfira valores entre suas contas pessoais.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="bg-card border border-border rounded-lg divide-y divide-border">
                {internalTransfers.map((t) => (
                  <div key={t.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                    <div className="flex-shrink-0 h-9 w-9 rounded-full flex items-center justify-center bg-primary/10 text-primary">
                      <ArrowRight className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <div className="flex items-center gap-1.5 text-sm font-medium">
                        <span>{t.from_account?.name || "—"}</span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        <span>{t.to_account?.name || "—"}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span>{format(parseISO(t.date), "dd/MM/yyyy")}</span>
                        {t.description && <span>• {t.description}</span>}
                      </div>
                    </div>
                    <span className="text-sm font-semibold font-mono">{fmt(Number(t.amount))}</span>
                    <button onClick={() => setDeleteId(t.id)} className="text-muted-foreground hover:text-destructive transition-colors p-1">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ASAAS TRANSFERS TAB */}
          <TabsContent value="transfers" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground">Total Transferido</p>
                  <p className="text-xl font-bold font-mono">{fmt(transfersSummary.total)}</p>
                  <p className="text-[10px] text-muted-foreground">{transfersSummary.count} transferências</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground">Taxas Pagas</p>
                  <p className="text-xl font-bold font-mono text-destructive">{fmt(transfersSummary.fees)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground">Pendentes</p>
                  <p className="text-xl font-bold font-mono text-yellow-600">{transfersSummary.pending}</p>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-2">
              {isLoading ? (
                <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">Carregando...</CardContent></Card>
              ) : groupedAsaasTransfers.length === 0 ? (
                <Card>
                  <CardContent className="text-center py-12">
                    <ArrowUpDown className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                    <p className="text-muted-foreground text-sm">Nenhuma transferência encontrada.</p>
                    <p className="text-xs text-muted-foreground mt-1">Transferências do Asaas aparecerão aqui automaticamente.</p>
                  </CardContent>
                </Card>
              ) : (
                groupedAsaasTransfers.map(([dateKey, items]) => (
                  <div key={dateKey}>
                    <div className="px-2 py-1.5">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        {dateKey === "sem-data" ? "Sem data" : format(parseISO(dateKey), "dd 'de' MMM", { locale: ptBR })}
                      </span>
                    </div>
                    <div className="bg-card border border-border rounded-lg divide-y divide-border">
                      {items.map((t) => <TransferItem key={t.id} transfer={t} />)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </TabsContent>

          {/* SUBSCRIPTIONS TAB */}
          <TabsContent value="subscriptions" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground">Ativas</p>
                  <p className="text-xl font-bold font-mono text-revenue">{subsSummary.activeCount}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground">MRR (Receita Mensal)</p>
                  <p className="text-xl font-bold font-mono">{fmt(subsSummary.mrr)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground">Próximo Vencimento</p>
                  <p className="text-xl font-bold font-mono">
                    {subsSummary.nextDue
                      ? new Date(subsSummary.nextDue + "T00:00:00").toLocaleDateString("pt-BR")
                      : "—"}
                  </p>
                </CardContent>
              </Card>
            </div>

            {subsLoading ? (
              <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">Carregando...</CardContent></Card>
            ) : subscriptions.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <Repeat className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                  <p className="text-muted-foreground text-sm">Nenhuma assinatura encontrada.</p>
                  <p className="text-xs text-muted-foreground mt-1">Assinaturas do Asaas aparecerão aqui automaticamente.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {subscriptions.map((s) => <SubscriptionCard key={s.id} subscription={s} />)}
              </div>
            )}
          </TabsContent>

          {/* ANTICIPATIONS TAB */}
          <TabsContent value="anticipations" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground">Total Antecipado</p>
                  <p className="text-xl font-bold font-mono">{fmt(anticipationsSummary.total)}</p>
                  <p className="text-[10px] text-muted-foreground">{anticipationsSummary.count} antecipações</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground">Taxas de Antecipação</p>
                  <p className="text-xl font-bold font-mono text-destructive">{fmt(anticipationsSummary.fees)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground">Pendentes</p>
                  <p className="text-xl font-bold font-mono text-yellow-600">{anticipationsSummary.pending}</p>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-2">
              {isLoading ? (
                <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">Carregando...</CardContent></Card>
              ) : groupedAnticipations.length === 0 ? (
                <Card>
                  <CardContent className="text-center py-12">
                    <TrendingDown className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                    <p className="text-muted-foreground text-sm">Nenhuma antecipação encontrada.</p>
                    <p className="text-xs text-muted-foreground mt-1">Antecipações do Asaas aparecerão aqui automaticamente.</p>
                  </CardContent>
                </Card>
              ) : (
                groupedAnticipations.map(([dateKey, items]) => (
                  <div key={dateKey}>
                    <div className="px-2 py-1.5">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        {dateKey === "sem-data" ? "Sem data" : format(parseISO(dateKey), "dd 'de' MMM", { locale: ptBR })}
                      </span>
                    </div>
                    <div className="bg-card border border-border rounded-lg divide-y divide-border">
                      {items.map((a) => (
                        <div key={a.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                          <div className="flex-shrink-0 h-9 w-9 rounded-full flex items-center justify-center bg-purple-500/10 text-purple-600">
                            <TrendingDown className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0 space-y-0.5">
                            <p className="text-sm font-medium">Antecipação</p>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              {a.anticipation_date && (
                                <span>{new Date(a.anticipation_date + "T00:00:00").toLocaleDateString("pt-BR")}</span>
                              )}
                              {a.installment_count && <span>• {a.installment_count} parcelas</span>}
                            </div>
                            <div className="flex items-center gap-1">
                              <span className={`text-[10px] px-1.5 py-0 rounded border ${
                                a.status === "CREDITED" ? "text-revenue border-revenue/30"
                                  : a.status === "DENIED" ? "text-destructive border-destructive/30"
                                  : "text-yellow-600 border-yellow-600/30"
                              }`}>
                                {a.status}
                              </span>
                              {a.fee && Number(a.fee) > 0 && (
                                <span className="text-[10px] text-muted-foreground">Taxa: {fmt(Number(a.fee))}</span>
                              )}
                            </div>
                          </div>
                          <span className="text-sm font-semibold font-mono">{fmt(Number(a.anticipated_value || 0))}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Create Internal Transfer Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova Transferência entre Contas</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Conta de Origem</Label>
              <Select value={form.from_account_id} onValueChange={(v) => setForm((f) => ({ ...f, from_account_id: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {accounts.filter((a) => a.id !== form.to_account_id).map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name} ({fmt(a.current_balance)})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Conta de Destino</Label>
              <Select value={form.to_account_id} onValueChange={(v) => setForm((f) => ({ ...f, to_account_id: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {accounts.filter((a) => a.id !== form.from_account_id).map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name} ({fmt(a.current_balance)})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Valor (R$)</Label>
                <Input type="number" step="0.01" value={form.amount || ""} onChange={(e) => setForm((f) => ({ ...f, amount: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div>
                <Label>Data</Label>
                <Input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Descrição (opcional)</Label>
              <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Ex: Transferência para reserva..." />
            </div>
            <Button
              onClick={handleCreateTransfer}
              disabled={isCreating || !form.from_account_id || !form.to_account_id || !form.amount || form.from_account_id === form.to_account_id}
              className="w-full"
            >
              {isCreating ? "Transferindo..." : "Transferir"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir transferência?</AlertDialogTitle>
            <AlertDialogDescription>O saldo das contas será revertido automaticamente.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (deleteId) { deleteTransfer(deleteId); setDeleteId(null); } }}
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
