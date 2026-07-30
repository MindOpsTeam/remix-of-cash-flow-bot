import { Link, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useCompany } from "@/hooks/useCompany";
import appIconWhite from "@/assets/via/app-icon-white.png";
import { Pill } from "@viverdeia/design-system";
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
  ArrowUpDown,
  Receipt,
  ScanLine,
  Scale,
  ChevronDown,
  Users,
  UserCog,
  Package,
  ShoppingCart,
  ShoppingBag,
  Warehouse,
  FileCheck,
  Calendar,
  type LucideIcon,
  Bot,
  CalendarCheck,
  Target,
  Compass,
  Briefcase,
  Zap,
  Landmark,
  Link2,
  Database,
  Check,
  HandCoins,
  FileSignature,
  Calculator,
  FolderArchive,
  BookOpenCheck,
} from "lucide-react";

// ---------- Personas (níveis de decisão do usuário do ERP) ----------

type Persona = "estrategico" | "tatico" | "operacional" | "completo";

const PERSONAS: { key: Persona; label: string; hint: string }[] = [
  { key: "completo", label: "Completo", hint: "todas as áreas" },
  { key: "estrategico", label: "Estratégico", hint: "visão e decisão" },
  { key: "tatico", label: "Tático", hint: "gestão e controle" },
  { key: "operacional", label: "Operacional", hint: "execução do dia a dia" },
];

const PERSONA_STORAGE_KEY = "cfo:nav-persona";

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
  /** Perfis que enxergam esta seção (além de "completo", que vê tudo). */
  personas: Exclude<Persona, "completo">[];
  items: NavItem[];
}

// ---------- Navigation structure (por nível de decisão) ----------

const painel: NavItem = { to: "/dashboard", label: "Painel", icon: LayoutDashboard };

const sections: NavGroup[] = [
  {
    key: "visao",
    label: "Visão",
    icon: Compass,
    personas: ["estrategico", "tatico"],
    items: [
      { to: "/dre", label: "DRE", icon: FileBarChart2 },
      { to: "/budget", label: "Orçamento × Realizado", icon: Target },
      { to: "/forecast", label: "Previsão de Caixa", icon: TrendingUp },
      { to: "/summary", label: "Resumo Executivo", icon: FileText },
    ],
  },
  {
    key: "inteligencia",
    label: "Inteligência",
    icon: Brain,
    personas: ["estrategico", "tatico"],
    items: [
      { to: "/cfo-digital", label: "CFO Digital", icon: Brain },
      { to: "/agents", label: "Agentes", icon: Bot },
      { to: "/simulator", label: "Simulador “E se?”", icon: FlaskConical },
      { to: "/whatsapp", label: "WhatsApp", icon: MessageSquare },
    ],
  },
  {
    key: "gestao",
    label: "Gestão",
    icon: Briefcase,
    personas: ["tatico"],
    items: [
      { to: "/close", label: "Fechamento Mensal", icon: CalendarCheck },
      { to: "/fiscal/contas-a-pagar", label: "Contas a Pagar", icon: Receipt },
      { to: "/receivables", label: "Contas a Receber", icon: HandCoins },
      { to: "/reports", label: "Relatórios", icon: PieChart },
      { to: "/settings/consolidation", label: "Consolidação do Grupo", icon: Scale },
    ],
  },
  {
    key: "contabil",
    label: "Contábil",
    icon: Calculator,
    personas: ["estrategico", "tatico"],
    items: [
      { to: "/reforma", label: "Simulador da Reforma", icon: Scale },
      { to: "/reforma/impacto", label: "Cadeia de crédito B2B", icon: Link2 },
      { to: "/fiscal", label: "Notas Fiscais", icon: FileCheck },
      { to: "/fiscal/impostos", label: "Calendário de Impostos", icon: Calendar },
      { to: "/auditoria", label: "Auditoria", icon: BookOpenCheck },
      { to: "/fiscal/arquivos", label: "Arquivos Fiscais", icon: FolderArchive },
    ],
  },
  {
    key: "operacao",
    label: "Operação",
    icon: Zap,
    // Lançamentos mora aqui. Deixar só "operacional" removia da navegação do
    // dono da empresa a única tela que registra dinheiro.
    personas: ["operacional", "tatico", "estrategico"],
    items: [
      { to: "/transactions", label: "Lançamentos", icon: ArrowLeftRight },
      { to: "/transfers", label: "Movimentações", icon: ArrowUpDown },
      { to: "/owner-transactions", label: "Sócio ↔ Empresa", icon: Scale },
      { to: "/documents", label: "Scanner OCR", icon: ScanLine },
      { to: "/inter", label: "Conciliação Bancária", icon: Landmark },
      { to: "/settings/bank-accounts", label: "Bancos & Open Finance", icon: Link2 },
    ],
  },
  {
    key: "cadastros",
    label: "Cadastros",
    icon: Database,
    personas: ["operacional"],
    items: [
      { to: "/contacts", label: "Clientes / Fornecedores", icon: Users },
      { to: "/contracts", label: "Contratos", icon: FileSignature },
      { to: "/products", label: "Produtos / Serviços", icon: Package },
      { to: "/sales", label: "Vendas", icon: ShoppingCart },
      { to: "/salespeople", label: "Vendedores", icon: UserCog },
      { to: "/purchases", label: "Compras", icon: ShoppingBag },
      { to: "/stock", label: "Estoque", icon: Warehouse },
    ],
  },
];

// ---------- Helpers ----------

function visibleSections(persona: Persona): NavGroup[] {
  if (persona === "completo") return sections;
  return sections.filter((s) => s.personas.includes(persona));
}

function getActiveGroup(nav: NavGroup[], pathname: string): string | null {
  for (const entry of nav) {
    if (entry.items.some((i) => pathname === i.to || pathname.startsWith(i.to + "/"))) {
      return entry.key;
    }
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
      aria-current={isActive ? "page" : undefined}
      className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-all duration-150 ${
        isActive
          ? "bg-sidebar-accent text-sidebar-primary font-semibold shadow-[inset_2px_0_0_hsl(var(--sidebar-primary))]"
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
  const hasActive = group.items.some((i) => pathname === i.to || pathname.startsWith(i.to + "/"));

  return (
    <div>
      <button
        onClick={onToggle}
        aria-expanded={isOpen}
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
          isOpen ? "max-h-[28rem] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="ml-3 pl-3 border-l border-sidebar-border space-y-0.5 mt-0.5 mb-1">
          {group.items.map((item) => (
            <NavLink
              key={item.to}
              item={item}
              isActive={pathname === item.to || pathname.startsWith(item.to + "/")}
              onClick={onNavigate}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function PersonaSelector({ persona, onChange }: { persona: Persona; onChange: (p: Persona) => void }) {
  const [open, setOpen] = useState(false);
  const current = PERSONAS.find((p) => p.key === persona) ?? PERSONAS[0];

  return (
    <div className="relative px-3 mb-2">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 rounded-md border border-sidebar-border bg-sidebar-accent/60 px-3 py-2 text-left shadow-[inset_0_1px_0_var(--via-edge-hi)] transition-all duration-150 hover:border-sidebar-primary/20 hover:bg-sidebar-accent"
      >
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-sidebar-muted">Perfil</div>
          <div className="text-[13px] font-medium text-sidebar-foreground truncate">{current.label}</div>
        </div>
        <ChevronDown className={`h-4 w-4 shrink-0 text-sidebar-muted transition-transform ${open ? "rotate-180" : ""}`} strokeWidth={1.5} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-3 right-3 z-20 mt-1 overflow-hidden rounded-md border border-sidebar-border bg-sidebar shadow-lg">
            {PERSONAS.map((p) => (
              <button
                key={p.key}
                onClick={() => { onChange(p.key); setOpen(false); }}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-sidebar-accent ${
                  p.key === persona ? "text-sidebar-primary" : "text-sidebar-foreground"
                }`}
              >
                <div className="flex-1">
                  <div className="font-medium">{p.label}</div>
                  <div className="text-[11px] text-sidebar-muted">{p.hint}</div>
                </div>
                {p.key === persona && <Check className="h-4 w-4 shrink-0" strokeWidth={2} />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ---------- Sidebar content (shared between desktop and mobile) ----------

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation();
  const { signOut } = useAuth();
  const { company } = useCompany();

  const [persona, setPersona] = useState<Persona>(() => {
    if (typeof window === "undefined") return "completo";
    return (localStorage.getItem(PERSONA_STORAGE_KEY) as Persona) || "completo";
  });

  const nav = visibleSections(persona);

  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    const active = getActiveGroup(sections, location.pathname);
    return new Set(active ? [active] : []);
  });

  // Auto-abre a seção da rota atual
  useEffect(() => {
    const active = getActiveGroup(sections, location.pathname);
    if (!active) return;
    setOpenGroups((prev) => prev.has(active) ? prev : new Set([...prev, active]));
  }, [location.pathname]);

  const changePersona = (p: Persona) => {
    setPersona(p);
    try { localStorage.setItem(PERSONA_STORAGE_KEY, p); } catch { /* ignore */ }
    // Ao trocar de perfil, abre a primeira seção visível para orientar
    const first = visibleSections(p)[0];
    if (first) setOpenGroups(new Set([first.key]));
  };

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
          <img src={appIconWhite} alt="Viver de IA" className="via-sidebar-brand-icon h-9 w-9 rounded-lg" />
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold tracking-[-0.02em] text-sidebar-foreground">
              FinanceAI
            </h1>
            <div className="mt-0.5 flex items-center gap-1.5">
              <Pill size="sm" className="via-sidebar-pill">ERP financeiro</Pill>
              <span className="sr-only">por Viver de IA</span>
            </div>
          </div>
        </div>
      </div>

      {/* Seletor de perfil */}
      <PersonaSelector persona={persona} onChange={changePersona} />

      {/* Navigation */}
      <nav className="flex-1 min-h-0 px-3 space-y-0.5 overflow-y-auto">
        <NavLink
          item={painel}
          isActive={location.pathname === painel.to}
          onClick={onNavigate}
        />
        {nav.map((group) => (
          <NavGroupSection
            key={group.key}
            group={group}
            pathname={location.pathname}
            isOpen={openGroups.has(group.key)}
            onToggle={() => toggleGroup(group.key)}
            onNavigate={onNavigate}
          />
        ))}
      </nav>

      {/* Settings — fixed at bottom */}
      <div className="mx-4 mt-2 h-px bg-sidebar-border" />
      <div className="px-3 py-2">
        <NavLink
          item={{ to: "/settings", label: "Configurações", icon: Settings }}
          isActive={location.pathname.startsWith("/settings") && !location.pathname.startsWith("/settings/consolidation") && !location.pathname.startsWith("/settings/bank-accounts")}
          onClick={onNavigate}
        />
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
      {company && (
        <div className="via-sidebar-company mx-3 mb-4 rounded-md p-3">
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
    <aside
      className="via-sidebar sticky top-0 hidden h-screen w-60 shrink-0 flex-col overflow-hidden border-r border-sidebar-border bg-sidebar lg:flex"
      aria-label="Navegação principal"
    >
      <div className="flex flex-col h-full overflow-hidden">
        <SidebarContent />
      </div>
    </aside>
  );
}
