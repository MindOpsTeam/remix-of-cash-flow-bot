import { AppLayout } from "@/components/AppLayout";
import { Wallet, Tag, MessageSquare, SlidersHorizontal, PiggyBank, Target } from "lucide-react";
import { Link } from "react-router-dom";

const sections = [
  {
    icon: Wallet,
    title: "Contas",
    description: "Gerenciar contas bancárias, carteiras e cartões pessoais",
    to: "/personal/accounts",
    available: true,
  },
  {
    icon: Tag,
    title: "Categorias",
    description: "Personalizar categorias de receitas e despesas",
    to: "/personal/categories",
    available: true,
  },
  {
    icon: PiggyBank,
    title: "Orçamentos",
    description: "Definir limites de gastos por categoria",
    to: "/personal/budgets",
    available: true,
  },
  {
    icon: Target,
    title: "Metas",
    description: "Acompanhar objetivos financeiros de longo prazo",
    to: "/personal/goals",
    available: true,
  },
  {
    icon: Webhook,
    title: "Integrações",
    description: "Conecte com plataformas externas como Asaas",
    to: "/personal/settings/integrations",
    available: true,
  },
  {
    icon: MessageSquare,
    title: "Agente WhatsApp",
    description: "Registrar gastos e receitas pelo WhatsApp",
    to: "/whatsapp",
    available: true,
  },
  {
    icon: SlidersHorizontal,
    title: "Preferências",
    description: "Conta padrão, método de orçamento e notificações",
    to: "/personal/settings/preferences",
    available: true,
  },
];

export default function PersonalSettings() {
  return (
    <AppLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground tracking-[-0.02em]">Configurações</h1>
        <p className="text-sm text-muted-foreground mt-1">Gerencie suas preferências pessoais</p>
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
