import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCompany } from "@/hooks/useCompany";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency } from "@/lib/utils";
import { useState, useEffect, useCallback } from "react";
import { Loader2, TrendingUp, AlertTriangle, Shield, RefreshCw, Target, FileSignature, Repeat } from "lucide-react";
import {
  Area, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ComposedChart,
} from "recharts";

interface Faixa {
  p10: number;
  p90: number;
}

interface ForecastMonth {
  month: string;
  projected_revenue: number;
  projected_expense: number;
  contratado_entrada: number;
  contratado_saida: number;
  confidence: string;
  saldo_projetado: number;
  origem_receita?: "contratado" | "modelo" | "recompra";
  faixa_receita?: Faixa;
  faixa_despesa?: Faixa;
  esperado_recompra?: number;
}

interface HistoryMonth {
  month: string;
  revenue: number;
  expense: number;
  projected: boolean;
}

interface Precisao {
  wape: number | null;
  vies: number | null;
  observacoes: number;
  frase: string;
}

/** Como a projeção foi calculada. O usuário tem direito de saber. */
const MOTORES: Record<string, string> = {
  timesfm: "Modelo de séries temporais (TimesFM)",
  sazonal: "Média ponderada com ajuste sazonal",
  estatistico: "Média ponderada do histórico",
};

const ORIGEM: Record<string, { rotulo: string; icone: typeof FileSignature }> = {
  contratado: { rotulo: "Já contratado", icone: FileSignature },
  modelo: { rotulo: "Estimado pelo histórico", icone: TrendingUp },
  recompra: { rotulo: "Esperado por recompra", icone: Repeat },
};

export default function CashFlowForecast() {
  const { company } = useCompany();
  const { session } = useAuth();
  const [loading, setLoading] = useState(false);
  const [forecast, setForecast] = useState<ForecastMonth[]>([]);
  const [history, setHistory] = useState<HistoryMonth[]>([]);
  const [insights, setInsights] = useState<string[]>([]);
  const [riskLevel, setRiskLevel] = useState("");
  const [riskExplanation, setRiskExplanation] = useState("");
  const [precisao, setPrecisao] = useState<Precisao | null>(null);
  const [motor, setMotor] = useState("");
  const [error, setError] = useState("");

  // Dependemos do VALOR (id, token), nunca da identidade do objeto: um hook que
  // devolve um objeto novo a cada render faria o efeito disparar em loop e a
  // tela ficaria carregando para sempre.
  const companyId = company?.id;
  const accessToken = session?.access_token;

  const loadForecast = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError("");

    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-forecast`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ company_id: companyId }),
      });

      if (!res.ok) throw new Error("Erro ao gerar previsão");

      const data = await res.json();
      setForecast(data.forecast || []);
      setHistory(data.history || []);
      setInsights(data.insights || []);
      setRiskLevel(data.risk_level || "");
      setRiskExplanation(data.risk_explanation || "");
      setPrecisao(data.precisao || null);
      setMotor(data.motor || "");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [companyId, accessToken]);

  useEffect(() => { loadForecast(); }, [loadForecast]);

  // Histórico e projeção no mesmo eixo. A faixa só existe do lado projetado:
  // no passado não há incerteza, há fato.
  const chartData = [
    ...history.map(h => ({
      month: h.month,
      receitas: h.revenue,
      despesas: h.expense,
      receitas_proj: null as number | null,
      despesas_proj: null as number | null,
      faixa: null as [number, number] | null,
    })),
    ...forecast.map(f => ({
      month: f.month,
      receitas: null as number | null,
      despesas: null as number | null,
      receitas_proj: f.projected_revenue,
      despesas_proj: f.projected_expense,
      faixa: f.faixa_receita ? ([f.faixa_receita.p10, f.faixa_receita.p90] as [number, number]) : null,
    })),
  ];

  const temFaixa = forecast.some(f => f.faixa_receita);

  const riskColor = riskLevel === "low" ? "text-revenue" : riskLevel === "high" ? "text-expense" : "text-warning";
  const riskIcon = riskLevel === "low" ? <Shield className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />;
  const riskLabel = riskLevel === "low" ? "Baixo" : riskLevel === "high" ? "Alto" : "Médio";

  const totalProjRevenue = forecast.reduce((s, f) => s + f.projected_revenue, 0);
  const totalProjExpense = forecast.reduce((s, f) => s + f.projected_expense, 0);
  const totalProjBalance = totalProjRevenue - totalProjExpense;
  const totalContratado = forecast.reduce((s, f) => s + (f.contratado_entrada || 0), 0);
  const parteContratada = totalProjRevenue > 0 ? Math.round((totalContratado / totalProjRevenue) * 100) : 0;

  return (
    <AppLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-[-0.02em]">Previsão de Fluxo de Caixa</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Projeção dos próximos 3 meses{motor ? ` · ${MOTORES[motor] ?? motor}` : ""}
          </p>
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
          {/* Precisão medida: o único número que transforma projeção em ferramenta
              de decisão. Sem meses fechados, diz que ainda está medindo. */}
          {precisao && (
            <div className="flex items-start gap-3 rounded-lg border border-border bg-card/60 px-4 py-3">
              <Target className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-sm text-foreground">{precisao.frase}</p>
                {precisao.wape !== null && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Medido comparando o que o sistema previu antes do mês começar com o que de fato aconteceu,
                    nesta empresa.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground mb-1">Receita Projetada (3m)</p>
                <p className="text-2xl font-bold text-revenue">{formatCurrency(totalProjRevenue)}</p>
                {totalContratado > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {parteContratada}% já contratado ({formatCurrency(totalContratado)})
                  </p>
                )}
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
                  <Tooltip
                    formatter={(v: number | [number, number]) =>
                      Array.isArray(v) ? `${formatCurrency(v[0])} a ${formatCurrency(v[1])}` : formatCurrency(v)
                    }
                    contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                  />
                  <Legend />
                  {temFaixa && (
                    <Area
                      dataKey="faixa"
                      name="Faixa provável da receita (80%)"
                      stroke="none"
                      fill="hsl(var(--revenue) / 0.18)"
                      connectNulls={false}
                      isAnimationActive={false}
                    />
                  )}
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
                {forecast.map((f, i) => {
                  const origem = ORIGEM[f.origem_receita ?? "modelo"];
                  const IconeOrigem = origem.icone;
                  const cobertura = f.projected_revenue > 0
                    ? Math.round((f.contratado_entrada / f.projected_revenue) * 100)
                    : 0;
                  return (
                    <div key={i} className="p-3 rounded-lg bg-background/50 space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold">{f.month}</p>
                          <p className="text-xs text-muted-foreground">
                            Confiança: {f.confidence === "high" ? "Alta" : f.confidence === "medium" ? "Média" : "Baixa"}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm text-revenue">+{formatCurrency(f.projected_revenue)}</p>
                          <p className="text-sm text-expense">-{formatCurrency(f.projected_expense)}</p>
                          <p className={`text-xs font-semibold ${f.projected_revenue - f.projected_expense >= 0 ? "text-revenue" : "text-expense"}`}>
                            = {formatCurrency(f.projected_revenue - f.projected_expense)}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="text-[11px] font-normal gap-1">
                          <IconeOrigem className="h-3 w-3" />
                          {origem.rotulo}
                        </Badge>
                        {f.contratado_entrada > 0 && (
                          <span className="text-[11px] text-muted-foreground">
                            {formatCurrency(f.contratado_entrada)} com vencimento já registrado ({cobertura}%)
                          </span>
                        )}
                      </div>

                      {f.faixa_receita && (
                        <p className="text-[11px] text-muted-foreground">
                          Cenário provável da receita: entre {formatCurrency(f.faixa_receita.p10)} e{" "}
                          {formatCurrency(f.faixa_receita.p90)}.
                        </p>
                      )}
                      {f.esperado_recompra !== undefined && f.esperado_recompra > 0 && (
                        <p className="text-[11px] text-muted-foreground">
                          Clientes com padrão de recompra devem trazer cerca de {formatCurrency(f.esperado_recompra)}.
                        </p>
                      )}
                    </div>
                  );
                })}
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
