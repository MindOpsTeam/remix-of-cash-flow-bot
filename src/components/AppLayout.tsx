import { ReactNode } from "react";
import { AppSidebar } from "./AppSidebar";
import { CFOChatWidget } from "./CFOChatWidget";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="flex min-h-screen">
      <AppSidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-6 lg:p-8 max-w-[1600px] mx-auto">
          {children}
        </div>
      </main>
      <CFOChatWidget />
    </div>
  );
}
