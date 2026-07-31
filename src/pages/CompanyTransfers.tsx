import { useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  ArrowUpDown,
  Repeat,
  TrendingDown,
  TrendingUp,
  DollarSign,
  Building2,
  RefreshCw,
  ArrowDownRight,
  ArrowUpRight,
} from "lucide-react";
import { useCompanyAsaasTransfers } from "@/hooks/useCompanyAsaasTransfers";
import { useCompanyAsaasSubscriptions } from "@/hooks/useCompanyAsaasSubscriptions";
import { useCompanyInterTransactions } from "@/hooks/useCompanyInterTransactions";
import { TransferItem } from "@/components/asaas/TransferItem";
import { SubscriptionCard } from "@/components/asaas/SubscriptionCard";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

function fmt(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

export default function CompanyTransfers() {
  const [source, setSource] = useState<"asaas" | "inter">("asaas");

  // Asaas data
  const { transfers, anticipations, transfersSummary, anticipationsSummary, isLoading } =
    useCompanyAsaasTransfers();
  const { subscriptions, summary: subsSummary, isLoading: subsLoading } =
    useCompanyAsaasSubscriptions();

  // Inter data
  const {
    groupedTransactions: interGrouped,
    summary: interSummary,
    isLoading: interLoading,
    syncing,
    syncInter,
  } = useCompanyInterTransactions();

  const groupedTransfers = useMemo(() => {
    const groups: Record<string, typeof transfers> = {};
    for (const t of transfers) {
      const key = t.scheduled_date || t.created_at?.split("T")[0] || "sem-data";
      if (!groups[key]) groups[key] = [];
      groups[key].push(t);
    }
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [transfers]);

  const groupedAnticipations = useMemo(() => {
    const groups: Record<string, typeof anticipations> = {};
    for (const a of anticipations) {
      const key = a.anticipation_date || a.created_at?.split("T")[0] || "sem-data";
      if (!groups[key]) groups[key] = [];
      groups[key].push(a);
    }
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [anticipations]);

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header with source selector */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-[-0.02em]">Movimentações</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {source === "asaas"
                ? "Transferências, assinaturas e antecipações via Asaas"
                : "Extrato e transações sincronizadas do Banco Inter"}
            </p>
          </div>

          {/* Source toggle */}
          <div className="flex items-center gap-1 p-1 bg-muted rounded-lg self-start">
            <button
              onClick={() => setSource("asaas")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                source === "asaas"
                  ? "bg-background text-success shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <DollarSign className="h-3.5 w-3.5" />
              Asaas
            </button>
            <button
              onClick={() => setSource("inter")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                source === "inter"
                  ? "bg-background text-warning shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Building2 className="h-3.5 w-3.5" />
              Banco Inter
            </button>
          </div>
        </div>

        {/* ===== ASAAS ===== */}
        {source === "asaas" && (
          <Tabs
            defaultValue={
              typeof window !== "undefined" &&
              ["transfers", "subscriptions", "anticipations"].includes(
                new URLSearchParams(window.location.search).get("tab") ?? "",
              )
                ? (new URLSearchParams(window.location.search).get("tab") as string)
                : "transfers"
            }
          >
            <TabsList>
              <TabsTrigger value="transfers" className="gap-1.5">
                <ArrowUpDown className="h-3.5 w-3.5" /> Transferências
              </TabsTrigger>
              <TabsTrigger value="subscriptions" className="gap-1.5">
                <Repeat className="h-3.5 w-3.5" /> Assinaturas
              </TabsTrigger>
              <TabsTrigger value="anticipations" className="gap-1.5">
                <TrendingDown className="h-3.5 w-3.5" /> Antecipações
              </TabsTrigger>
            </TabsList>

            <TabsContent value="transfers" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Total Transferido</p><p className="text-xl font-bold font-mono">{fmt(transfersSummary.total)}</p><p className="text-[10px] text-muted-foreground">{transfersSummary.count} transferências</p></CardContent></Card>
                <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Taxas Pagas</p><p className="text-xl font-bold font-mono text-destructive">{fmt(transfersSummary.fees)}</p></CardContent></Card>
                <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Pendentes</p><p className="text-xl font-bold font-mono text-warning">{transfersSummary.pending}</p></CardContent></Card>
              </div>
              <div className="space-y-2">
                {isLoading ? (
                  <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">Carregando...</CardContent></Card>
                ) : groupedTransfers.length === 0 ? (
                  <Card><CardContent className="text-center py-12"><ArrowUpDown className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" /><p className="text-muted-foreground text-sm">Nenhuma transferência encontrada.</p></CardContent></Card>
                ) : (
                  groupedTransfers.map(([dateKey, items]) => (
                    <div key={dateKey}>
                      <div className="px-2 py-1.5"><span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{dateKey === "sem-data" ? "Sem data" : format(parseISO(dateKey), "dd 'de' MMM", { locale: ptBR })}</span></div>
                      <div className="bg-card border border-border rounded-lg divide-y divide-border">
                        {items.map((t) => <TransferItem key={t.id} transfer={t} />)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>

            <TabsContent value="subscriptions" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Ativas</p><p className="text-xl font-bold font-mono text-revenue">{subsSummary.activeCount}</p></CardContent></Card>
                <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">MRR (Receita Mensal)</p><p className="text-xl font-bold font-mono">{fmt(subsSummary.mrr)}</p></CardContent></Card>
                <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Próximo Vencimento</p><p className="text-xl font-bold font-mono">{subsSummary.nextDue ? new Date(subsSummary.nextDue + "T00:00:00").toLocaleDateString("pt-BR") : "—"}</p></CardContent></Card>
              </div>
              {subsLoading ? (
                <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">Carregando...</CardContent></Card>
              ) : subscriptions.length === 0 ? (
                <Card><CardContent className="text-center py-12"><Repeat className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" /><p className="text-muted-foreground text-sm">Nenhuma assinatura encontrada.</p></CardContent></Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {subscriptions.map((s) => <SubscriptionCard key={s.id} subscription={s} />)}
                </div>
              )}
            </TabsContent>

            <TabsContent value="anticipations" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Total Antecipado</p><p className="text-xl font-bold font-mono">{fmt(anticipationsSummary.total)}</p><p className="text-[10px] text-muted-foreground">{anticipationsSummary.count} antecipações</p></CardContent></Card>
                <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Taxas de Antecipação</p><p className="text-xl font-bold font-mono text-destructive">{fmt(anticipationsSummary.fees)}</p></CardContent></Card>
                <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Pendentes</p><p className="text-xl font-bold font-mono text-warning">{anticipationsSummary.pending}</p></CardContent></Card>
              </div>
              <div className="space-y-2">
                {isLoading ? (
                  <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">Carregando...</CardContent></Card>
                ) : groupedAnticipations.length === 0 ? (
                  <Card><CardContent className="text-center py-12"><TrendingDown className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" /><p className="text-muted-foreground text-sm">Nenhuma antecipação encontrada.</p></CardContent></Card>
                ) : (
                  groupedAnticipations.map(([dateKey, items]) => (
                    <div key={dateKey}>
                      <div className="px-2 py-1.5"><span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{dateKey === "sem-data" ? "Sem data" : format(parseISO(dateKey), "dd 'de' MMM", { locale: ptBR })}</span></div>
                      <div className="bg-card border border-border rounded-lg divide-y divide-border">
                        {items.map((a) => (
                          <div key={a.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                            <div className="flex-shrink-0 h-9 w-9 rounded-full flex items-center justify-center bg-primary/[0.08] text-primary"><TrendingDown className="h-4 w-4" /></div>
                            <div className="flex-1 min-w-0 space-y-0.5">
                              <p className="text-sm font-medium">Antecipação</p>
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                {a.anticipation_date && <span>{new Date(a.anticipation_date + "T00:00:00").toLocaleDateString("pt-BR")}</span>}
                                {a.installment_count && <span>• {a.installment_count} parcelas</span>}
                              </div>
                              <div className="flex items-center gap-1">
                                <span className={`text-[10px] px-1.5 py-0 rounded border ${a.status === "CREDITED" ? "text-revenue border-revenue/30" : a.status === "DENIED" ? "text-destructive border-destructive/30" : "text-warning border-warning/30"}`}>{a.status}</span>
                                {a.fee && Number(a.fee) > 0 && <span className="text-[10px] text-muted-foreground">Taxa: {fmt(Number(a.fee))}</span>}
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
        )}

        {/* ===== BANCO INTER ===== */}
        {source === "inter" && (
          <div className="space-y-4">
            {/* Summary cards */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground">Saldo Inter</p>
                  <p className="text-xl font-bold font-mono">
                    {interSummary.lastBalance !== null ? fmt(interSummary.lastBalance) : "—"}
                  </p>
                  {interSummary.lastSyncAt && (
                    <p className="text-[10px] text-muted-foreground">
                      Última sync: {new Date(interSummary.lastSyncAt).toLocaleString("pt-BR")}
                    </p>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-1.5">
                    <TrendingUp className="h-3.5 w-3.5 text-revenue" />
                    <p className="text-xs text-muted-foreground">Receitas</p>
                  </div>
                  <p className="text-xl font-bold font-mono text-revenue">{fmt(interSummary.totalRevenue)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-1.5">
                    <TrendingDown className="h-3.5 w-3.5 text-destructive" />
                    <p className="text-xs text-muted-foreground">Despesas</p>
                  </div>
                  <p className="text-xl font-bold font-mono text-destructive">{fmt(interSummary.totalExpense)}</p>
                </CardContent>
              </Card>
            </div>

            {/* Sync button */}
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={syncInter}
                disabled={syncing || !interSummary.configured || !interSummary.active}
                className="gap-1.5"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
                {syncing ? "Sincronizando..." : "Sincronizar (30 dias)"}
              </Button>
            </div>

            {/* Not configured message */}
            {!interSummary.configured && !interLoading && (
              <Card>
                <CardContent className="text-center py-12">
                  <Building2 className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                  <p className="text-muted-foreground text-sm">
                    Integração com Banco Inter não configurada.
                  </p>
                  <p className="text-muted-foreground text-xs mt-1">
                    Configure em Configurações → Integrações → Banco Inter
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Transaction list */}
            {interSummary.configured && (
              <div className="space-y-2">
                {interLoading ? (
                  <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">Carregando...</CardContent></Card>
                ) : interGrouped.length === 0 ? (
                  <Card>
                    <CardContent className="text-center py-12">
                      <ArrowUpDown className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                      <p className="text-muted-foreground text-sm">Nenhuma transação Inter encontrada.</p>
                      <p className="text-muted-foreground text-xs mt-1">Clique em "Sincronizar" para importar o extrato.</p>
                    </CardContent>
                  </Card>
                ) : (
                  interGrouped.map(([dateKey, items]) => (
                    <div key={dateKey}>
                      <div className="px-2 py-1.5">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          {dateKey === "sem-data" ? "Sem data" : format(parseISO(dateKey), "dd 'de' MMM", { locale: ptBR })}
                        </span>
                      </div>
                      <div className="bg-card border border-border rounded-lg divide-y divide-border">
                        {items.map((tx) => (
                          <div key={tx.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                            <div
                              className={`flex-shrink-0 h-9 w-9 rounded-full flex items-center justify-center ${
                                tx.type === "revenue"
                                  ? "bg-success/[0.08] text-success"
                                  : "bg-destructive/[0.08] text-destructive"
                              }`}
                            >
                              {tx.type === "revenue" ? (
                                <ArrowDownRight className="h-4 w-4" />
                              ) : (
                                <ArrowUpRight className="h-4 w-4" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0 space-y-0.5">
                              <p className="text-sm font-medium truncate">{tx.description}</p>
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <span
                                  className={`text-[10px] px-1.5 py-0 rounded border ${
                                    tx.status === "paid"
                                      ? "text-revenue border-revenue/30"
                                      : "text-warning border-warning/30"
                                  }`}
                                >
                                  {tx.status === "paid" ? "Pago" : tx.status}
                                </span>
                                {tx.payment_method && (
                                  <span className="text-[10px] text-muted-foreground">{tx.payment_method}</span>
                                )}
                              </div>
                            </div>
                            <span
                              className={`text-sm font-semibold font-mono ${
                                tx.type === "revenue" ? "text-revenue" : "text-destructive"
                              }`}
                            >
                              {tx.type === "expense" ? "- " : "+ "}
                              {fmt(Number(tx.amount))}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
