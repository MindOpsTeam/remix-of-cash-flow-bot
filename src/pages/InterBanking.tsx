import { AppLayout } from "@/components/AppLayout";
import { useCompanyInterTransactions } from "@/hooks/useCompanyInterTransactions";
import { useCompany } from "@/hooks/useCompany";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  RefreshCw, Landmark, TrendingUp, TrendingDown, ArrowUpDown,
  Calendar, Settings, ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const fmtMoney = (v: number | null | undefined) =>
  v != null
    ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : "—";

const fmtDate = (iso: string | null | undefined) =>
  iso ? format(new Date(iso), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "—";

export default function InterBanking() {
  const { company } = useCompany();
  const {
    transactions,
    groupedTransactions,
    summary,
    isLoading,
    syncing,
    syncInter,
  } = useCompanyInterTransactions();

  const { data: interConfig } = useQuery({
    queryKey: ["inter_config", company?.id],
    enabled: !!company?.id,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("inter_config")
        .select("last_balance, last_balance_at, last_sync_at, environment, active")
        .eq("company_id", company!.id)
        .maybeSingle();
      return data;
    },
  });

  const notConfigured = !summary.configured && !interConfig;

  return (
    <AppLayout>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Landmark className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold text-foreground tracking-[-0.02em]">
              Banco Inter
            </h1>
            {interConfig?.active && (
              <Badge variant="default" className="text-[10px]">Conectado</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Extrato, saldo e movimentações da sua conta Inter
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/settings/integrations/inter">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Settings className="h-3.5 w-3.5" />
              Configurar
            </Button>
          </Link>
          <Button
            size="sm"
            onClick={syncInter}
            disabled={syncing || notConfigured}
            className="gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Sincronizando..." : "Sincronizar"}
          </Button>
        </div>
      </div>

      {/* Not configured state */}
      {notConfigured && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Landmark className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <h2 className="text-lg font-semibold text-foreground mb-1">
            Integração não configurada
          </h2>
          <p className="text-sm text-muted-foreground mb-4 max-w-sm">
            Configure suas credenciais do Banco Inter para visualizar saldo, extrato e movimentações.
          </p>
          <Link to="/settings/integrations/inter">
            <Button className="gap-1.5">
              <Settings className="h-4 w-4" />
              Configurar agora
            </Button>
          </Link>
        </div>
      )}

      {!notConfigured && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Landmark className="h-4 w-4 text-primary" />
                <span className="text-xs text-muted-foreground">Saldo Inter</span>
              </div>
              <p className="text-xl font-bold text-foreground">
                {fmtMoney(interConfig?.last_balance ?? summary.lastBalance)}
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">
                Atualizado: {fmtDate(interConfig?.last_balance_at)}
              </p>
            </div>

            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-income" />
                <span className="text-xs text-muted-foreground">Entradas</span>
              </div>
              <p className="text-xl font-bold text-income">
                {fmtMoney(summary.totalRevenue)}
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">
                Últimos 30 dias
              </p>
            </div>

            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown className="h-4 w-4 text-expense" />
                <span className="text-xs text-muted-foreground">Saídas</span>
              </div>
              <p className="text-xl font-bold text-expense">
                {fmtMoney(summary.totalExpense)}
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">
                Últimos 30 dias
              </p>
            </div>

            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Transações</span>
              </div>
              <p className="text-xl font-bold text-foreground">{summary.count}</p>
              <p className="text-[10px] text-muted-foreground mt-1">
                Sync: {fmtDate(interConfig?.last_sync_at ?? summary.lastSyncAt)}
              </p>
            </div>
          </div>

          {/* Transaction list */}
          <div className="bg-card border border-border rounded-xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h2 className="text-sm font-semibold text-foreground">
                Extrato de transações
              </h2>
              <span className="text-xs text-muted-foreground">
                {summary.count} lançamento{summary.count !== 1 ? "s" : ""}
              </span>
            </div>

            {isLoading ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                Carregando transações...
              </div>
            ) : transactions.length === 0 ? (
              <div className="p-8 text-center">
                <Calendar className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  Nenhuma transação sincronizada ainda.
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Clique em "Sincronizar" para importar o extrato dos últimos 30 dias.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border max-h-[500px] overflow-y-auto">
                {groupedTransactions.map(([date, txs]) => (
                  <div key={date}>
                    <div className="px-4 py-2 bg-muted/30 sticky top-0 z-10">
                      <span className="text-xs font-medium text-muted-foreground">
                        {date !== "sem-data"
                          ? format(new Date(date + "T12:00:00"), "EEEE, dd 'de' MMMM", {
                              locale: ptBR,
                            })
                          : "Sem data"}
                      </span>
                    </div>
                    {txs.map((tx) => (
                      <div
                        key={tx.id}
                        className="flex items-center justify-between px-4 py-3 hover:bg-accent/30 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground truncate">
                            {tx.description}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {tx.payment_method && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                {tx.payment_method}
                              </Badge>
                            )}
                            <Badge
                              variant="secondary"
                              className="text-[10px] px-1.5 py-0"
                            >
                              {tx.status}
                            </Badge>
                          </div>
                        </div>
                        <span
                          className={`text-sm font-semibold whitespace-nowrap ml-4 ${
                            tx.type === "revenue" ? "text-income" : "text-expense"
                          }`}
                        >
                          {tx.type === "revenue" ? "+" : "-"}{" "}
                          {fmtMoney(Math.abs(tx.amount))}
                        </span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </AppLayout>
  );
}
