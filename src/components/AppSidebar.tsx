import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useCompany } from "@/hooks/useCompany";
import { useAppMode } from "@/hooks/useAppMode";
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
  FlaskConical,
  Wallet,
  User,
  Building2,
  ArrowUpDown,
  Receipt,
} from "lucide-react";

const businessItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/transactions", label: "Lançamentos", icon: ArrowLeftRight },
  { to: "/transfers", label: "Transferências", icon: ArrowUpDown },
  { to: "/bills", label: "Contas a Pagar", icon: Receipt },
  { to: "/dre", label: "DRE", icon: FileBarChart2 },
  { to: "/reports", label: "Relatórios", icon: PieChart },
  { to: "/cfo-digital", label: "CFO Digital", icon: Brain },
  { to: "/simulator", label: "Simulador E se?", icon: FlaskConical },
  { to: "/forecast", label: "Previsão Fluxo", icon: TrendingUp },
  { to: "/summary", label: "Resumo Executivo", icon: FileText },
  { to: "/whatsapp", label: "WhatsApp", icon: MessageSquare },
  { to: "/settings", label: "Configurações", icon: Settings },
];

const personalItems = [
  { to: "/personal", label: "Dashboard", icon: LayoutDashboard },
  { to: "/personal/transactions", label: "Transações", icon: ArrowLeftRight },
  { to: "/personal/transfers", label: "Transferências", icon: ArrowUpDown },
  { to: "/personal/bills", label: "Contas a Pagar", icon: Receipt },
  { to: "/personal/accounts", label: "Contas", icon: Wallet },
  { to: "/personal/forecast", label: "Previsão Fluxo", icon: TrendingUp },
  { to: "/personal/summary", label: "Resumo Executivo", icon: FileText },
  { to: "/whatsapp", label: "WhatsApp", icon: MessageSquare },
  { to: "/personal/settings", label: "Configurações", icon: Settings },
];

export function AppSidebar() {
  const location = useLocation();
  const { signOut } = useAuth();
  const { company } = useCompany();
  const { setMode, isPersonal } = useAppMode();

  const navItems = isPersonal ? personalItems : businessItems;

  return (
    <aside className="hidden lg:flex w-60 flex-col bg-sidebar border-r border-sidebar-border">
      {/* Logo */}
      <div className="p-5 pb-4">
        <div className="flex items-center gap-3">
          <img src={logo} alt="FinanceAI" className="h-8 w-8 rounded-lg" />
          <div>
            <h1 className="text-base font-bold text-sidebar-foreground tracking-tight">FinanceAI</h1>
            <p className="text-[11px] text-sidebar-muted">ERP Financeiro</p>
          </div>
        </div>
      </div>

      {/* Mode Switcher */}
      <div className="px-3 mb-3">
        <div className="flex rounded-md bg-sidebar-accent p-0.5">
          <button
            onClick={() => setMode("personal")}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150 ${
              isPersonal
                ? "bg-sidebar-border text-sidebar-foreground"
                : "text-sidebar-muted hover:text-sidebar-foreground"
            }`}
          >
            <User className="h-3.5 w-3.5" />
            Pessoal
          </button>
          <button
            onClick={() => setMode("business")}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150 ${
              !isPersonal
                ? "bg-sidebar-border text-sidebar-foreground"
                : "text-sidebar-muted hover:text-sidebar-foreground"
            }`}
          >
            <Building2 className="h-3.5 w-3.5" />
            Empresa
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-0.5">
        {navItems.map((item) => {
          const isActive = location.pathname === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-all duration-150 ${
                isActive
                  ? "bg-primary/[0.12] text-sidebar-primary font-medium"
                  : "text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent"
              }`}
            >
              <item.icon className={`h-[18px] w-[18px] shrink-0 ${isActive ? "text-sidebar-primary" : ""}`} strokeWidth={1.5} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Separator */}
      <div className="mx-4 my-2 h-px bg-sidebar-border" />

      {/* Logout */}
      <div className="px-3 mb-2">
        <button
          onClick={signOut}
          className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm text-sidebar-muted hover:text-expense transition-all duration-150 w-full"
        >
          <LogOut className="h-[18px] w-[18px]" strokeWidth={1.5} />
          Sair
        </button>
      </div>

      {/* Active Company */}
      {!isPersonal && company && (
        <div className="p-3 mx-3 mb-4 rounded-md bg-sidebar-accent">
          <p className="text-[11px] text-sidebar-muted mb-0.5">Empresa ativa</p>
          <p className="text-[13px] font-medium text-sidebar-foreground">{company.name}</p>
          {company.cnpj && <p className="text-[11px] text-sidebar-muted">{company.cnpj}</p>}
        </div>
      )}
    </aside>
  );
}
