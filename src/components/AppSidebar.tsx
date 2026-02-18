import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  ArrowLeftRight,
  FileBarChart2,
  PieChart,
  MessageSquare,
  Settings,
  Building2,
} from "lucide-react";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/transactions", label: "Lançamentos", icon: ArrowLeftRight },
  { to: "/dre", label: "DRE", icon: FileBarChart2 },
  { to: "/reports", label: "Relatórios", icon: PieChart },
  { to: "/whatsapp", label: "WhatsApp", icon: MessageSquare },
  { to: "/settings", label: "Configurações", icon: Settings },
];

export function AppSidebar() {
  const location = useLocation();

  return (
    <aside className="hidden lg:flex w-64 flex-col bg-sidebar border-r border-sidebar-border">
      <div className="p-6">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center">
            <Building2 className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-foreground tracking-tight">FinanceAI</h1>
            <p className="text-xs text-sidebar-foreground">ERP Financeiro</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
              }`}
            >
              <item.icon className={`h-4 w-4 ${isActive ? "text-primary" : ""}`} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 mx-3 mb-4 glass-card">
        <p className="text-xs text-muted-foreground mb-1">Empresa ativa</p>
        <p className="text-sm font-semibold text-foreground">Tech Solutions Ltda</p>
        <p className="text-xs text-muted-foreground">CNPJ: 12.345.678/0001-90</p>
      </div>
    </aside>
  );
}
