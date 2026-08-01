import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { formatCurrency } from "@/lib/utils";
import { exportDREtoPDF } from "@/lib/pdf-export";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { FileDown, ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { montarDRE, montarSerieMensal, type DRELine, type LinhaView, type LinhaMes } from "@/lib/dre";
import { ConnectFirstCTA } from "@/components/openfinance/ConnectFirstCTA";
import { useDetalhe } from "@/components/detalhe/DetalheProvider";

export default function DRE() {
  const { abrirDetalhe } = useDetalhe();
  const { company } = useCompany();
  const [lines, setLines] = useState<DRELine[]>([]);
  const [naoClassificado, setNaoClassificado] = useState(0);
  const [temMovimento, setTemMovimento] = useState(false);
  // Caixa é quando o dinheiro andou; competência é quando o fato aconteceu. O
  // dono lê por caixa, o contador fecha por competência, e a mesma tela precisa
  // servir aos dois. A régua não muda: muda só qual coluna de mês é filtrada.
  const [regime, setRegime] = useState<"caixa" | "competencia">("caixa");
  const [monthlyData, setMonthlyData] = useState<{ month: string; receitas: number; despesas: number; lucro: number }[]>([]);

  // Period selector com estado na URL (?mes=YYYY-MM): período compartilhável
  // por link e sobrevive a refresh.
  const mesInicial = (() => {
    if (typeof window === "undefined") return null;
    const raw = new URLSearchParams(window.location.search).get("mes");
    const m = raw?.match(/^(\d{4})-(\d{2})$/);
    return m ? { ano: Number(m[1]), mes: Number(m[2]) - 1 } : null;
  })();
  const [selectedYear, setSelectedYear] = useState(mesInicial?.ano ?? new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(mesInicial?.mes ?? new Date().getMonth());

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.set("mes", `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}`);
    window.history.replaceState(null, "", `${window.location.pathname}?${params}`);
  }, [selectedYear, selectedMonth]);

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

    // A régua vive na view. Aqui só se ordena e se dá nome às linhas: se a
    // regra de receita/custo/despesa aparecesse de novo neste arquivo, seriam
    // duas cópias da mesma regra e elas voltariam a divergir.
    const colunaMes = regime === "competencia" ? "mes_competencia" : "mes";

    const { data: linhasView } = await supabase
      .from("v_dre_linhas")
      .select("account_id, account_code, account_name, type, grupo, total")
      .eq("company_id", company.id)
      .gte(colunaMes, startOfMonth)
      .lte(colunaMes, endOfMonth);

    const linhasDoMes = (linhasView ?? []) as unknown as LinhaView[];
    const resultado = montarDRE(linhasDoMes);
    setLines(resultado.linhas);
    setNaoClassificado(resultado.naoClassificado);
    // montarDRE sempre devolve o esqueleto do DRE, inclusive zerado, então
    // `lines.length` não serve mais para saber se o mês tem movimento.
    setTemMovimento(linhasDoMes.length > 0);

    // Últimos 6 meses, da MESMA view da tabela, para o gráfico e o Lucro
    // Líquido ao lado não contarem coisas diferentes.
    const chartStart = new Date(selectedYear, selectedMonth - 5, 1).toISOString().split("T")[0];

    const { data: serieView } = await supabase
      .from("v_dre_linhas")
      .select(`mes:${colunaMes}, grupo, total`)
      .eq("company_id", company.id)
      .gte(colunaMes, chartStart)
      .lte(colunaMes, endOfMonth);

    const chaves: string[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(selectedYear, selectedMonth - i, 1);
      chaves.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }

    const serie = montarSerieMensal((serieView ?? []) as unknown as LinhaMes[], chaves);
    setMonthlyData(
      serie.map((p) => {
        const [y, m] = p.chave.split("-").map(Number);
        return {
          month: new Date(y, m - 1).toLocaleDateString("pt-BR", { month: "short" }),
          receitas: p.receitas,
          despesas: p.despesas,
          lucro: p.lucro,
        };
      }),
    );
  }, [company, selectedYear, selectedMonth, regime]);

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

  // A margem se calcula sobre a receita LÍQUIDA quando há deduções. Usar a
  // bruta numa empresa do Simples, que paga imposto sobre faturamento, infla a
  // receita e desloca a margem inteira.
  const totalRevenue =
    lines.find((l) => l.label === "Receita Líquida")?.value ??
    lines.find((l) => l.label === "Receita Bruta")?.value ??
    0;
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
            {monthLabel} — {regime === "competencia" ? "por competência" : "por caixa"}, confirmados e conciliados
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
            {(["caixa", "competencia"] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRegime(r)}
                className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                  regime === r ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
                title={r === "caixa" ? "Quando o dinheiro entrou ou saiu" : "Quando o fato aconteceu"}
              >
                {r === "caixa" ? "Caixa" : "Competência"}
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
            disabled={!temMovimento}
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
          {!temMovimento ? (
            <div className="py-12">
              <ConnectFirstCTA
                onImportado={buildDRE}
                descricao="Conecte o banco uma vez e o resultado deste mês monta sozinho: o extrato entra todo dia, a IA classifica e você só revisa."
              />
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
                  <tr
                    key={i}
                    role={line.accountId ? "button" : undefined}
                    tabIndex={line.accountId ? 0 : undefined}
                    aria-label={line.accountId ? `Abrir a conta ${line.label}` : undefined}
                    onClick={() => line.accountId && abrirDetalhe({ tipo: "account", id: line.accountId })}
                    onKeyDown={(e) => {
                      if (!line.accountId || (e.key !== "Enter" && e.key !== " ")) return;
                      e.preventDefault();
                      abrirDetalhe({ tipo: "account", id: line.accountId });
                    }}
                    className={`border-b border-border/50 ${line.isTotal ? "bg-accent/30" : ""} ${line.alerta ? "bg-warning/[0.08]" : ""} ${
                      line.accountId ? "cursor-pointer transition-colors hover:bg-muted/40 focus:outline-none focus-visible:bg-muted/50 focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-primary/40" : ""
                    }`}
                  >
                    <td className={`py-2.5 ${line.level === 1 ? "pl-6 text-muted-foreground" : ""} ${line.isTotal ? "font-semibold text-foreground" : ""}`}>
                      {line.label}
                    </td>
                    <td
                      className={`text-right py-2.5 tabular-nums ${line.isTotal ? "font-semibold" : ""} ${
                        line.alerta ? "text-warning dark:text-warning" : line.value >= 0 ? "text-revenue" : "text-expense"
                      }`}
                    >
                      {formatCurrency(line.value)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {naoClassificado > 0 && (
            <div className="mt-4 flex items-start gap-2 rounded-md border border-warning/30 bg-warning/[0.08] p-3 text-xs">
              <AlertTriangle className="h-4 w-4 shrink-0 text-warning dark:text-warning mt-0.5" />
              <p className="text-muted-foreground">
                <span className="font-medium text-foreground">{formatCurrency(naoClassificado)}</span> em lançamentos
                ainda sem conta contábil. Esse valor não entra no lucro acima. Classifique em{" "}
                <Link to="/transactions" className="underline underline-offset-2 hover:text-foreground">
                  Lançamentos
                </Link>{" "}
                para o resultado ficar completo.
              </p>
            </div>
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