import { AppLayout } from "@/components/AppLayout";
import { Building2, Users, List, FolderTree, Webhook } from "lucide-react";
import { Link } from "react-router-dom";

const sections = [
  { icon: Building2, title: "Empresa", description: "Dados da empresa, CNPJ, razão social", to: "/settings" },
  { icon: Users, title: "Usuários", description: "Gerenciar usuários e permissões", to: "/settings" },
  { icon: List, title: "Plano de Contas", description: "Configurar contas contábeis hierárquicas", to: "/settings/chart-of-accounts" },
  { icon: FolderTree, title: "Centros de Custo", description: "Departamentos, projetos e clientes", to: "/settings/cost-centers" },
  { icon: Webhook, title: "Integrações", description: "Webhooks e conexões com plataformas externas", to: "/settings/integrations" },
];

export default function SettingsPage() {
  return (
    <AppLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Configurações</h1>
        <p className="text-sm text-muted-foreground mt-1">Gerencie sua empresa e preferências</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
        {sections.map((s) => (
          <Link key={s.title} to={s.to}>
            <div className="glass-card p-5 cursor-pointer hover:bg-accent/40 transition-colors">
              <s.icon className="h-5 w-5 text-primary mb-3" />
              <h3 className="text-sm font-semibold text-foreground mb-1">{s.title}</h3>
              <p className="text-xs text-muted-foreground">{s.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </AppLayout>
  );
}
