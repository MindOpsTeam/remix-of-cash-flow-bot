import { AppLayout } from "@/components/AppLayout";
import { Shield, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

const integrations = [
  {
    icon: Shield,
    iconBg: "bg-primary/10",
    iconColor: "text-primary",
    title: "Asaas — Pessoal",
    description: "Cobranças, transferências e notas fiscais da sua conta pessoal Asaas",
    to: "/personal/integrations/asaas",
  },
];

export default function PersonalIntegrations() {
  return (
    <AppLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground tracking-[-0.02em]">Integrações — Pessoal</h1>
        <p className="text-sm text-muted-foreground mt-1 mb-6">
          Conecte suas contas pessoais para automatizar suas finanças
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {integrations.map((item) => (
            <Link key={item.title} to={item.to} className="block">
              <div className="bg-card border border-border rounded-lg p-5 hover:border-primary/40 hover:shadow-card-hover transition-all cursor-pointer">
                <div className="flex items-center justify-between mb-3">
                  <div className={`p-2 rounded-lg ${item.iconBg}`}>
                    <item.icon className={`h-5 w-5 ${item.iconColor}`} />
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
                <h3 className="text-sm font-semibold text-foreground">{item.title}</h3>
                <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
