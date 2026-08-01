import { Link, useLocation } from "react-router-dom";
import { useState, useEffect, useMemo, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useCompany } from "@/hooks/useCompany";
import { usePrefs } from "@/hooks/usePrefs";
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
  Inbox,
  Layers,
  FileDown,
  Banknote,
  Wrench,
  Star,
  Link2,
  Database,
  Check,
  HandCoins,
  FileSignature,
  Calculator,
  FolderArchive,
  BookOpenCheck,
  PanelLeftClose,
  PanelLeftOpen,
  Repeat,
  ArrowDownToLine,
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
      { to: "/consolidado", label: "DRE Consolidada", icon: Layers },
      { to: "/recorrencia", label: "Recorrência & Recompra", icon: Repeat },
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
      { to: "/contador", label: "Central do Contador", icon: FileDown },
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
      { to: "/pdv", label: "Frente de Caixa", icon: Banknote },
      { to: "/transactions", label: "Lançamentos", icon: ArrowLeftRight },
      { to: "/transfers", label: "Movimentações", icon: ArrowUpDown },
      { to: "/transfers?tab=anticipations", label: "Antecipações", icon: TrendingUp },
      { to: "/owner-transactions", label: "Sócio ↔ Empresa", icon: Scale },
      { to: "/bank-inbox", label: "Conciliação bancária", icon: Inbox },
      { to: "/repasses", label: "Repasses do gateway", icon: ArrowDownToLine },
      { to: "/inter", label: "Banco Inter (API direta)", icon: Landmark },
      { to: "/settings/bank-accounts", label: "Bancos & Open Finance", icon: Link2 },
    ],
  },
  {
    key: "importacoes",
    label: "Importações",
    icon: Inbox,
    personas: ["operacional", "tatico"],
    items: [
      { to: "/documents", label: "Scanner OCR", icon: ScanLine },
      { to: "/settings/integrations/contaazul", label: "Conta Azul", icon: Link2 },
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
      { to: "/products", label: "Produtos", icon: Package },
      { to: "/products?type=service", label: "Serviços", icon: Wrench },
      { to: "/sales", label: "Vendas", icon: ShoppingCart },
      { to: "/salespeople", label: "Vendedores", icon: UserCog },
      { to: "/purchases", label: "Compras", icon: ShoppingBag },
      { to: "/stock", label: "Estoque", icon: Warehouse },
    ],
  },
];

const settingsItem: NavItem = { to: "/settings", label: "Configurações", icon: Settings };

// Todos os destinos candidatos a "ativo" (inclui painel e configurações).
const ALL_TOS: string[] = [
  painel.to,
  ...sections.flatMap((s) => s.items.map((i) => i.to)),
  settingsItem.to,
];

// ---------- Helpers ----------

function visibleSections(persona: Persona): NavGroup[] {
  if (persona === "completo") return sections;
  return sections.filter((s) => s.personas.includes(persona));
}

/**
 * Pontua quanto um destino casa com a rota atual. O prefixo "/fiscal" casava
 * com "/fiscal/arquivos" E "/fiscal/impostos" ao mesmo tempo, acendendo vários
 * itens. Agora só o MAIS específico ganha: query exata > path exato > prefixo.
 */
function scoreMatch(to: string, pathname: string, search: string): number {
  const qIdx = to.indexOf("?");
  const toPath = qIdx === -1 ? to : to.slice(0, qIdx);
  const toQuery = qIdx === -1 ? "" : to.slice(qIdx + 1);
  if (toQuery) {
    if (pathname !== toPath) return -1;
    const atual = new URLSearchParams(search);
    const alvo = new URLSearchParams(toQuery);
    for (const [k, v] of alvo) if (atual.get(k) !== v) return -1;
    return toPath.length + 2000; // destino com query vence tudo
  }
  if (pathname === toPath) return toPath.length + 1000; // match exato de path
  if (pathname.startsWith(toPath + "/")) return toPath.length; // prefixo
  return -1;
}

/** O ÚNICO destino ativo para a rota atual (o de maior pontuação). */
function computeActiveTo(pathname: string, search: string): string | null {
  let best: string | null = null;
  let bestScore = -1;
  for (const to of ALL_TOS) {
    const s = scoreMatch(to, pathname, search);
    if (s > bestScore) {
      bestScore = s;
      best = to;
    }
  }
  return best;
}

function groupKeyOfTo(to: string | null): string | null {
  if (!to) return null;
  return sections.find((s) => s.items.some((i) => i.to === to))?.key ?? null;
}

// ---------- Components ----------

function NavLink({
  item,
  isActive,
  onClick,
  isFav,
  onToggleFav,
}: {
  item: NavItem;
  isActive: boolean;
  onClick?: () => void;
  isFav?: boolean;
  onToggleFav?: (to: string) => void;
}) {
  return (
    <Link
      to={item.to}
      onClick={onClick}
      aria-current={isActive ? "page" : undefined}
      className={`group/nav flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-all duration-150 ${
        isActive
          ? "bg-sidebar-accent text-sidebar-primary font-semibold shadow-[inset_2px_0_0_hsl(var(--sidebar-primary))]"
          : "text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent"
      }`}
    >
      <item.icon
        className={`h-[18px] w-[18px] shrink-0 ${isActive ? "text-sidebar-primary" : ""}`}
        strokeWidth={1.5}
      />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {onToggleFav && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggleFav(item.to);
          }}
          aria-label={isFav ? `Remover ${item.label} dos favoritos` : `Favoritar ${item.label}`}
          className={`shrink-0 rounded p-0.5 transition-opacity ${
            isFav ? "opacity-100 text-sidebar-primary" : "opacity-0 group-hover/nav:opacity-60 hover:!opacity-100"
          }`}
        >
          <Star className="h-3 w-3" fill={isFav ? "currentColor" : "none"} strokeWidth={1.5} />
        </button>
      )}
    </Link>
  );
}

/** Ícone-botão do modo recolhido (com tooltip nativo pelo title). */
function RailLink({
  to,
  icon: Icon,
  label,
  isActive,
  onClick,
}: {
  to: string;
  icon: LucideIcon;
  label: string;
  isActive: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-current={isActive ? "page" : undefined}
      className={`flex h-10 w-10 items-center justify-center rounded-md transition-colors ${
        isActive
          ? "bg-sidebar-accent text-sidebar-primary shadow-[inset_2px_0_0_hsl(var(--sidebar-primary))]"
          : "text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent"
      }`}
    >
      <Icon className="h-[18px] w-[18px]" strokeWidth={1.5} />
    </Link>
  );
}

function NavGroupSection({
  group,
  activeTo,
  isOpen,
  onToggle,
  onNavigate,
  favoritos,
  onToggleFav,
}: {
  group: NavGroup;
  activeTo: string | null;
  isOpen: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
  favoritos?: string[];
  onToggleFav?: (to: string) => void;
}) {
  const hasActive = group.items.some((i) => i.to === activeTo);

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
              isActive={item.to === activeTo}
              onClick={onNavigate}
              isFav={favoritos?.includes(item.to)}
              onToggleFav={onToggleFav}
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
    <div className="via-persona-wrapper relative px-3 mb-2">
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

export function SidebarContent({
  onNavigate,
  collapsed = false,
  onSetCollapsed,
}: {
  onNavigate?: () => void;
  collapsed?: boolean;
  onSetCollapsed?: (v: boolean) => void;
}) {
  const location = useLocation();
  const { signOut } = useAuth();
  const { company } = useCompany();
  const { prefs, patch } = usePrefs();

  const favoritos = (prefs.favoritos ?? []) as string[];
  const toggleFav = (to: string) =>
    patch.mutate({
      favoritos: favoritos.includes(to) ? favoritos.filter((f) => f !== to) : [...favoritos, to],
    });
  const todosItens = sections.flatMap((s) => s.items);
  const itensFavoritos = favoritos
    .map((to) => todosItens.find((i) => i.to === to))
    .filter((i): i is NavItem => !!i);

  const [persona, setPersona] = useState<Persona>(() => {
    if (typeof window === "undefined") return "completo";
    return (localStorage.getItem(PERSONA_STORAGE_KEY) as Persona) || "completo";
  });

  const nav = visibleSections(persona);

  // Um único destino ativo (o mais específico) — some o bug de vários acesos.
  const activeTo = useMemo(
    () => computeActiveTo(location.pathname, location.search),
    [location.pathname, location.search],
  );
  const activeGroupKey = useMemo(() => groupKeyOfTo(activeTo), [activeTo]);

  const [openGroups, setOpenGroups] = useState<Set<string>>(
    () => new Set(activeGroupKey ? [activeGroupKey] : []),
  );

  // Auto-abre a seção da rota atual
  useEffect(() => {
    if (!activeGroupKey) return;
    setOpenGroups((prev) => (prev.has(activeGroupKey) ? prev : new Set([...prev, activeGroupKey])));
  }, [activeGroupKey]);

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

  // ---- Modo recolhido: só ícones ----
  if (collapsed) {
    const abrirNoGrupo = (key: string) => {
      onSetCollapsed?.(false);
      setOpenGroups(new Set([key]));
    };
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center gap-1 py-4">
        <img src={appIconWhite} alt="FinanceAI" className="via-sidebar-brand-icon mb-1 h-9 w-9 rounded-lg" />
        {onSetCollapsed && (
          <button
            onClick={() => onSetCollapsed(false)}
            title="Expandir menu"
            aria-label="Expandir menu"
            className="flex h-9 w-9 items-center justify-center rounded-md text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            <PanelLeftOpen className="h-[18px] w-[18px]" strokeWidth={1.5} />
          </button>
        )}
        <div className="via-nav-scroll mt-1 flex w-full flex-1 flex-col items-center gap-1 overflow-y-auto">
          <RailLink to={painel.to} icon={painel.icon} label={painel.label} isActive={activeTo === painel.to} onClick={onNavigate} />
          {itensFavoritos.length > 0 && <div className="my-1 h-px w-6 bg-sidebar-border" />}
          {itensFavoritos.map((item) => (
            <RailLink key={`fav-${item.to}`} to={item.to} icon={item.icon} label={item.label} isActive={item.to === activeTo} onClick={onNavigate} />
          ))}
          <div className="my-1 h-px w-6 bg-sidebar-border" />
          {nav.map((group) => {
            const hasActive = group.items.some((i) => i.to === activeTo);
            return (
              <button
                key={group.key}
                onClick={() => abrirNoGrupo(group.key)}
                title={group.label}
                aria-label={group.label}
                className={`flex h-10 w-10 items-center justify-center rounded-md transition-colors ${
                  hasActive
                    ? "bg-sidebar-accent text-sidebar-primary shadow-[inset_2px_0_0_hsl(var(--sidebar-primary))]"
                    : "text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent"
                }`}
              >
                <group.icon className="h-[18px] w-[18px]" strokeWidth={1.5} />
              </button>
            );
          })}
        </div>
        <div className="mt-auto flex w-full flex-col items-center gap-1 pt-1">
          <div className="my-1 h-px w-6 bg-sidebar-border" />
          <RailLink to={settingsItem.to} icon={settingsItem.icon} label={settingsItem.label} isActive={activeTo === settingsItem.to} onClick={onNavigate} />
          <button
            onClick={signOut}
            title="Sair"
            aria-label="Sair"
            className="flex h-10 w-10 items-center justify-center rounded-md text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-expense"
          >
            <LogOut className="h-[18px] w-[18px]" strokeWidth={1.5} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Logo */}
      <div className="p-5 pb-4">
        <div className="flex items-center gap-3">
          <img src={appIconWhite} alt="Viver de IA" className="via-sidebar-brand-icon h-9 w-9 rounded-lg" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold tracking-[-0.02em] text-sidebar-foreground">
              FinanceAI
            </h1>
            <div className="mt-0.5 flex items-center gap-1.5">
              <Pill size="sm" className="via-sidebar-pill">ERP financeiro</Pill>
              <span className="sr-only">por Viver de IA</span>
            </div>
          </div>
          {onSetCollapsed && (
            <button
              onClick={() => onSetCollapsed(true)}
              title="Recolher menu"
              aria-label="Recolher menu"
              className="hidden h-7 w-7 shrink-0 items-center justify-center rounded-md text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground lg:flex"
            >
              <PanelLeftClose className="h-4 w-4" strokeWidth={1.5} />
            </button>
          )}
        </div>
      </div>

      {/* Seletor de perfil */}
      <PersonaSelector persona={persona} onChange={changePersona} />

      {/* Navigation */}
      <nav className="via-nav-scroll flex-1 min-h-0 px-3 space-y-0.5 overflow-y-auto">
        <NavLink
          item={painel}
          isActive={activeTo === painel.to}
          onClick={onNavigate}
        />
        {itensFavoritos.length > 0 && (
          <div className="pb-1">
            <div className="flex items-center gap-2 px-3 pb-1 pt-2 text-[10px] font-medium uppercase tracking-[0.1em] text-sidebar-muted">
              <Star className="h-3 w-3" strokeWidth={1.5} /> Favoritos
            </div>
            {itensFavoritos.map((item) => (
              <NavLink
                key={`fav-${item.to}`}
                item={item}
                isActive={item.to === activeTo}
                onClick={onNavigate}
                isFav
                onToggleFav={toggleFav}
              />
            ))}
          </div>
        )}
        {nav.map((group) => (
          <NavGroupSection
            key={group.key}
            group={group}
            activeTo={activeTo}
            isOpen={openGroups.has(group.key)}
            onToggle={() => toggleGroup(group.key)}
            onNavigate={onNavigate}
            favoritos={favoritos}
            onToggleFav={toggleFav}
          />
        ))}
      </nav>

      {/* Settings — fixed at bottom */}
      <div className="mx-4 mt-2 h-px bg-sidebar-border" />
      <div className="px-3 py-2">
        <NavLink
          item={settingsItem}
          isActive={activeTo === settingsItem.to}
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

// ---------- Desktop sidebar (redimensionável + recolhível) ----------

const SIDEBAR_MIN = 208;
const SIDEBAR_MAX = 420;
const SIDEBAR_DEFAULT = 240;
const SIDEBAR_RAIL = 68;
const WIDTH_KEY = "cfo:sidebar-width";
const COLLAPSED_KEY = "cfo:sidebar-collapsed";

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(COLLAPSED_KEY) === "1";
  });
  const [width, setWidth] = useState<number>(() => {
    if (typeof window === "undefined") return SIDEBAR_DEFAULT;
    const w = Number(localStorage.getItem(WIDTH_KEY));
    return w >= SIDEBAR_MIN && w <= SIDEBAR_MAX ? w : SIDEBAR_DEFAULT;
  });
  const draggingRef = useRef(false);
  const widthRef = useRef(width);
  widthRef.current = width;

  const persistCollapsed = (v: boolean) => {
    setCollapsed(v);
    try { localStorage.setItem(COLLAPSED_KEY, v ? "1" : "0"); } catch { /* ignore */ }
  };

  const clamp = (w: number) => Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, w));

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!draggingRef.current) return;
      // A sidebar é o elemento mais à esquerda (x=0), então clientX ≈ largura.
      setWidth(clamp(e.clientX));
    };
    const onUp = () => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      try { localStorage.setItem(WIDTH_KEY, String(Math.round(widthRef.current))); } catch { /* ignore */ }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  const startDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    draggingRef.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  const onHandleKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      setWidth((w) => { const n = clamp(w - 16); try { localStorage.setItem(WIDTH_KEY, String(n)); } catch { /* ignore */ } return n; });
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      setWidth((w) => { const n = clamp(w + 16); try { localStorage.setItem(WIDTH_KEY, String(n)); } catch { /* ignore */ } return n; });
    }
  };

  return (
    <aside
      style={{ width: collapsed ? SIDEBAR_RAIL : width }}
      className="via-sidebar sticky top-0 hidden h-screen shrink-0 self-start flex-col overflow-hidden border-r border-sidebar-border bg-sidebar lg:flex relative"
      aria-label="Navegação principal"
    >
      <SidebarContent collapsed={collapsed} onSetCollapsed={persistCollapsed} />
      {!collapsed && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Redimensionar menu"
          aria-valuenow={width}
          aria-valuemin={SIDEBAR_MIN}
          aria-valuemax={SIDEBAR_MAX}
          tabIndex={0}
          onMouseDown={startDrag}
          onKeyDown={onHandleKey}
          className="via-sidebar-resizer absolute right-0 top-0 z-20 h-full w-2 cursor-col-resize focus:outline-none"
        />
      )}
    </aside>
  );
}
