import { AppLayout } from "@/components/AppLayout";
import { Link } from "react-router-dom";
import { ArrowLeft, Settings2, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CentralDeConfiguracao } from "@/components/integracoes/CentralDeConfiguracao";
import { useAdminPlataforma } from "@/hooks/useAdminPlataforma";

/**
 * Configuração da plataforma fora do wizard: as mesmas chaves, o mesmo teste de
 * conexão e o mesmo guia de "como obter", disponíveis para sempre. Quem não é
 * admin vê a tela em modo leitura (a escrita já é barrada pela RLS).
 */
export default function ConfiguracaoPlataforma() {
  const { ehAdmin, ehPrimeiroUsuario, carregando } = useAdminPlataforma();

  return (
    <AppLayout>
      <div className="mb-6 animate-fade-in">
        <Link to="/settings" className="mb-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Configurações
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <Settings2 className="h-5 w-5 text-primary" />
          <h1 className="font-display text-[28px] font-medium tracking-[-0.02em] text-foreground">
            Configuração da plataforma
          </h1>
          {!carregando && ehAdmin && (
            <Badge variant="outline" className="gap-1 border-primary/30 bg-primary/5 text-[11px] text-primary">
              <ShieldCheck className="h-3 w-3" />
              {ehPrimeiroUsuario ? "Administrador da plataforma" : "Administrador"}
            </Badge>
          )}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Todas as chaves e integrações num lugar só. Cada uma tem teste de conexão e um guia de onde obter,
          como obter e quanto custa.
        </p>
      </div>

      {!carregando && !ehAdmin && (
        <p className="mb-4 rounded-lg border border-[hsl(var(--warning))]/30 bg-[hsl(var(--warning))]/[0.07] p-3 text-xs leading-5 text-foreground">
          Seu perfil não é administrador nesta empresa. Você pode consultar o que está ligado, mas salvar as
          credenciais é permitido apenas ao administrador.
        </p>
      )}

      <CentralDeConfiguracao />
    </AppLayout>
  );
}
