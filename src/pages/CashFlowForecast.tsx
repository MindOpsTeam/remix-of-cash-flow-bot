import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useCompany } from "@/hooks/useCompany";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency } from "@/lib/utils";
import { useState, useEffect, useCallback } from "react";
import { Loader2, TrendingUp, AlertTriangle, Shield, RefreshCw } from "lucide-react";
import {
  Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ComposedChart,
} from "recharts";

interface ForecastMonth {
  month: string;
  projected_revenue: number;
  projected_expense: number;
  confidence: string;
}

interface HistoryMonth {
  month: string;
  revenue: number;
  expense: number;
  projected: boolean;
}

export default function CashFlowForecast() {
  const { company } = useCompany();
  const { session } = useAuth();
  const [loading, setLoading] = useState(false);
  const [forecast, setForecast] = useState<ForecastMonth[]>([]);
  const [history, setHistory] = useState<HistoryMonth[]>([]);
  const [insights, setInsights] = useState<string[]>([]);
  const [riskLevel, setRiskLevel] = useState("");
  const [riskExplanation, setRiskExplanation] = useState("");
  const [error, setError] = useState("");

  const loadForecast = useCallback(async () => {
    if (!company) return;
    setLoading(true);
    setError("");

    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-forecast`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ company_id: company.id }),
      });

      if (!res.ok) throw new Error("Erro ao gerar previsão");

      const data = await res.json();
      setForecast(data.forecast || []);
      setHistory(data.history || []);
      setInsights(data.insights || []);
      setRiskLevel(data.risk_level || "");
      setRiskExplanation(data.risk_explanation || "");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [company]);

  useEffect(() => { loadForecast(); }, [loadForecast]);

  // Combine history + forecast for chart
  const chartData = [
    ...history.map(h => ({
      month: h.month,
      receitas: h.revenue,
      despesas: h.expense,
      receitas_proj: null as number | null,
      despesas_proj: null as number | null,
    })),
    ...forecast.map(f => ({
      month: f.month,
      receitas: null as number | null,
      despesas: null as number | null,
      receitas_proj: f.projected_revenue,
      despesas_proj: f.projected_expense,
    })),
  ];

  const riskColor = riskLevel === "low" ? "text-revenue" : riskLevel === "high" ? "text-expense" : "text-warning";
  const riskIcon = riskLevel === "low" ? <Shield className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />;
  const riskLabel = riskLevel === "low" ? "Baixo" : riskLevel === "high" ? "Alto" : "Médio";

  // Totals for projected period
  const totalProjRevenue = forecast.reduce((s, f) => s + f.projected_revenue, 0);
  const totalProjExpense = forecast.reduce((s, f) => s + f.projected_expense, 0);
  const totalProjBalance = totalProjRevenue - totalProjExpense;

  return (
    <AppLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-[-0.02em]">Previsão de Fluxo de Caixa</h1>
          <p className="text-sm text-muted-foreground mt-1">Projeção inteligente dos próximos 3 meses com IA</p>
        </div>
        <Button onClick={loadForecast} disabled={loading} variant="outline" size="sm">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-3 text-muted-foreground">Analisando dados e gerando previsão...</span>
        </div>
      ) : error ? (
        <Card>
          <CardContent className="p-6 text-center">
            <AlertTriangle className="h-8 w-8 text-expense mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button onClick={loadForecast} className="mt-4" size="sm">Tentar novamente</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground mb-1">Receita Projetada (3m)</p>
                <p className="text-2xl font-bold text-revenue">{formatCurrency(totalProjRevenue)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground mb-1">Despesa Projetada (3m)</p>
                <p className="text-2xl font-bold text-expense">{formatCurrency(totalProjExpense)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground mb-1">Saldo Projetado (3m)</p>
                <p className={`text-2xl font-bold ${totalProjBalance >= 0 ? "text-revenue" : "text-expense"}`}>{formatCurrency(totalProjBalance)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm text-muted-foreground">Nível de Risco</p>
                </div>
                <div className={`flex items-center gap-2 ${riskColor}`}>
                  {riskIcon}
                  <p className="text-2xl font-bold">{riskLabel}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Histórico + Projeção</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <ComposedChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  <Legend />
                  <Bar dataKey="receitas" name="Receitas (Real)" fill="hsl(var(--revenue))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="despesas" name="Despesas (Real)" fill="hsl(var(--expense))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="receitas_proj" name="Receitas (Projeção)" fill="hsl(var(--revenue) / 0.5)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="despesas_proj" name="Despesas (Projeção)" fill="hsl(var(--expense) / 0.5)" radius={[4, 4, 0, 0]} />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Forecast Details */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Projeção Mensal</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {forecast.map((f, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-background/50">
                    <div>
                      <p className="text-sm font-semibold">{f.month}</p>
                      <p className="text-xs text-muted-foreground">Confiança: {f.confidence === "high" ? "Alta" : f.confidence === "medium" ? "Média" : "Baixa"}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-revenue">+{formatCurrency(f.projected_revenue)}</p>
                      <p className="text-sm text-expense">-{formatCurrency(f.projected_expense)}</p>
                      <p className={`text-xs font-semibold ${f.projected_revenue - f.projected_expense >= 0 ? "text-revenue" : "text-expense"}`}>
                        = {formatCurrency(f.projected_revenue - f.projected_expense)}
                      </p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Insights + Risk */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" /> Insights da IA
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {insights.map((insight, i) => (
                  <div key={i} className="flex gap-3 p-3 rounded-lg bg-background/50">
                    <span className="text-primary font-bold text-sm shrink-0">{i + 1}.</span>
                    <p className="text-sm text-foreground">{insight}</p>
                  </div>
                ))}
                {riskExplanation && (
                  <div className={`p-3 rounded-lg border ${riskLevel === "high" ? "border-expense/30 bg-expense/5" : riskLevel === "low" ? "border-revenue/30 bg-revenue/5" : "border-warning/30 bg-warning/[0.08]"}`}>
                    <p className="text-xs font-semibold mb-1 flex items-center gap-1">
                      {riskIcon} Análise de Risco
                    </p>
                    <p className="text-sm text-foreground">{riskExplanation}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
