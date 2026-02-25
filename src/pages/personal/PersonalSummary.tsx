import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, BarChart3, AlertTriangle, TrendingUp, Receipt } from "lucide-react";
import { usePersonalKPIs } from "@/hooks/usePersonalKPIs";
import { usePersonalForecast } from "@/hooks/usePersonalForecast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

function fmt(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

export default function PersonalSummary() {
  const { kpis, comparison, isLoading: kpisLoading } = usePersonalKPIs();
  const { totals, isLoading: forecastLoading } = usePersonalForecast();
  const isLoading = kpisLoading || forecastLoading;

  const mesAtual = format(new Date(), "MMMM 'de' yyyy", { locale: ptBR });

  const varReceita = comparison.receita_anterior > 0
    ? ((comparison.receita_atual - comparison.receita_anterior) / comparison.receita_anterior * 100)
    : 0;
  const varDespesa = comparison.despesa_anterior > 0
    ? ((comparison.despesa_atual - comparison.despesa_anterior) / comparison.despesa_anterior * 100)
    : 0;

  const taxPercent = kpis.entradas_mes > 0 ? (kpis.taxas_mes / kpis.entradas_mes * 100) : 0;

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid gap-4 md:grid-cols-2">
            {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-40" />)}
          </div>
        </div>
      </AppLayout>
    );
  }

  const cards = [
    {
      icon: FileText,
      title: "Visão Geral do Mês",
      text: `Em ${mesAtual}, você recebeu ${fmt(kpis.entradas_mes)} em receitas. Suas despesas somaram ${fmt(kpis.saidas_mes)}. O resultado do mês é ${fmt(kpis.saldo_mes)} (${kpis.saldo_mes >= 0 ? "positivo" : "negativo"}).`,
    },
    {
      icon: BarChart3,
      title: "Comparativo",
      text: comparison.receita_anterior > 0 || comparison.despesa_anterior > 0
        ? `Comparado ao mês anterior, sua receita ${varReceita >= 0 ? "subiu" : "caiu"} ${Math.abs(varReceita).toFixed(1)}% e suas despesas ${varDespesa >= 0 ? "subiram" : "caíram"} ${Math.abs(varDespesa).toFixed(1)}%.`
        : "Sem dados do mês anterior para comparação.",
    },
    {
      icon: AlertTriangle,
      title: "Inadimplência",
      text: kpis.vencidas_count > 0
        ? `Você tem ${kpis.vencidas_count} cobrança(s) vencida(s) totalizando ${fmt(kpis.vencidas)}.`
        : "Nenhuma cobrança vencida este mês! ✅",
    },
    {
      icon: TrendingUp,
      title: "Previsão",
      text: `Para os próximos 30 dias, você tem ${fmt(totals.entradas)} previsto para receber e ${fmt(totals.saidas)} para pagar. Saldo projetado: ${fmt(totals.saldo)}.`,
    },
    {
      icon: Receipt,
      title: "Taxas",
      text: kpis.taxas_mes > 0
        ? `Você pagou ${fmt(kpis.taxas_mes)} em taxas de gateway este mês. Isso representa ${taxPercent.toFixed(1)}% da sua receita bruta.`
        : "Nenhuma taxa de gateway registrada este mês.",
    },
  ];

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-[-0.02em]">Resumo Executivo</h1>
          <p className="text-sm text-muted-foreground mt-1">Análise completa do seu mês financeiro</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {cards.map((c, i) => (
            <Card key={i} className={i === 0 ? "md:col-span-2" : ""}>
              <CardHeader className="flex flex-row items-center gap-3 pb-2">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <c.icon className="h-4.5 w-4.5 text-primary" />
                </div>
                <CardTitle className="text-base">{c.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-foreground/80 leading-relaxed">{c.text}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
