import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Wallet, Landmark } from "lucide-react";
import { usePersonalAccounts } from "@/hooks/usePersonalAccounts";
import { usePersonalKPIs, generateInsight } from "@/hooks/usePersonalKPIs";
import { AIInsightCard } from "@/components/AIInsightCard";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

function fmt(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export default function PersonalDashboard() {
  const { accounts, totalBalance, isLoading: accountsLoading } = usePersonalAccounts();
  const { kpis, comparison, chartData, isLoading: kpisLoading } = usePersonalKPIs();

  const isLoading = accountsLoading || kpisLoading;

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-32" />)}
          </div>
          <Skeleton className="h-[300px]" />
        </div>
      </AppLayout>
    );
  }

  const insightText = generateInsight(kpis, comparison);

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-[-0.02em]">Dashboard Pessoal</h1>
          <p className="text-sm text-muted-foreground mt-1">Visão geral das suas finanças pessoais</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Entradas (mês)</CardTitle>
              <TrendingUp className="h-4 w-4 text-revenue" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono text-revenue">{fmt(kpis.entradas_mes)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Saídas (mês)</CardTitle>
              <TrendingDown className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono text-destructive">{fmt(kpis.saidas_mes)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Saldo do Mês</CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold font-mono ${kpis.saldo_mes >= 0 ? "text-revenue" : "text-destructive"}`}>
                {fmt(kpis.saldo_mes)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Saldo Total</CardTitle>
              <Landmark className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono text-foreground">{fmt(totalBalance)}</div>
              <p className="text-xs text-muted-foreground mt-1">{accounts.length} conta(s) ativa(s)</p>
            </CardContent>
          </Card>
        </div>

        {/* AI Insight */}
        <AIInsightCard text={insightText} linkTo="/personal/summary" linkLabel="Ver resumo completo" />

        {/* Monthly Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Receitas vs Despesas (6 meses)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} className="text-muted-foreground" />
                <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                  formatter={(v: number, name: string) => [fmt(v), name === "receita" ? "Receita" : name === "despesa" ? "Despesa" : "Resultado"]}
                />
                <Legend formatter={(v) => v === "receita" ? "Receita" : v === "despesa" ? "Despesa" : "Resultado"} />
                <Bar dataKey="receita" fill="hsl(var(--revenue))" radius={[4, 4, 0, 0]} barSize={24} stackId="a" />
                <Bar dataKey="despesa" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} barSize={24} stackId="b" />
                <Line type="monotone" dataKey="resultado" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Ações Rápidas</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Link to="/personal/transactions"><Button variant="outline" size="sm">Ver Transações</Button></Link>
              <Link to="/personal/accounts"><Button variant="outline" size="sm">Gerenciar Contas</Button></Link>
              <Link to="/personal/forecast"><Button variant="outline" size="sm">Previsão de Fluxo</Button></Link>
              <Link to="/personal/summary"><Button variant="outline" size="sm">Resumo Executivo</Button></Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Resumo</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {kpis.vencidas_count > 0
                  ? `⚠️ ${kpis.vencidas_count} cobrança(s) vencida(s) totalizando ${fmt(kpis.vencidas)}.`
                  : kpis.saldo_mes >= 0
                    ? "Tudo certo! Seu saldo do mês está positivo."
                    : "Gastos superaram receitas. Revise seus lançamentos."}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
