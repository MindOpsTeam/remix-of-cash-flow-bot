import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Wallet, Info } from "lucide-react";
import { usePersonalForecast } from "@/hooks/usePersonalForecast";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
  BarChart, Bar, Legend,
} from "recharts";

function fmt(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

const monthLabels: Record<string, string> = {
  "01": "Jan", "02": "Fev", "03": "Mar", "04": "Abr", "05": "Mai", "06": "Jun",
  "07": "Jul", "08": "Ago", "09": "Set", "10": "Out", "11": "Nov", "12": "Dez",
};

export default function PersonalForecast() {
  const { forecastData, monthlyHistory, totals, isLoading } = usePersonalForecast();

  const hasData = totals.entradas > 0 || totals.saidas > 0;

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid gap-4 md:grid-cols-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}
          </div>
          <Skeleton className="h-[400px]" />
        </div>
      </AppLayout>
    );
  }

  const historyChartData = monthlyHistory.map((m) => {
    const [y, mo] = m.month.split("-");
    return {
      label: `${monthLabels[mo]}/${y.slice(2)}`,
      Receita: m.receita,
      Despesa: m.despesa,
    };
  });

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-[-0.02em]">Previsão de Fluxo</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Projeção dos próximos 30 dias baseada em lançamentos, cobranças e recorrências
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Previsto a receber (30d)</CardTitle>
              <TrendingUp className="h-4 w-4 text-revenue" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono text-revenue">{fmt(totals.entradas)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Previsto a pagar (30d)</CardTitle>
              <TrendingDown className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono text-destructive">{fmt(totals.saidas)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Saldo projetado</CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold font-mono ${totals.saldo >= 0 ? "text-revenue" : "text-destructive"}`}>
                {fmt(totals.saldo)}
              </div>
            </CardContent>
          </Card>
        </div>

        {!hasData && (
          <Card className="border-dashed">
            <CardContent className="flex items-center gap-3 py-6">
              <Info className="h-5 w-5 text-muted-foreground shrink-0" />
              <p className="text-sm text-muted-foreground">
                Nenhum lançamento futuro encontrado. Adicione transações, contas a pagar ou configure recorrências para ver sua projeção.
              </p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Projeção 30 dias</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <AreaChart data={forecastData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorEntradas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--revenue))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--revenue))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorSaidas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} className="text-muted-foreground" />
                <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                  formatter={(v: number, name: string) => [fmt(v), name === "entradas" ? "Entradas" : name === "saidas" ? "Saídas" : "Saldo"]}
                />
                <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
                <Area type="monotone" dataKey="entradas" stroke="hsl(var(--revenue))" fill="url(#colorEntradas)" strokeWidth={2} />
                <Area type="monotone" dataKey="saidas" stroke="hsl(var(--destructive))" fill="url(#colorSaidas)" strokeWidth={2} />
                <Area type="monotone" dataKey="saldo" stroke="hsl(var(--primary))" fill="none" strokeWidth={2} strokeDasharray="5 5" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {historyChartData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Histórico (últimos 3 meses)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={historyChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} className="text-muted-foreground" />
                  <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                    formatter={(v: number) => [fmt(v)]}
                  />
                  <Legend />
                  <Bar dataKey="Receita" fill="hsl(var(--revenue))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Despesa" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
