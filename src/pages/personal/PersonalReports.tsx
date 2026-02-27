import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from "recharts";
import { startOfMonth, endOfMonth, subMonths, format } from "date-fns";

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "#8884d8",
  "#ffc658",
  "#ff7300",
];

function fmt(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

interface CategoryItem {
  name: string;
  value: number;
  fill: string;
}

interface MonthItem {
  month: string;
  receita: number;
  despesa: number;
}

export default function PersonalReports() {
  const { user } = useAuth();
  const [categoryData, setCategoryData] = useState<CategoryItem[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthItem[]>([]);
  const [totalReceita, setTotalReceita] = useState(0);
  const [totalDespesa, setTotalDespesa] = useState(0);

  const loadData = useCallback(async () => {
    if (!user) return;

    const now = new Date();
    const start = format(startOfMonth(now), "yyyy-MM-dd");
    const end = format(endOfMonth(now), "yyyy-MM-dd");
    const sixMonthsAgo = format(startOfMonth(subMonths(now, 5)), "yyyy-MM-dd");

    const [{ data: currentTx }, { data: monthlyTx }] = await Promise.all([
      supabase
        .from("personal_transactions")
        .select("amount, type, personal_categories(name)")
        .eq("user_id", user.id)
        .gte("date", start)
        .lte("date", end),
      supabase
        .from("personal_transactions")
        .select("date, amount, type")
        .eq("user_id", user.id)
        .gte("date", sixMonthsAgo)
        .lte("date", end),
    ]);

    if (!currentTx) return;

    // Category pie chart (expenses)
    const catMap = new Map<string, number>();
    let rec = 0;
    let desp = 0;
    currentTx.forEach((t: any) => {
      if (t.type === "despesa") {
        const name = t.personal_categories?.name || "Sem categoria";
        catMap.set(name, (catMap.get(name) || 0) + Number(t.amount));
        desp += Number(t.amount);
      } else {
        rec += Number(t.amount);
      }
    });
    setTotalReceita(rec);
    setTotalDespesa(desp);

    const cats: CategoryItem[] = Array.from(catMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, value], i) => ({
        name,
        value,
        fill: COLORS[i % COLORS.length],
      }));
    setCategoryData(cats);

    // Monthly trend (6 months)
    const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    const monthMap: Record<string, { receita: number; despesa: number }> = {};
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(now, i);
      const key = format(d, "yyyy-MM");
      monthMap[key] = { receita: 0, despesa: 0 };
    }
    (monthlyTx || []).forEach((t: any) => {
      const key = t.date?.slice(0, 7);
      if (monthMap[key]) {
        if (t.type === "receita") monthMap[key].receita += Number(t.amount);
        else monthMap[key].despesa += Number(t.amount);
      }
    });
    const monthly: MonthItem[] = Object.entries(monthMap).map(([key]) => {
      const [y, m] = key.split("-");
      return {
        month: `${monthNames[parseInt(m) - 1]}/${y.slice(2)}`,
        ...monthMap[key],
      };
    });
    setMonthlyData(monthly);
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("personal-reports")
      .on("postgres_changes", { event: "*", schema: "public", table: "personal_transactions" }, () => loadData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, loadData]);

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-[-0.02em]">Relatórios Pessoais</h1>
          <p className="text-sm text-muted-foreground mt-1">Análises das suas finanças pessoais</p>
        </div>

        {/* Summary KPIs */}
        <div className="grid gap-4 md:grid-cols-3">
          <div className="bg-card border border-border rounded-lg p-4">
            <p className="text-xs text-muted-foreground">Receitas (mês)</p>
            <p className="text-xl font-bold font-mono text-revenue">{fmt(totalReceita)}</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <p className="text-xs text-muted-foreground">Despesas (mês)</p>
            <p className="text-xl font-bold font-mono text-destructive">{fmt(totalDespesa)}</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <p className="text-xs text-muted-foreground">Saldo (mês)</p>
            <p className={`text-xl font-bold font-mono ${totalReceita - totalDespesa >= 0 ? "text-revenue" : "text-destructive"}`}>
              {fmt(totalReceita - totalDespesa)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Category pie chart */}
          <div className="bg-card border border-border rounded-lg p-5">
            <h2 className="text-sm font-semibold text-foreground mb-4">Despesas por Categoria</h2>
            {categoryData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">Nenhuma despesa neste mês.</p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={categoryData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      strokeWidth={2}
                      stroke="hsl(var(--card))"
                    >
                      {categoryData.map((c, i) => (
                        <Cell key={i} fill={c.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                      formatter={(value: number) => fmt(value)}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {categoryData.map((c, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: c.fill }} />
                        <span className="text-muted-foreground truncate">{c.name}</span>
                      </div>
                      <span className="font-mono text-foreground shrink-0">{fmt(c.value)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Monthly trend */}
          <div className="bg-card border border-border rounded-lg p-5">
            <h2 className="text-sm font-semibold text-foreground mb-4">Receitas vs Despesas (6 meses)</h2>
            {monthlyData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">Sem dados no período.</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthlyData} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="month"
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(v: number, name: string) => [fmt(v), name === "receita" ? "Receita" : "Despesa"]}
                  />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    formatter={(v) => (v === "receita" ? "Receita" : "Despesa")}
                  />
                  <Bar dataKey="receita" name="receita" fill="hsl(var(--revenue))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="despesa" name="despesa" fill="hsl(var(--expense))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
