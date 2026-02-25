import { ReactNode } from "react";
import { AppSidebar } from "./AppSidebar";
import { CFOChatWidget } from "./CFOChatWidget";
import { NotificationBell } from "./NotificationBell";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <main className="flex-1 overflow-auto">
        <div className="flex justify-end px-6 pt-4 lg:px-10">
          <NotificationBell />
        </div>
        <div className="p-6 lg:px-10 lg:py-4 max-w-[1400px] mx-auto animate-fade-in">
          {children}
        </div>
      </main>
      <CFOChatWidget />
    </div>
  );
}
