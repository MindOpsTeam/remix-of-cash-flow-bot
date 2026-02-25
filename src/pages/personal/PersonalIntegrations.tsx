import { AppLayout } from "@/components/AppLayout";
import { Shield, ChevronRight, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

export default function PersonalIntegrations() {
  return (
    <AppLayout>
      <div className="mb-8">
        <Link to="/personal/settings" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4">
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar para Configurações
        </Link>
        <h1 className="text-2xl font-bold text-foreground tracking-[-0.02em]">Integrações</h1>
        <p className="text-sm text-muted-foreground mt-1 mb-6">
          Conecte com plataformas externas para automatizar suas finanças pessoais
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Link to="/personal/settings/integrations/asaas" className="block">
            <div className="bg-card border border-border rounded-lg p-5 hover:border-primary/40 hover:shadow-card-hover transition-all cursor-pointer">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Shield className="h-5 w-5 text-primary" />
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">Asaas</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Receba cobranças, transferências e notas fiscais automaticamente
              </p>
            </div>
          </Link>
        </div>
      </div>
    </AppLayout>
  );
}
