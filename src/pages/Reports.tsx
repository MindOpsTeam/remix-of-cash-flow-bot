import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/AppLayout";
import { formatCurrency } from "@/lib/utils";
import { exportReportToPDF } from "@/lib/pdf-export";
import { toCsv, downloadCsv } from "@/lib/csv-export";
import { ReformaDestaqueCard } from "@/components/reforma/ReformaDestaqueCard";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { FileDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

interface CategoryItem {
  name: string;
  value: number;
  fill: string;
}

interface CostCenterItem {
  name: string;
  receita: number;
  despesa: number;
}

export default function Reports() {
  const { company } = useCompany();
  const [categoryData, setCategoryData] = useState<CategoryItem[]>([]);
  const [costCenterData, setCostCenterData] = useState<CostCenterItem[]>([]);

  // Period selector
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [preset, setPreset] = useState<"mes" | "trimestre" | "ano">("mes");

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

  const loadData = useCallback(async () => {
    if (!company) return;

    // Presets: mês (padrão), trimestre e ano terminando no mês selecionado.
    const mesesJanela = preset === "trimestre" ? 3 : preset === "ano" ? 12 : 1;
    const startOfMonth = new Date(selectedYear, selectedMonth - (mesesJanela - 1), 1).toISOString().split("T")[0];
    const endOfMonth = new Date(selectedYear, selectedMonth + 1, 0).toISOString().split("T")[0];

    const [{ data: transactions }, { data: costCenters }] = await Promise.all([
      supabase
        .from("transactions")
        .select("amount, type, cost_center_id, chart_of_accounts(name)")
        .eq("company_id", company.id)
        .eq("status", "confirmed")
        .gte("date", startOfMonth)
        .lte("date", endOfMonth),
      supabase
        .from("cost_centers")
        .select("id, name")
        .eq("company_id", company.id)
        .eq("active", true),
    ]);

    if (!transactions) return;

    const catMap = new Map<string, number>();
    transactions
      .filter((t) => t.type === "expense")
      .forEach((t) => {
        const name = (t.chart_of_accounts as any)?.name || "Outros";
        catMap.set(name, (catMap.get(name) || 0) + Number(t.amount));
      });

    const cats: CategoryItem[] = Array.from(catMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, value], i) => ({
        name,
        value,
        fill: COLORS[i % COLORS.length],
      }));
    setCategoryData(cats);

    const ccMap = new Map<string, string>();
    costCenters?.forEach((cc) => ccMap.set(cc.id, cc.name));

    const ccTotals = new Map<string, { receita: number; despesa: number }>();
    costCenters?.forEach((cc) => {
      ccTotals.set(cc.name, { receita: 0, despesa: 0 });
    });
    transactions.forEach((t) => {
      if (!t.cost_center_id) return;
      const name = ccMap.get(t.cost_center_id) || "Outros";
      const entry = ccTotals.get(name) || { receita: 0, despesa: 0 };
      if (t.type === "revenue") entry.receita += Number(t.amount);
      else entry.despesa += Number(t.amount);
      ccTotals.set(name, entry);
    });

    const ccs: CostCenterItem[] = Array.from(ccTotals.entries())
      .map(([name, vals]) => ({ name, ...vals }))
      .sort((a, b) => b.receita - b.despesa - (a.receita - a.despesa));
    setCostCenterData(ccs);
  }, [company, selectedYear, selectedMonth, preset]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (!company) return;
    const channel = supabase
      .channel('reports-transactions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions', filter: `company_id=eq.${company.id}` }, () => {
        loadData();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [company, loadData]);

  return (
    <AppLayout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-[-0.02em]">Relatórios Gerenciais</h1>
          <p className="text-sm text-muted-foreground mt-1 capitalize">
            {monthLabel} — Análises e indicadores da empresa
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
            {([["mes", "Mês"], ["trimestre", "Trimestre"], ["ano", "12 meses"]] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setPreset(key)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  preset === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
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
            disabled={!company}
            onClick={() => {
              exportReportToPDF(
                company?.name || "Empresa",
                categoryData.map((c) => ({ name: c.name, value: c.value })),
                costCenterData
              );
            }}
          >
            <FileDown className="h-4 w-4" />PDF
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            disabled={!company}
            onClick={() => {
              const csv = toCsv(
                ["Categoria", "Valor"],
                [
                  ...categoryData.map((c) => [c.name, c.value] as [string, number]),
                  ...costCenterData.map((c) => [`Centro de custo: ${c.name}`, c.receita - c.despesa] as [string, number]),
                ],
              );
              downloadCsv(`relatorio-${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}.csv`, csv);
            }}
          >
            <FileDown className="h-4 w-4" />CSV
          </Button>
        </div>
      </div>

      <ReformaDestaqueCard year={selectedYear} month={selectedMonth} />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-lg p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Despesas por Categoria</h2>
          {categoryData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">Nenhuma despesa confirmada neste mês.</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={100} strokeWidth={2} stroke="hsl(var(--card))">
                    {categoryData.map((c, i) => (
                      <Cell key={i} fill={c.fill} />
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
            </>
          )}
        </div>

        <div className="bg-card border border-border rounded-lg p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Por Centro de Custo</h2>
          {costCenterData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">Nenhum lançamento com centro de custo neste mês.</p>
          ) : (
            <>
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
            </>
          )}
        </div>
      </div>
    </AppLayout>
  );
}