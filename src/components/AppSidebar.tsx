import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useCompany } from "@/hooks/useCompany";
import logo from "@/assets/logo.png";
import {
  LayoutDashboard,
  ArrowLeftRight,
  FileBarChart2,
  PieChart,
  MessageSquare,
  Settings,
  LogOut,
  Brain,
  TrendingUp,
  FileText,
} from "lucide-react";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/transactions", label: "Lançamentos", icon: ArrowLeftRight },
  { to: "/dre", label: "DRE", icon: FileBarChart2 },
  { to: "/reports", label: "Relatórios", icon: PieChart },
  { to: "/cfo-digital", label: "CFO Digital", icon: Brain },
  { to: "/forecast", label: "Previsão Fluxo", icon: TrendingUp },
  { to: "/summary", label: "Resumo Executivo", icon: FileText },
  { to: "/whatsapp", label: "WhatsApp", icon: MessageSquare },
  { to: "/settings", label: "Configurações", icon: Settings },
];

export function AppSidebar() {
  const location = useLocation();
  const { signOut } = useAuth();
  const { company } = useCompany();

  return (
    <aside className="hidden lg:flex w-64 flex-col bg-sidebar border-r border-sidebar-border">
      <div className="p-6">
        <div className="flex items-center gap-3">
          <img src={logo} alt="FinanceAI" className="h-9 w-9 rounded-lg" />
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
                  ? "bg-sidebar-accent text-sidebar-accent-foreground glow-border"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
              }`}
            >
              <item.icon className={`h-4 w-4 ${isActive ? "text-primary" : ""}`} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 mb-2">
        <button
          onClick={signOut}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground transition-all duration-200 w-full"
        >
          <LogOut className="h-4 w-4" />
          Sair
        </button>
      </div>

      {company && (
        <div className="p-4 mx-3 mb-4 glass-card glow-border">
          <p className="text-xs text-muted-foreground mb-1">Empresa ativa</p>
          <p className="text-sm font-semibold text-foreground">{company.name}</p>
          {company.cnpj && <p className="text-xs text-muted-foreground">{company.cnpj}</p>}
        </div>
      )}
    </aside>
  );
}
