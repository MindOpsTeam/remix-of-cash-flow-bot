import { AppLayout } from "@/components/AppLayout";
import { Link } from "react-router-dom";
import { Brain, MessageSquare, Layers, Building2, Info } from "lucide-react";
import { EmptyState, Icon, Pill, Spinner } from "@viverdeia/design-system";
import { useEffect, useMemo, useState } from "react";
import { useCompany } from "@/hooks/useCompany";
import { useAuth } from "@/hooks/useAuth";
import { useMarginBI } from "@/hooks/useMarginBI";
import { supabase } from "@/integrations/supabase/client";
import { OnboardingWizard } from "@/components/OnboardingWizard";
import { MarginKpis } from "@/components/bi/MarginKpis";
import { CompanyMarginTable } from "@/components/bi/CompanyMarginTable";
import { MarginByCompanyChart } from "@/components/bi/MarginByCompanyChart";
import { MarginTrendChart } from "@/components/bi/MarginTrendChart";
import { RevenueContributionChart } from "@/components/bi/RevenueContributionChart";
import { MarginWaterfall } from "@/components/bi/MarginWaterfall";
import { ReformaReadinessCard } from "@/components/reforma/ReformaReadinessCard";
import { GroupApArCard } from "@/components/bi/GroupApArCard";
import { useCockpit } from "@/hooks/useCockpit";
import { burnMensal, runwayMeses, dso, dpo } from "@/lib/metrics";
import { CockpitPulse } from "@/components/bi/CockpitPulse";
import { KpiMetasCard } from "@/components/bi/KpiMetasCard";
import { AgingCard } from "@/components/bi/AgingCard";
import { RadarOperacionalCard } from "@/components/bi/RadarOperacionalCard";
import { CentroCustoCard } from "@/components/bi/CentroCustoCard";
import { TopClientesCard } from "@/components/bi/TopClientesCard";
import { AiInsightsCard } from "@/components/bi/AiInsightsCard";
import { MinhasVisoes } from "@/components/bi/MinhasVisoes";
import { ChecklistAtivacao } from "@/components/bi/ChecklistAtivacao";
import { PeriodoSelector } from "@/components/bi/PeriodoSelector";
import { calcularJanela, type PeriodoSel } from "@/lib/periodo";

function useOnboarding() {
  const { user } = useAuth();
  const { company } = useCompany();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [memberId, setMemberId] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !company) return;
    // ?guia=1 reabre o guia de instalação para quem já concluiu (link nas
    // Configurações) — o wizard é reentrante por design.
    const reabrir = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("guia") === "1";
    supabase
      .from("company_members")
      .select("id, onboarding_completed")
      .eq("user_id", user.id)
      .eq("company_id", company.id)
      .maybeSingle()
      .then(async ({ data }) => {
        if (data && (reabrir || !(data as { onboarding_completed: boolean }).onboarding_completed)) {
          // NÃO marcar como concluído aqui. Marcar na abertura fazia abandono na
          // primeira etapa virar conclusão: quem fechasse a aba ou desse refresh
          // nunca mais via o onboarding. Quem conclui é o próprio wizard.
          setMemberId(data.id);
          setShowOnboarding(true);
        }
      });
  }, [user, company]);

  return { showOnboarding, memberId, close: () => setShowOnboarding(false) };
}

export default function Dashboard() {
  const { scope, companies, company } = useCompany();
  const { data, isLoading, error } = useMarginBI();
  const cockpit = useCockpit();
  const onboarding = useOnboarding();

  const isCombined = scope === "all";

  // Janela de período do painel (mês / intervalo / ano) — recalcula os
  // indicadores essenciais a partir do trend já carregado, sem novo fetch.
  const [periodo, setPeriodo] = useState<PeriodoSel>({ mode: "mes" });
  const janela = useMemo(() => calcularJanela(data?.trend ?? [], periodo), [data?.trend, periodo]);
  const monthLabel = janela.periodoLabel;

  // Ritmo de queima sobre meses COMPLETOS: o mês corrente parcial distorceria.
  const trend = data?.trend ?? [];
  const mesesFechados = trend.length > 3 ? trend.slice(-4, -1) : trend.slice(-3);
  const burn = burnMensal(mesesFechados);
  const runway = runwayMeses(cockpit.data?.caixa ?? null, burn);
  const receita90 = trend.slice(-3).reduce((s, p) => s + p.receita, 0);
  const saidas90 = trend.slice(-3).reduce((s, p) => s + p.custos + p.despesas, 0);
  const dsoDias = cockpit.data ? dso(cockpit.data.arAberto, receita90, 90) : null;
  const dpoDias = cockpit.data ? dpo(cockpit.data.apAberto, saidas90, 90) : null;

  const metasHolder = isCombined ? companies[0]?.id : company?.id;
  const realizadoMetas: Record<string, number> = {
    receita_mes: data?.currentMonth.receita ?? 0,
    resultado_mes: data?.currentMonth.resultado ?? 0,
    margem_operacional: data?.currentMonth.margemOperacional ?? 0,
    mrr: cockpit.data?.mrrMensal ?? 0,
    inadimplencia: cockpit.data?.inadimplenciaPct ?? 0,
  };

  return (
    <AppLayout>
      {onboarding.showOnboarding && onboarding.memberId && (
        <OnboardingWizard open={onboarding.showOnboarding} onComplete={onboarding.close} memberId={onboarding.memberId} />
      )}

      <div className="mb-8 flex flex-wrap items-end justify-between gap-3 border-b border-border/70 pb-6 animate-fade-in">
        <div>
          <div className="mb-3 flex items-center gap-2">
            <span className="via-eyebrow">Posição financeira</span>
            {isCombined ? <Pill size="sm">visão consolidada</Pill> : null}
          </div>
          <div className="flex items-center gap-2">
            {isCombined ? <Layers className="h-5 w-5 text-primary" /> : <Building2 className="h-5 w-5 text-primary" />}
            <h1 className="font-display text-[32px] font-medium tracking-[-0.035em] text-foreground">
              {isCombined ? "Painel Consolidado" : data?.companies[0]?.name ?? "Painel"}
            </h1>
          </div>
          <p className="mt-1 text-sm capitalize text-muted-foreground">
            {isCombined
              ? `Margem combinada de ${companies.length} ${companies.length === 1 ? "CNPJ" : "CNPJs"} · ${monthLabel}`
              : `${data?.companies[0]?.orgId ?? ""} · ${monthLabel}`}
          </p>
        </div>
      </div>

      <ChecklistAtivacao />
      <ReformaReadinessCard />

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Spinner size="lg" label="Carregando posição financeira" />
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-6 text-sm text-destructive">
          Erro ao carregar dados de margem: {(error as Error).message}
        </div>
      ) : !data ? (
        <EmptyState
          icon={<Building2 />}
          title="Nenhuma empresa vinculada"
          description="Cadastre um CNPJ em Configurações → Empresas para começar."
        />
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <span className="via-eyebrow">Desempenho</span>
              <h2 className="mt-1 text-lg font-semibold tracking-[-0.02em] text-foreground">Indicadores essenciais</h2>
            </div>
            <div className="flex flex-col items-start gap-1.5 sm:items-end">
              <PeriodoSelector trend={data.trend} sel={periodo} onChange={setPeriodo} />
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Info className="h-3.5 w-3.5" />
                {janela.comparacaoLabel ? `Comparação: ${janela.comparacaoLabel}` : "Sem base de comparação"}
              </div>
            </div>
          </div>

          <div className="mb-8">
            <MarginKpis
              current={janela.current}
              previous={janela.previous}
              trend={data.trend}
              semComparacao={!janela.temComparacao}
              comparacaoLabel={janela.comparacaoLabel}
              periodoDescricao="no período"
            />
          </div>

          {/* A pagar, a receber e orçamento do grupo vêm DEPOIS do resultado.
              São compromisso e saldo — leitura que faz sentido quando já se sabe
              quanto entrou e quanto sobrou, não antes. */}
          <GroupApArCard />

          {cockpit.data && (
            <>
              <div className="mb-3">
                <span className="via-eyebrow">Cockpit</span>
                <h2 className="mt-1 text-lg font-semibold tracking-[-0.02em] text-foreground">Caixa e compromissos</h2>
              </div>
              <div className="mb-6">
                <CockpitPulse data={cockpit.data} burn={burn} runway={runway} />
              </div>
              <div className="mb-8 grid grid-cols-1 gap-6 xl:grid-cols-3">
                <KpiMetasCard
                  metas={cockpit.data.metas}
                  realizado={realizadoMetas}
                  companyId={metasHolder}
                  isCombined={isCombined}
                />
                <AgingCard ar={cockpit.data.agingAR} ap={cockpit.data.agingAP} />
                <RadarOperacionalCard data={cockpit.data} dsoDias={dsoDias} dpoDias={dpoDias} />
              </div>
            </>
          )}

          <div className="mb-4 border-b border-border/70 pb-4">
            <span className="via-eyebrow">Leitura analítica</span>
            <h2 className="mt-1 text-lg font-semibold tracking-[-0.02em] text-foreground">Tendências e comparação</h2>
            <p className="mt-1 text-xs text-muted-foreground">Histórico dos últimos 12 meses e desempenho acumulado por CNPJ</p>
          </div>

          {isCombined ? (
            <>
              <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
                <div className="xl:col-span-2">
                  <MarginTrendChart data={data.trend} companies={data.companies} isCombined />
                </div>
                <MarginByCompanyChart data={data.perCompany} />
              </div>

              <div className="mb-6 grid grid-cols-1 gap-6 2xl:grid-cols-3">
                <div className="2xl:col-span-2">
                  <CompanyMarginTable data={data.perCompany} />
                </div>
                <RevenueContributionChart data={data.perCompany} />
              </div>
            </>
          ) : (
            <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-5">
              <div className="xl:col-span-3">
                <MarginTrendChart data={data.trend} companies={data.companies} isCombined={false} />
              </div>
              <div className="xl:col-span-2">
                <MarginWaterfall totals={data.totals} />
              </div>
            </div>
          )}

          {cockpit.data && (
            <>
              <div className="mb-4 border-b border-border/70 pb-4">
                <span className="via-eyebrow">Operação e clientes</span>
                <h2 className="mt-1 text-lg font-semibold tracking-[-0.02em] text-foreground">Onde agir agora</h2>
              </div>
              <div className="mb-8 grid grid-cols-1 gap-6 xl:grid-cols-3">
                <CentroCustoCard centros={cockpit.data.centrosCusto} totalMes={cockpit.data.centrosCustoTotalMes} />
                <TopClientesCard
                  top={cockpit.data.clientes.top}
                  participacaoPct={cockpit.data.clientes.participacaoPct}
                />
                <AiInsightsCard companyId={company?.id} companyName={company?.name} />
              </div>
            </>
          )}

          <MinhasVisoes />

          {/* Atalhos de IA */}
          <div className="flex flex-wrap gap-3">
            <Link to="/cfo-digital" className="group min-w-[240px] flex-1">
              <div className="via-glass-panel flex items-center gap-3 px-4 py-3 transition-all duration-200 hover:-translate-y-px hover:border-primary/20 hover:shadow-card-hover">
                <Icon size="md" tone="navy" surface="soft"><Brain /></Icon>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">CFO Digital</p>
                  <p className="truncate text-xs text-muted-foreground">Análise inteligente com IA</p>
                </div>
              </div>
            </Link>
            <Link to="/whatsapp" className="group min-w-[240px] flex-1">
              <div className="via-glass-panel flex items-center gap-3 px-4 py-3 transition-all duration-200 hover:-translate-y-px hover:border-primary/20 hover:shadow-card-hover">
                <Icon size="md" tone="navy" surface="soft"><MessageSquare /></Icon>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">CFO Digital via WhatsApp</p>
                  <p className="truncate text-xs text-muted-foreground">Assistente estratégico financeiro</p>
                </div>
              </div>
            </Link>
          </div>
        </>
      )}
    </AppLayout>
  );
}
