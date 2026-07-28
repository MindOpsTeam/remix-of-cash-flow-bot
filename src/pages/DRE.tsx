import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { formatCurrency } from "@/lib/utils";
import { exportDREtoPDF } from "@/lib/pdf-export";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { FileDown, ChevronLeft, ChevronRight } from "lucide-react";
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

  // Period selector
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());

  const monthLabel = new Date(selectedYear, selectedMonth).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  const goToPrevMonth = () => {
    if (selectedMonth === 0) { setSelectedMonth(11); setSelectedYear((y) => y - 1); }
    else setSelectedMonth((m) => m - 1);
  };

  const goToNextMonth = () => {
    if (selectedMonth === 11) { setSelectedMonth(0); setSelectedYear((y) => y + 1); }
    else setSelectedMonth((m) => m + 1);
  };

  const goToCurrentMonth = () => {
    setSelectedYear(new Date().getFullYear());
    setSelectedMonth(new Date().getMonth());
  };

  const isCurrentMonth = selectedYear === new Date().getFullYear() && selectedMonth === new Date().getMonth();

  const buildDRE = useCallback(async () => {
    if (!company) return;

    const startOfMonth = new Date(selectedYear, selectedMonth, 1).toISOString().split("T")[0];
    const endOfMonth = new Date(selectedYear, selectedMonth + 1, 0).toISOString().split("T")[0];

    const { data: allAccounts } = await supabase
      .from("chart_of_accounts")
      .select("id, name, code, type")
      .eq("company_id", company.id)
      .order("code");

    const { data: transactions } = await supabase
      .from("transactions")
      .select("amount, type, account_id, date, chart_of_accounts(name, code)")
      .eq("company_id", company.id)
      .in("status", ["confirmed", "reconciled"])
      .gte("date", startOfMonth)
      .lte("date", endOfMonth);

    if (!allAccounts) return;

    const txTotals: Record<string, number> = {};
    for (const t of (transactions || [])) {
      const key = t.account_id || "unclassified";
      txTotals[key] = (txTotals[key] || 0) + Number(t.amount);
    }

    const revenues = allAccounts.filter((a) => a.type === "revenue").map((a) => ({
      name: a.code ? `${a.code} – ${a.name}` : a.name, code: a.code || "0", amount: txTotals[a.id] || 0,
    }));
    const costs = allAccounts.filter((a) => a.type === "expense" && (a.code || "").startsWith("4")).map((a) => ({
      name: a.code ? `${a.code} – ${a.name}` : a.name, code: a.code || "0", amount: txTotals[a.id] || 0,
    }));
    const expenses = allAccounts.filter((a) => a.type === "expense" && !(a.code || "").startsWith("4")).map((a) => ({
      name: a.code ? `${a.code} – ${a.name}` : a.name, code: a.code || "0", amount: txTotals[a.id] || 0,
    }));

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

    // Build last 6 months chart with a single query
    const chartStart = new Date(selectedYear, selectedMonth - 5, 1).toISOString().split("T")[0];
    const chartEnd = endOfMonth;

    const { data: chartTx } = await supabase
      .from("transactions")
      .select("amount, type, date")
      .eq("company_id", company.id)
      .in("status", ["confirmed", "reconciled"])
      .gte("date", chartStart)
      .lte("date", chartEnd);

    const monthBuckets: Record<string, { receitas: number; despesas: number }> = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(selectedYear, selectedMonth - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthBuckets[key] = { receitas: 0, despesas: 0 };
    }

    for (const t of (chartTx || [])) {
      const key = t.date.substring(0, 7); // "YYYY-MM"
      if (monthBuckets[key]) {
        if (t.type === "revenue") monthBuckets[key].receitas += Number(t.amount);
        else monthBuckets[key].despesas += Number(t.amount);
      }
    }

    const chartData = Object.entries(monthBuckets).map(([key, vals]) => {
      const [y, m] = key.split("-").map(Number);
      return {
        month: new Date(y, m - 1).toLocaleDateString("pt-BR", { month: "short" }),
        receitas: vals.receitas,
        despesas: vals.despesas,
        lucro: vals.receitas - vals.despesas,
      };
    });
    setMonthlyData(chartData);
  }, [company, selectedYear, selectedMonth]);

  useEffect(() => { buildDRE(); }, [buildDRE]);

  useEffect(() => {
    if (!company) return;
    const channel = supabase
      .channel('dre-transactions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions', filter: `company_id=eq.${company.id}` }, () => {
        buildDRE();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [company, buildDRE]);

  const totalRevenue = lines.find((l) => l.label === "Receita Bruta")?.value || 0;
  const grossProfit = lines.find((l) => l.label === "Lucro Bruto")?.value || 0;
  const netProfit = lines.find((l) => l.label === "Lucro Líquido")?.value || 0;
  const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
  const netMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  return (
    <AppLayout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-[-0.02em]">Demonstração do Resultado</h1>
          <p className="text-sm text-muted-foreground mt-1 capitalize">
            {monthLabel} — Baseado nas contas contábeis
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Period selector */}
          <div className="flex items-center gap-1 bg-card border border-border rounded-lg px-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goToPrevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <button
              className="text-sm font-medium px-3 py-1.5 capitalize hover:text-primary transition-colors"
              onClick={goToCurrentMonth}
              title="Ir para mês atual"
            >
              {new Date(selectedYear, selectedMonth).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" })}
            </button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goToNextMonth} disabled={isCurrentMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Button
            variant="outline"
            className="gap-2"
            disabled={lines.length === 0}
            onClick={() => {
              exportDREtoPDF(lines, company?.name || "Empresa", monthLabel);
            }}
          >
            <FileDown className="h-4 w-4" />Exportar PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-card border border-border rounded-lg p-5 overflow-x-auto">
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

        <div className="bg-card border border-border rounded-lg p-5">
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