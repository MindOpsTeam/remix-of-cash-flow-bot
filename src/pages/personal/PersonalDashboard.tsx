import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Wallet, Landmark } from "lucide-react";
import { usePersonalAccounts } from "@/hooks/usePersonalAccounts";
import { usePersonalTransactions } from "@/hooks/usePersonalTransactions";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

function fmt(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export default function PersonalDashboard() {
  const { accounts, totalBalance, isLoading: accountsLoading } = usePersonalAccounts();
  const { summary, isLoading: txLoading } = usePersonalTransactions();

  const isLoading = accountsLoading || txLoading;

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-32" />)}
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Dashboard Pessoal</h1>
          <p className="text-sm text-muted-foreground mt-1">Visão geral das suas finanças pessoais</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Entradas (mês)</CardTitle>
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-500">{fmt(summary.receitas)}</div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Saídas (mês)</CardTitle>
              <TrendingDown className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{fmt(summary.despesas)}</div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Saldo do Mês</CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${summary.saldo >= 0 ? "text-emerald-500" : "text-destructive"}`}>
                {fmt(summary.saldo)}
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Saldo Total</CardTitle>
              <Landmark className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{fmt(totalBalance)}</div>
              <p className="text-xs text-muted-foreground mt-1">{accounts.length} conta(s) ativa(s)</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-lg">Ações Rápidas</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Link to="/personal/transactions">
                <Button variant="outline" size="sm">Ver Transações</Button>
              </Link>
              <Link to="/personal/accounts">
                <Button variant="outline" size="sm">Gerenciar Contas</Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-lg">Resumo</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {summary.count} transações neste mês.
                {summary.saldo >= 0
                  ? " Você está no positivo — continue assim!"
                  : " Gastos superaram receitas. Revise seus lançamentos."}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
