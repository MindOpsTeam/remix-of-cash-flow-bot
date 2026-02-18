import { AppLayout } from "@/components/AppLayout";
import { categoryData, formatCurrency } from "@/lib/mock-data";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

const costCenterData = [
  { name: "Comercial", receita: 45000, despesa: 5600 },
  { name: "Administrativo", receita: 0, despesa: 10600 },
  { name: "TI", receita: 0, despesa: 3200 },
  { name: "RH", receita: 0, despesa: 67000 },
  { name: "Projetos", receita: 32000, despesa: 0 },
  { name: "Marketing", receita: 0, despesa: 5600 },
];

export default function Reports() {
  return (
    <AppLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Relatórios Gerenciais</h1>
        <p className="text-sm text-muted-foreground mt-1">Análises e indicadores da empresa</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="glass-card p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Despesas por Categoria</h2>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={100} strokeWidth={2} stroke="hsl(var(--card))">
                {categoryData.map((_, i) => (
                  <Cell key={i} fill={categoryData[i].fill} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                formatter={(value: number) => formatCurrency(value)}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {categoryData.map((c, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.fill }} />
                <span className="text-muted-foreground truncate">{c.name}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Por Centro de Custo</h2>
          <div className="space-y-3">
            {costCenterData.map((cc) => {
              const total = cc.receita + cc.despesa;
              const maxVal = Math.max(...costCenterData.map((c) => c.receita + c.despesa));
              return (
                <div key={cc.name}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-foreground font-medium">{cc.name}</span>
                    <span className="text-muted-foreground tabular-nums">{formatCurrency(total)}</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden flex">
                    {cc.receita > 0 && (
                      <div className="bg-revenue h-full rounded-full" style={{ width: `${(cc.receita / maxVal) * 100}%` }} />
                    )}
                    {cc.despesa > 0 && (
                      <div className="bg-expense h-full rounded-full" style={{ width: `${(cc.despesa / maxVal) * 100}%` }} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full bg-revenue" /> Receita</div>
            <div className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full bg-expense" /> Despesa</div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
