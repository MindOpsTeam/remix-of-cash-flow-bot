import { AppLayout } from "@/components/AppLayout";
import { KPICard } from "@/components/KPICard";
import { TransactionRow } from "@/components/TransactionRow";
import { mockTransactions, monthlyChartData, formatCurrency } from "@/lib/mock-data";
import { DollarSign, TrendingUp, TrendingDown, PiggyBank } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

const kpis = [
  { label: "Receita Mensal", value: 124200, change: 4.8, icon: <DollarSign className="h-4 w-4" /> },
  { label: "Despesas", value: 87650, change: -2.3, icon: <TrendingDown className="h-4 w-4" /> },
  { label: "Lucro Líquido", value: 39605, change: 3.4, icon: <TrendingUp className="h-4 w-4" /> },
  { label: "Margem Líquida", value: 31.9, change: 1.2, icon: <PiggyBank className="h-4 w-4" />, format: "percentage" as const },
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload) return null;
  return (
    <div className="glass-card p-3 text-xs">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {formatCurrency(p.value)}
        </p>
      ))}
    </div>
  );
};

export default function Dashboard() {
  return (
    <AppLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Dashboard Financeiro</h1>
        <p className="text-sm text-muted-foreground mt-1">Visão geral de Fevereiro 2026</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        {kpis.map((kpi) => (
          <KPICard key={kpi.label} {...kpi} />
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 glass-card p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Receitas vs Despesas</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyChartData} barGap={4}>
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

        <div className="glass-card p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Últimos Lançamentos</h2>
          <div className="space-y-0.5">
            {mockTransactions.slice(0, 6).map((t) => (
              <TransactionRow key={t.id} transaction={{ ...t, account_name: t.category, cost_center_name: t.costCenter }} />
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
