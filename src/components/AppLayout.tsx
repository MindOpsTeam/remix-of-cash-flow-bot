import { ReactNode, useEffect, useState } from "react";
import { AppSidebar, SidebarContent } from "./AppSidebar";
import { CFOChatWidget } from "./CFOChatWidget";
import { DemoTour } from "./DemoTour";
import { NotificationBell } from "./NotificationBell";
import { CompanyScopeSwitcher } from "./company/CompanyScopeSwitcher";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Eye, Menu } from "lucide-react";
import { ViaThemeToggle } from "@/components/ViaThemeToggle";
import { useAuth } from "@/hooks/useAuth";
import { useAceitarConvite } from "@/hooks/useConvite";
import { consagrarDonoSePrimeiro, registrarAmbiente } from "@/lib/rpc-plataforma";
import { BotaoConcluirConfiguracao } from "@/components/integracoes/BotaoConcluirConfiguracao";
import { isDemoUser } from "@/lib/demo";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user } = useAuth();
  const ehDemo = isDemoUser(user?.email);
  useAceitarConvite();

  // Consagra o dono da instalação na primeira vez que alguém entra logado.
  // Roda aqui, e não só no painel, porque quem entra por link de convite ou
  // deep link também precisa que a instalação tenha dono definido.
  useEffect(() => {
    if (!user) return;
    // Ordem importa: consagrar_dono_se_primeiro reagenda os jobs, e reagendar
    // sem o ambiente registrado não faz nada.
    registrarAmbiente().then(consagrarDonoSePrimeiro);
  }, [user]);

  return (
    <div className="via-app-shell flex min-h-screen">
      <a href="#financeai-main" className="via-skip-link">
        Pular para o conteúdo
      </a>
      <AppSidebar />

      {/* Mobile drawer */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="via-sidebar w-64 border-sidebar-border bg-sidebar p-0">
          <SheetTitle className="sr-only">Menu de navegação</SheetTitle>
          <div className="flex flex-col h-full">
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>

      <main id="financeai-main" className="via-app-main flex-1 overflow-auto" tabIndex={-1}>
        <div className="via-topbar flex items-center justify-between px-5 lg:px-7">
          {/* Hamburger - mobile only */}
          <button
            onClick={() => setMobileOpen(true)}
            className="-ml-2 rounded-md p-2 text-muted-foreground transition-all duration-150 hover:bg-muted hover:text-foreground lg:hidden"
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="lg:hidden" /> {/* spacer */}
          <div className="flex items-center gap-3">
            {ehDemo ? (
              <span className="hidden items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary sm:flex">
                <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                Modo demonstração · somente leitura
              </span>
            ) : null}
            {!ehDemo ? <BotaoConcluirConfiguracao /> : null}
            <CompanyScopeSwitcher />
            <NotificationBell />
            <ViaThemeToggle />
          </div>
        </div>
        <div className="via-page via-route-enter">
          {children}
        </div>
      </main>
      {/* Na demo, o tour (barra inferior fixa) é o guia; o widget flutuante do
          CFO colidiria com os botões "Continuar"/"Fechar tour" no mobile. */}
      {ehDemo ? <DemoTour /> : <CFOChatWidget />}
    </div>
  );
}
