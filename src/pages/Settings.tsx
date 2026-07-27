import { AppLayout } from "@/components/AppLayout";
import { Building2, Users, List, FolderTree, MessageSquare, SlidersHorizontal, Landmark, Plug, Layers, KeyRound } from "lucide-react";
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
    icon: Plug,
    title: "Integrações",
    description: "Open Finance, emissores de nota fiscal, cobrança e banco",
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
];

export default function SettingsPage() {
  return (
    <AppLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground tracking-[-0.02em]">Configurações</h1>
        <p className="text-sm text-muted-foreground mt-1">Gerencie sua empresa e preferências</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
        {sections.map((s) => (
          <Link key={s.title} to={s.available ? s.to : "#"}>
            <div className={`bg-card border border-border rounded-lg p-5 transition-colors ${s.available ? "cursor-pointer hover:bg-accent/40" : "opacity-50 cursor-not-allowed"}`}>
              <div className="flex items-start justify-between mb-3">
                <s.icon className="h-5 w-5 text-primary" />
                {!s.available && (
                  <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded">Em breve</span>
                )}
              </div>
              <h3 className="text-sm font-semibold text-foreground mb-1">{s.title}</h3>
              <p className="text-xs text-muted-foreground">{s.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </AppLayout>
  );
}
