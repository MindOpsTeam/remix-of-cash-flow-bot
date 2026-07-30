import { AppLayout } from "@/components/AppLayout";
import { Link } from "react-router-dom";
import { Brain, MessageSquare, Layers, Building2, Info } from "lucide-react";
import { EmptyState, Icon, Pill, Spinner } from "@viverdeia/design-system";
import { useEffect, useState } from "react";
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

function useOnboarding() {
  const { user } = useAuth();
  const { company } = useCompany();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [memberId, setMemberId] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !company) return;
    supabase
      .from("company_members")
      .select("id, onboarding_completed")
      .eq("user_id", user.id)
      .eq("company_id", company.id)
      .maybeSingle()
      .then(async ({ data }) => {
        if (data && !(data as { onboarding_completed: boolean }).onboarding_completed) {
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
  const { scope, companies } = useCompany();
  const { data, isLoading, error } = useMarginBI();
  const onboarding = useOnboarding();

  const isCombined = scope === "all";
  const monthLabel = new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

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

      <ReformaReadinessCard />
      <GroupApArCard />

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
          <div className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5" />
            KPIs do mês atual · gráficos dos últimos 12 meses
          </div>

          <div className="mb-6">
            <MarginKpis current={data.currentMonth} previous={data.previousMonth} />
          </div>

          {isCombined ? (
            <>
              <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
                <div className="xl:col-span-2">
                  <CompanyMarginTable data={data.perCompany} />
                </div>
                <RevenueContributionChart data={data.perCompany} />
              </div>

              <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
                <MarginByCompanyChart data={data.perCompany} />
                <MarginTrendChart data={data.trend} companies={data.companies} isCombined />
              </div>
            </>
          ) : (
            <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
              <MarginWaterfall totals={data.totals} />
              <MarginTrendChart data={data.trend} companies={data.companies} isCombined={false} />
            </div>
          )}

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
