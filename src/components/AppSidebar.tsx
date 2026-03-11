import { Link, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
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
  ScanLine,
  Scale,
  Tag,
  PiggyBank,
  Target,
  CreditCard,
  ChevronDown,
  Plug,
  type LucideIcon,
} from "lucide-react";

// ---------- Types ----------

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

interface NavGroup {
  key: string;
  label: string;
  icon: LucideIcon;
  items: NavItem[];
}

type NavEntry = NavItem | NavGroup;

function isGroup(entry: NavEntry): entry is NavGroup {
  return "items" in entry;
}

// ---------- Navigation structure ----------

const businessNav: NavEntry[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  {
    key: "ops",
    label: "Operações",
    icon: ArrowLeftRight,
    items: [
      { to: "/transactions", label: "Lançamentos", icon: ArrowLeftRight },
      { to: "/bills", label: "Contas a Pagar", icon: Receipt },
      { to: "/owner-transactions", label: "Sócio ↔ Empresa", icon: Scale },
      { to: "/documents", label: "Documentos", icon: ScanLine },
    ],
  },
  {
    key: "analysis",
    label: "Análise",
    icon: PieChart,
    items: [
      { to: "/dre", label: "DRE", icon: FileBarChart2 },
      { to: "/reports", label: "Relatórios", icon: PieChart },
      { to: "/forecast", label: "Previsão Fluxo", icon: TrendingUp },
      { to: "/summary", label: "Resumo Executivo", icon: FileText },
    ],
  },
  {
    key: "ai",
    label: "Inteligência",
    icon: Brain,
    items: [
      { to: "/cfo-digital", label: "CFO Digital", icon: Brain },
      { to: "/simulator", label: "Simulador E se?", icon: FlaskConical },
      { to: "/whatsapp", label: "WhatsApp", icon: MessageSquare },
    ],
  },
  {
    key: "integrations",
    label: "Integrações",
    icon: Plug,
    items: [
      { to: "/settings/integrations", label: "Configurar", icon: Plug },
      { to: "/transfers", label: "Movimentações Asaas", icon: ArrowUpDown },
    ],
  },
];

const personalNav: NavEntry[] = [
  { to: "/personal", label: "Dashboard", icon: LayoutDashboard },
  {
    key: "finance",
    label: "Financeiro",
    icon: ArrowLeftRight,
    items: [
      { to: "/personal/transactions", label: "Transações", icon: ArrowLeftRight },
      { to: "/personal/transfers", label: "Transferências", icon: ArrowUpDown },
      { to: "/personal/bills", label: "Contas a Pagar", icon: Receipt },
      { to: "/personal/credit-cards", label: "Cartões", icon: CreditCard },
      { to: "/owner-transactions", label: "Sócio ↔ Empresa", icon: Scale },
    ],
  },
  {
    key: "plan",
    label: "Planejamento",
    icon: Target,
    items: [
      { to: "/personal/budgets", label: "Orçamentos", icon: PiggyBank },
      { to: "/personal/goals", label: "Metas", icon: Target },
      { to: "/documents", label: "Documentos", icon: ScanLine },
    ],
  },
  {
    key: "analysis",
    label: "Análise",
    icon: PieChart,
    items: [
      { to: "/personal/reports", label: "Relatórios", icon: PieChart },
      { to: "/personal/forecast", label: "Previsão Fluxo", icon: TrendingUp },
      { to: "/personal/summary", label: "Resumo Executivo", icon: FileText },
    ],
  },
  { to: "/personal/integrations", label: "Integrações", icon: Plug },
  { to: "/whatsapp", label: "WhatsApp", icon: MessageSquare },
];

const personalSettingsGroup: NavGroup = {
  key: "config",
  label: "Configurações",
  icon: Settings,
  items: [
    { to: "/personal/accounts", label: "Contas", icon: Wallet },
    { to: "/personal/categories", label: "Categorias", icon: Tag },
    { to: "/personal/settings", label: "Geral", icon: Settings },
  ],
};

// ---------- Helpers ----------

function getActiveGroup(nav: NavEntry[], pathname: string, extra?: NavGroup): string | null {
  for (const entry of nav) {
    if (isGroup(entry) && entry.items.some((i) => pathname === i.to)) {
      return entry.key;
    }
  }
  if (extra && extra.items.some((i) => pathname === i.to)) {
    return extra.key;
  }
  return null;
}

// ---------- Components ----------

function NavLink({
  item,
  isActive,
  onClick,
}: {
  item: NavItem;
  isActive: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      to={item.to}
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all duration-150 ${
        isActive
          ? "bg-primary/[0.12] text-sidebar-primary font-medium"
          : "text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent"
      }`}
    >
      <item.icon
        className={`h-[18px] w-[18px] shrink-0 ${isActive ? "text-sidebar-primary" : ""}`}
        strokeWidth={1.5}
      />
      {item.label}
    </Link>
  );
}

function NavGroupSection({
  group,
  pathname,
  isOpen,
  onToggle,
  onNavigate,
}: {
  group: NavGroup;
  pathname: string;
  isOpen: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
}) {
  const hasActive = group.items.some((i) => pathname === i.to);

  return (
    <div>
      <button
        onClick={onToggle}
        className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm w-full transition-all duration-150 ${
          hasActive && !isOpen
            ? "text-sidebar-primary font-medium"
            : "text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent"
        }`}
      >
        <group.icon className={`h-[18px] w-[18px] shrink-0 ${hasActive ? "text-sidebar-primary" : ""}`} strokeWidth={1.5} />
        <span className="flex-1 text-left">{group.label}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          strokeWidth={1.5}
        />
      </button>
      <div
        className={`overflow-hidden transition-all duration-200 ${
          isOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="ml-3 pl-3 border-l border-sidebar-border space-y-0.5 mt-0.5 mb-1">
          {group.items.map((item) => (
            <NavLink
              key={item.to}
              item={item}
              isActive={pathname === item.to}
              onClick={onNavigate}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------- Sidebar content (shared between desktop and mobile) ----------

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation();
  const { signOut } = useAuth();
  const { company } = useCompany();
  const { setMode, isPersonal } = useAppMode();

  const nav = isPersonal ? personalNav : businessNav;

  const extraGroup = isPersonal ? personalSettingsGroup : undefined;

  // Track which groups are open
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    const active = getActiveGroup(nav, location.pathname, extraGroup);
    return new Set(active ? [active] : []);
  });

  // Auto-open group when route changes
  useEffect(() => {
    const active = getActiveGroup(nav, location.pathname, extraGroup);
    if (active && !openGroups.has(active)) {
      setOpenGroups((prev) => new Set([...prev, active]));
    }
  }, [location.pathname, nav]);

  const toggleGroup = (key: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <>
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
      <nav className="flex-1 min-h-0 px-3 space-y-0.5 overflow-y-auto">
        {nav.map((entry) =>
          isGroup(entry) ? (
            <NavGroupSection
              key={entry.key}
              group={entry}
              pathname={location.pathname}
              isOpen={openGroups.has(entry.key)}
              onToggle={() => toggleGroup(entry.key)}
              onNavigate={onNavigate}
            />
          ) : (
            <NavLink
              key={entry.to}
              item={entry}
              isActive={location.pathname === entry.to}
              onClick={onNavigate}
            />
          ),
        )}
      </nav>

      {/* Settings — fixed at bottom */}
      <div className="mx-4 mt-2 h-px bg-sidebar-border" />
      <div className="px-3 py-2">
        {isPersonal ? (
          <NavGroupSection
            group={personalSettingsGroup}
            pathname={location.pathname}
            isOpen={openGroups.has("config")}
            onToggle={() => toggleGroup("config")}
            onNavigate={onNavigate}
          />
        ) : (
          <NavLink
            item={{ to: "/settings", label: "Configurações", icon: Settings }}
            isActive={location.pathname.startsWith("/settings")}
            onClick={onNavigate}
          />
        )}
      </div>

      {/* Separator */}
      <div className="mx-4 mb-2 h-px bg-sidebar-border" />

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
    </>
  );
}

// ---------- Desktop sidebar ----------

export function AppSidebar() {
  return (
    <aside className="hidden lg:flex w-60 shrink-0 flex-col bg-sidebar border-r border-sidebar-border sticky top-0 h-screen overflow-hidden">
      <div className="flex flex-col h-full overflow-hidden">
        <SidebarContent />
      </div>
    </aside>
  );
}
