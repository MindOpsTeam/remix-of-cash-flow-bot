import { AppLayout } from "@/components/AppLayout";
import { mockDRE, formatCurrency, monthlyChartData } from "@/lib/mock-data";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";

const dreChartData = monthlyChartData.map((m) => ({
  month: m.month,
  lucro: m.receitas - m.despesas,
}));

export default function DRE() {
  return (
    <AppLayout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            Demonstração do Resultado
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Fevereiro 2026 — Regime de Competência</p>
        </div>
        <Button variant="outline" className="gap-2">
          <FileDown className="h-4 w-4" />
          Exportar PDF
        </Button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 glass-card p-5 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 text-muted-foreground font-medium">Conta</th>
                <th className="text-right py-3 text-muted-foreground font-medium">Fev/2026</th>
                <th className="text-right py-3 text-muted-foreground font-medium">Jan/2026</th>
                <th className="text-right py-3 text-muted-foreground font-medium">Var. %</th>
              </tr>
            </thead>
            <tbody>
              {mockDRE.map((line, i) => {
                const variation = line.previousMonth !== 0
                  ? ((line.currentMonth - line.previousMonth) / Math.abs(line.previousMonth)) * 100
                  : 0;
                const isPositiveVar = variation >= 0;

                return (
                  <tr
                    key={i}
                    className={`border-b border-border/50 ${line.isTotal ? "bg-accent/30" : ""} ${line.level === 1 ? "text-muted-foreground" : ""}`}
                  >
                    <td className={`py-2.5 ${line.level === 1 ? "pl-6" : ""} ${line.isTotal ? "font-semibold text-foreground" : ""}`}>
                      {line.label}
                    </td>
                    <td className={`text-right py-2.5 tabular-nums ${line.isTotal ? "font-semibold text-foreground" : ""}`}>
                      {formatCurrency(line.currentMonth)}
                    </td>
                    <td className="text-right py-2.5 tabular-nums">{formatCurrency(line.previousMonth)}</td>
                    <td className={`text-right py-2.5 tabular-nums text-xs font-medium ${isPositiveVar ? "text-revenue" : "text-expense"}`}>
                      {isPositiveVar ? "+" : ""}{variation.toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="glass-card p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Lucro Mensal</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={dreChartData}>
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
              <span className="font-semibold text-foreground">61.2%</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">EBITDA</span>
              <span className="font-semibold text-foreground">{formatCurrency(55340)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Lucro Líquido</span>
              <span className="font-semibold text-revenue">{formatCurrency(39605)}</span>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
