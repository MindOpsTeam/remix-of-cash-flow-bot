import { edgeAuthHeaders, edgeUrl } from "@/lib/edge";
import { KPICard } from "@/components/KPICard";
import { MarkdownMessage } from "@/components/cfo/MarkdownMessage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CFODashboardData } from "@/hooks/useCFODashboard";
import { formatCurrency } from "@/lib/utils";
import { DollarSign, TrendingDown, TrendingUp, Percent, Loader2, Lightbulb } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { useEffect, useState } from "react";
import { useCompany } from "@/hooks/useCompany";

interface CFODashboardProps {
  data: CFODashboardData;
}

export function CFODashboard({ data }: CFODashboardProps) {
  const { company } = useCompany();
  const [tip, setTip] = useState("");
  const [tipLoading, setTipLoading] = useState(false);

  useEffect(() => {
    if (!company || data.loading) return;
    const fetchTip = async () => {
      setTipLoading(true);
      try {
        const resp = await fetch(edgeUrl("cfo-digital"), {
          method: "POST",
          headers: await edgeAuthHeaders(),
          body: JSON.stringify({
            question: "Dê 3 insights rápidos e acionáveis sobre a saúde financeira da empresa em no máximo 3 frases curtas. Sem introdução.",
            company_id: company.id,
          }),
        });
        if (!resp.ok || !resp.body) return;
        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let content = "";
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let idx: number;
          while ((idx = buffer.indexOf("\n")) !== -1) {
            let line = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 1);
            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (!line.startsWith("data: ")) continue;
            const json = line.slice(6).trim();
            if (json === "[DONE]") break;
            try {
              const parsed = JSON.parse(json);
              const c = parsed.choices?.[0]?.delta?.content;
              if (c) { content += c; setTip(content); }
            } catch { break; }
          }
        }
      } catch (e) {
        console.error("CFO tip error:", e);
      } finally {
        setTipLoading(false);
      }
    };
    fetchTip();
  }, [company, data.loading]);

  if (data.loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const { kpis } = data;

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Receita" value={kpis.revenue} change={kpis.revenueChange} icon={<DollarSign className="h-4 w-4" />} />
        <KPICard label="Despesas" value={kpis.expenses} change={kpis.expensesChange} icon={<TrendingDown className="h-4 w-4" />} />
        <KPICard label="Resultado" value={kpis.profit} change={kpis.profitChange} icon={<TrendingUp className="h-4 w-4" />} />
        <KPICard label="Margem" value={kpis.margin} change={kpis.marginChange} icon={<Percent className="h-4 w-4" />} format="percentage" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Receitas vs Despesas (6 meses)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Legend />
                <Bar dataKey="receitas" name="Receitas" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="despesas" name="Despesas" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Cost Centers */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Centros de Custo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.costCenters.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhuma despesa com centro de custo neste mês.</p>
            ) : (
              data.costCenters.map((cc) => (
                <div key={cc.name} className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{cc.name}</p>
                    <div className="w-full bg-secondary rounded-full h-1.5 mt-1">
                      <div className="bg-primary rounded-full h-1.5" style={{ width: `${Math.min(cc.percentage, 100)}%` }} />
                    </div>
                  </div>
                  <div className="text-right ml-3 shrink-0">
                    <p className="text-sm font-semibold">{formatCurrency(cc.amount)}</p>
                    <p className="text-xs text-muted-foreground">{cc.percentage.toFixed(1)}%</p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* CFO Tip */}
      <Card className="border-primary/20">
        <CardContent className="p-4 flex gap-3">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
            <Lightbulb className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-primary mb-1">Dica do CFO</p>
            {tipLoading && !tip ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Analisando...
              </div>
            ) : tip ? (
              <MarkdownMessage content={tip} />
            ) : (
              <p className="text-sm text-foreground">Adicione transações para receber insights personalizados.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
