import { ReactNode, useState } from "react";
import { AppSidebar, SidebarContent } from "./AppSidebar";
import { CFOChatWidget } from "./CFOChatWidget";
import { NotificationBell } from "./NotificationBell";
import { CompanyScopeSwitcher } from "./company/CompanyScopeSwitcher";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Menu } from "lucide-react";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />

      {/* Mobile drawer */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-64 p-0 bg-sidebar border-sidebar-border">
          <SheetTitle className="sr-only">Menu de navegação</SheetTitle>
          <div className="flex flex-col h-full">
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>

      <main className="flex-1 overflow-auto">
        <div className="flex items-center justify-between px-6 pt-4 lg:px-10">
          {/* Hamburger - mobile only */}
          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden p-2 -ml-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="lg:hidden" /> {/* spacer */}
          <div className="flex items-center gap-3">
            <CompanyScopeSwitcher />
            <NotificationBell />
          </div>
        </div>
        <div className="p-6 lg:px-10 lg:py-4 max-w-[1400px] mx-auto animate-fade-in">
          {children}
        </div>
      </main>
      <CFOChatWidget />
    </div>
  );
}
