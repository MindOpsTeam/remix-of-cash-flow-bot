import { AppLayout } from "@/components/AppLayout";
import { Webhook } from "lucide-react";
import { Link } from "react-router-dom";

const sections = [
  { icon: Webhook, title: "Integrações", description: "Conecte com plataformas externas como Asaas", to: "/personal/settings/integrations" },
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
          <Link key={s.title} to={s.to}>
            <div className="bg-card border border-border rounded-lg p-5 cursor-pointer hover:bg-accent/40 transition-colors">
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
