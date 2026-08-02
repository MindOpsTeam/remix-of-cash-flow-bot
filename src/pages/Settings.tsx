import { AppLayout } from "@/components/AppLayout";
import { Building2, Users, List, FolderTree, MessageSquare, SlidersHorizontal, Landmark, Plug, Layers, KeyRound, Crown, Rocket, Settings2 } from "lucide-react";
import { Link } from "react-router-dom";

const sections = [
  {
    icon: Building2,
    title: "Empresa",
    description: "Dados cadastrais, CNPJ, razão social e endereço",
    to: "/settings/company",
    available: true,
  },
  {
    icon: Layers,
    title: "Consolidação do grupo",
    description: "Plano de contas do grupo e mapeamento entre CNPJs",
    to: "/settings/consolidation",
    available: true,
  },
  {
    icon: KeyRound,
    title: "API pública",
    description: "Chaves de integração para BI, planilhas e automações",
    to: "/settings/api",
    available: true,
  },
  {
    icon: Users,
    title: "Usuários",
    description: "Gerenciar usuários, convites e permissões de acesso",
    to: "/settings/users",
    available: true,
  },
  {
    icon: Landmark,
    title: "Contas Bancárias",
    description: "Bancos, contas correntes, poupança e carteiras",
    to: "/settings/bank-accounts",
    available: true,
  },
  {
    icon: List,
    title: "Plano de Contas",
    description: "Configurar contas contábeis hierárquicas",
    to: "/settings/chart-of-accounts",
    available: true,
  },
  {
    icon: FolderTree,
    title: "Centros de Custo",
    description: "Departamentos, projetos e clientes",
    to: "/settings/cost-centers",
    available: true,
  },
  {
    icon: Settings2,
    title: "Configuração da plataforma",
    description: "Todas as chaves num lugar só, com teste de conexão e guia de como obter",
    to: "/settings/plataforma",
    available: true,
  },
  {
    icon: Plug,
    title: "Integrações",
    description: "Banco, cobrança, cartão, nota fiscal e avisos — com os webhooks da empresa",
    to: "/settings/integrations",
    available: true,
  },
  {
    icon: MessageSquare,
    title: "CFO Digital via WhatsApp",
    description: "Configurar o assistente CFO estratégico via WhatsApp",
    to: "/whatsapp",
    available: true,
  },
  {
    icon: SlidersHorizontal,
    title: "Preferências",
    description: "Notificações, comportamento da IA e padrões do sistema",
    to: "/settings/preferences",
    available: true,
  },
  {
    icon: Rocket,
    title: "Guia de instalação",
    description: "Reabra o passo a passo: CNPJs, equipe, banco e todas as chaves",
    to: "/dashboard?guia=1",
    available: true,
  },
];

export default function SettingsPage() {
  return (
    <AppLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground tracking-[-0.02em]">Configurações</h1>
        <p className="text-sm text-muted-foreground mt-1">Gerencie sua empresa e preferências</p>
      </div>

      {/* Grade de 3: o card ocupa a altura inteira da linha (h-full + flex), então
          descrições de tamanhos diferentes não deixam os cards desalinhados. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map((s) => (
          <Link key={s.title} to={s.available ? s.to : "#"} className="h-full">
            <div
              className={`flex h-full flex-col rounded-lg border border-border bg-card p-5 transition-colors ${
                s.available ? "cursor-pointer hover:bg-accent/40" : "cursor-not-allowed opacity-50"
              }`}
            >
              <div className="mb-3 flex items-start justify-between">
                <s.icon className="h-5 w-5 text-primary" />
                {!s.available && (
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">Em breve</span>
                )}
              </div>
              <h3 className="mb-1 text-sm font-semibold text-foreground">{s.title}</h3>
              <p className="text-xs leading-5 text-muted-foreground">{s.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </AppLayout>
  );
}
