import { AppLayout } from "@/components/AppLayout";
import { KPICard } from "@/components/KPICard";
import { FinancialScore } from "@/components/FinancialScore";
import { TransactionRow } from "@/components/TransactionRow";
import { formatCurrency } from "@/lib/mock-data";
import { DollarSign, TrendingUp, TrendingDown, PiggyBank, Loader2, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { useCompany } from "@/hooks/useCompany";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState, useCallback, memo } from "react";

interface MonthData {
  month: string;
  receitas: number;
  despesas: number;
}

interface TooltipPayloadItem {
  name: string;
  value: number;
  color: string;
}

const CustomTooltip = memo(({ active, payload, label }: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}) => {
  if (!active || !payload) return null;
  return (
    <div className="bg-card border border-border rounded-md p-3 text-xs">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {formatCurrency(p.value)}
        </p>
      ))}
    </div>
  );
});

export default function Dashboard() {
  const { company } = useCompany();
  const [loading, setLoading] = useState(true);
  const [revenue, setRevenue] = useState(0);
  const [expense, setExpense] = useState(0);
  const [prevRevenue, setPrevRevenue] = useState(0);
  const [prevExpense, setPrevExpense] = useState(0);
  const [chartData, setChartData] = useState<MonthData[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);

  const loadData = useCallback(async () => {
    if (!company) return;
    setLoading(true);

    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth();
    const curStart = new Date(curYear, curMonth, 1).toISOString().split("T")[0];
    const curEnd = new Date(curYear, curMonth + 1, 0).toISOString().split("T")[0];
    const prevStart = new Date(curYear, curMonth - 1, 1).toISOString().split("T")[0];
    const prevEnd = new Date(curYear, curMonth, 0).toISOString().split("T")[0];
    const sixMonthsAgo = new Date(curYear, curMonth - 5, 1).toISOString().split("T")[0];

    const [curRes, prevRes, chartRes, txRes] = await Promise.all([
      supabase.from("transactions").select("amount, type").eq("company_id", company.id).eq("status", "confirmed").gte("date", curStart).lte("date", curEnd),
      supabase.from("transactions").select("amount, type").eq("company_id", company.id).eq("status", "confirmed").gte("date", prevStart).lte("date", prevEnd),
      supabase.from("transactions").select("date, amount, type").eq("company_id", company.id).eq("status", "confirmed").gte("date", sixMonthsAgo).lte("date", curEnd),
      supabase.from("transactions").select("*, chart_of_accounts(name), cost_centers(name)").eq("company_id", company.id).order("created_at", { ascending: false }).limit(6),
    ]);

    const curRevenue = (curRes.data || []).filter(t => t.type === "revenue").reduce((s, t) => s + Number(t.amount), 0);
    const curExpense = (curRes.data || []).filter(t => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
    setRevenue(curRevenue);
    setExpense(curExpense);

    const pRevenue = (prevRes.data || []).filter(t => t.type === "revenue").reduce((s, t) => s + Number(t.amount), 0);
    const pExpense = (prevRes.data || []).filter(t => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
    setPrevRevenue(pRevenue);
    setPrevExpense(pExpense);

    const monthMap: Record<string, { receitas: number; despesas: number }> = {};
    const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(curYear, curMonth - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthMap[key] = { receitas: 0, despesas: 0 };
    }
    for (const t of chartRes.data || []) {
      const key = t.date.slice(0, 7);
      if (monthMap[key]) {
        if (t.type === "revenue") monthMap[key].receitas += Number(t.amount);
        else monthMap[key].despesas += Number(t.amount);
      }
    }
    const chart: MonthData[] = Object.entries(monthMap).map(([key, val]) => {
      const [y, m] = key.split("-");
      return { month: `${monthNames[parseInt(m) - 1]}/${y.slice(2)}`, ...val };
    });
    setChartData(chart);

    setRecentTransactions((txRes.data || []).map((t: any) => ({
      ...t,
      account_name: t.chart_of_accounts?.name || "-",
      cost_center_name: t.cost_centers?.name || "-",
    })));
    setLoading(false);
  }, [company]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (!company) return;
    const channel = supabase
      .channel('dashboard-transactions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions', filter: `company_id=eq.${company.id}` }, () => loadData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [company, loadData]);

  const profit = revenue - expense;
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
  const prevProfit = prevRevenue - prevExpense;
  const prevMargin = prevRevenue > 0 ? (prevProfit / prevRevenue) * 100 : 0;
  const pctChange = (cur: number, prev: number) => prev > 0 ? ((cur - prev) / prev) * 100 : cur > 0 ? 100 : 0;

  const kpis = [
    { label: "Receita Mensal", value: revenue, change: pctChange(revenue, prevRevenue), icon: <DollarSign className="h-4 w-4" />, delay: 0 },
    { label: "Despesas", value: expense, change: pctChange(expense, prevExpense), icon: <TrendingDown className="h-4 w-4" />, delay: 100 },
    { label: "Lucro Líquido", value: profit, change: pctChange(profit, prevProfit), icon: <TrendingUp className="h-4 w-4" />, delay: 200 },
    { label: "Margem Líquida", value: margin, change: margin - prevMargin, icon: <PiggyBank className="h-4 w-4" />, format: "percentage" as const, delay: 300 },
  ];

  const now = new Date();
  const monthLabel = now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  return (
    <AppLayout>
      <div className="mb-8 animate-fade-in">
        <h1 className="text-[28px] font-semibold text-foreground tracking-[-0.02em]">Dashboard Financeiro</h1>
        <p className="text-sm text-muted-foreground mt-1 capitalize">Visão geral de {monthLabel}</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
            {kpis.map((kpi) => (
              <KPICard key={kpi.label} {...kpi} />
            ))}
          </div>

          <div className="mb-6">
            <FinancialScore revenue={revenue} expense={expense} prevRevenue={prevRevenue} prevExpense={prevExpense} />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2 bg-card border border-border rounded-lg p-5 animate-slide-up" style={{ animationDelay: "400ms", animationFillMode: "backwards" }}>
              <h2 className="text-sm font-semibold text-foreground mb-4">Receitas vs Despesas</h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }} />
                  <Bar dataKey="receitas" name="Receitas" fill="hsl(var(--revenue))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="despesas" name="Despesas" fill="hsl(var(--expense))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-card border border-border rounded-lg p-5 animate-slide-up" style={{ animationDelay: "500ms", animationFillMode: "backwards" }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-foreground">Últimos Lançamentos</h2>
              <Link to="/transactions" className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium transition-colors duration-150">
                Ver todos <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
              <div className="space-y-0.5">
                {recentTransactions.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Nenhum lançamento registrado</p>
                ) : (
                  recentTransactions.map((t) => (
                    <TransactionRow key={t.id} transaction={t} />
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </AppLayout>
  );
}
