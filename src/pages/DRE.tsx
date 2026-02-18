import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { formatCurrency } from "@/lib/mock-data";
import { exportDREtoPDF } from "@/lib/pdf-export";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DRELine {
  label: string;
  value: number;
  level: number;
  isTotal?: boolean;
}

export default function DRE() {
  const { company } = useCompany();
  const [lines, setLines] = useState<DRELine[]>([]);
  const [monthlyData, setMonthlyData] = useState<{ month: string; receitas: number; despesas: number; lucro: number }[]>([]);

  const buildDRE = useCallback(async () => {
    if (!company) return;

    // Get current month range
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];

    // Fetch transactions with their chart_of_accounts info
    const { data: transactions } = await supabase
      .from("transactions")
      .select("amount, type, account_id, date, chart_of_accounts(name, code)")
      .eq("company_id", company.id)
      .eq("status", "confirmed")
      .gte("date", startOfMonth)
      .lte("date", endOfMonth);

    if (!transactions) return;

    // Group by account
    const accountTotals: Record<string, { name: string; code: string; amount: number; type: string }> = {};

    for (const t of transactions) {
      const acct = t.chart_of_accounts as any;
      const key = t.account_id || "unclassified";
      if (!accountTotals[key]) {
        accountTotals[key] = {
          name: acct?.name || "Sem classificação",
          code: acct?.code || "0",
          amount: 0,
          type: t.type,
        };
      }
      accountTotals[key].amount += Number(t.amount);
    }

    const revenues = Object.values(accountTotals).filter((a) => a.type === "revenue").sort((a, b) => a.code.localeCompare(b.code));
    const costs = Object.values(accountTotals).filter((a) => a.type === "expense" && a.code.startsWith("4")).sort((a, b) => a.code.localeCompare(b.code));
    const expenses = Object.values(accountTotals).filter((a) => a.type === "expense" && !a.code.startsWith("4")).sort((a, b) => a.code.localeCompare(b.code));

    const totalRevenue = revenues.reduce((s, r) => s + r.amount, 0);
    const totalCosts = costs.reduce((s, c) => s + c.amount, 0);
    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
    const grossProfit = totalRevenue - totalCosts;
    const netProfit = grossProfit - totalExpenses;

    const dreLines: DRELine[] = [
      { label: "Receita Bruta", value: totalRevenue, level: 0, isTotal: true },
      ...revenues.map((r) => ({ label: r.name, value: r.amount, level: 1 })),
      { label: "(-) Custos", value: -totalCosts, level: 0 },
      ...costs.map((c) => ({ label: c.name, value: -c.amount, level: 1 })),
      { label: "Lucro Bruto", value: grossProfit, level: 0, isTotal: true },
      { label: "(-) Despesas Operacionais", value: -totalExpenses, level: 0 },
      ...expenses.map((e) => ({ label: e.name, value: -e.amount, level: 1 })),
      { label: "Lucro Líquido", value: netProfit, level: 0, isTotal: true },
    ];

    setLines(dreLines);

    // Build last 6 months chart
    const chartData: { month: string; receitas: number; despesas: number; lucro: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mStart = d.toISOString().split("T")[0];
      const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split("T")[0];

      const { data: mTx } = await supabase
        .from("transactions")
        .select("amount, type")
        .eq("company_id", company.id)
        .eq("status", "confirmed")
        .gte("date", mStart)
        .lte("date", mEnd);

      const rec = (mTx || []).filter((t) => t.type === "revenue").reduce((s, t) => s + Number(t.amount), 0);
      const desp = (mTx || []).filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);

      chartData.push({
        month: d.toLocaleDateString("pt-BR", { month: "short" }),
        receitas: rec,
        despesas: desp,
        lucro: rec - desp,
      });
    }
    setMonthlyData(chartData);
  }, [company]);

  useEffect(() => { buildDRE(); }, [buildDRE]);

  const totalRevenue = lines.find((l) => l.label === "Receita Bruta")?.value || 0;
  const grossProfit = lines.find((l) => l.label === "Lucro Bruto")?.value || 0;
  const netProfit = lines.find((l) => l.label === "Lucro Líquido")?.value || 0;
  const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
  const netMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  return (
    <AppLayout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Demonstração do Resultado</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" })} — Baseado nas contas contábeis
          </p>
        </div>
        <Button
          variant="outline"
          className="gap-2"
          disabled={lines.length === 0}
          onClick={() => {
            const period = new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
            exportDREtoPDF(lines, company?.name || "Empresa", period);
          }}
        >
          <FileDown className="h-4 w-4" />Exportar PDF
        </Button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 glass-card p-5 overflow-x-auto">
          {lines.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground text-sm">Nenhum lançamento confirmado neste mês.</p>
              <p className="text-muted-foreground text-xs mt-1">Crie lançamentos na tela de Lançamentos para gerar a DRE.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 text-muted-foreground font-medium">Conta</th>
                  <th className="text-right py-3 text-muted-foreground font-medium">Valor</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, i) => (
                  <tr key={i} className={`border-b border-border/50 ${line.isTotal ? "bg-accent/30" : ""}`}>
                    <td className={`py-2.5 ${line.level === 1 ? "pl-6 text-muted-foreground" : ""} ${line.isTotal ? "font-semibold text-foreground" : ""}`}>
                      {line.label}
                    </td>
                    <td className={`text-right py-2.5 tabular-nums ${line.isTotal ? "font-semibold" : ""} ${line.value >= 0 ? "text-revenue" : "text-expense"}`}>
                      {formatCurrency(line.value)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="glass-card p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Lucro Mensal</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                formatter={(value: number) => [formatCurrency(value), "Lucro"]}
              />
              <Bar dataKey="lucro" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>

          <div className="mt-6 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Margem Bruta</span>
              <span className="font-semibold text-foreground">{grossMargin.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Margem Líquida</span>
              <span className="font-semibold text-foreground">{netMargin.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Lucro Líquido</span>
              <span className={`font-semibold ${netProfit >= 0 ? "text-revenue" : "text-expense"}`}>{formatCurrency(netProfit)}</span>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
