
# Design System Premium - ERP Financeiro de Alto Valor

## Visao Geral

Redesign completo do FinanceAI para parecer um produto finalizado, premium, inspirado em Mercury/Brex/Linear. Sidebar escura, conteudo claro, tipografia com monospace para valores financeiros, sombras sutis, cores funcionais sofisticadas (indigo como accent, emerald para receita, rose para despesa), e elementos de inovacao como sparklines nos KPIs, AI Insight card, greeting contextual, e Command Palette (Cmd+K).

---

## Fase 1 - Fundacao (Fontes, CSS Variables, Tailwind)

### index.html
- Substituir fontes: remover Playfair Display e Source Serif 4
- Adicionar: Inter (400-700) + JetBrains Mono (400-700)
- Adicionar `font-feature-settings: 'cv02','cv03','cv04','cv11'` no body

### src/index.css
Substituir TODAS as CSS variables:

**Light Mode:**
- `--background`: #FAFAF8
- `--foreground`: #1A1A1A
- `--card`: #FFFFFF
- `--card-foreground`: #1A1A1A
- `--popover`: #FFFFFF
- `--popover-foreground`: #1A1A1A
- `--primary`: #6366F1 (indigo-500)
- `--primary-foreground`: #FFFFFF
- `--secondary`: #F4F4F5
- `--secondary-foreground`: #1A1A1A
- `--muted`: #F4F4F5
- `--muted-foreground`: #71717A
- `--accent`: #F4F4F5
- `--accent-foreground`: #1A1A1A
- `--destructive`: #F43F5E (rose-500)
- `--destructive-foreground`: #FFFFFF
- `--border`: #E4E4E7
- `--input`: transparent (borda transparente por padrao)
- `--ring`: #6366F1
- `--revenue`: #10B981 (emerald-500)
- `--expense`: #F43F5E (rose-500)
- `--warning`: #F59E0B (amber-500)
- `--info`: #6366F1
- `--sidebar-background`: #111113
- `--sidebar-foreground`: #E4E4E7
- `--sidebar-muted`: #71717A
- `--sidebar-primary`: #818CF8
- `--sidebar-accent`: #1E1E21
- `--sidebar-border`: #27272A

**Dark Mode:**
- `--background`: #0A0A0B
- `--foreground`: #E4E4E7
- `--card`: #18181B
- `--primary`: #818CF8
- `--border`: #27272A
- `--revenue`: #34D399
- `--expense`: #FB7185

Adicionar classes utilitarias:
- `.font-mono` para valores financeiros (JetBrains Mono)
- `.shadow-card`, `.shadow-card-hover`, `.shadow-dropdown`, `.shadow-modal`
- Remover `.font-headline`, `.font-body` (nao usamos mais serif)

### tailwind.config.ts
- Atualizar `fontFamily`: ui (Inter), mono (JetBrains Mono)
- Remover familias serif (headline, body)
- Atualizar `borderRadius`: `lg: 12px`, `md: 8px`, `sm: 6px`
- Adicionar cores: `info`, `warning`, `sidebar` com todas as sub-chaves
- Container max-width: 1400px
- Adicionar keyframes para `slide-up`, `count-up`

---

## Fase 2 - Componentes Base (shadcn customizado)

### Button (src/components/ui/button.tsx)
- `border-radius: 8px` (nao mais pill)
- Default: bg indigo-500, text white, hover indigo-600, shadow colorida no hover
- Outline: border zinc-200, bg white, hover zinc-50
- Ghost: transparente, text zinc-500, hover bg zinc-100
- Destructive: bg rose-50, text rose-600, border rose-200
- Active: `transform: scale(0.98)` por 100ms
- Transicao: `all 0.15s cubic-bezier(0.4, 0, 0.2, 1)`

### Card (src/components/ui/card.tsx)
- `border-radius: 12px`
- `box-shadow: 0 1px 2px rgba(0,0,0,0.03), 0 1px 3px rgba(0,0,0,0.04)`
- Hover: `border-color: zinc-300, shadow: 0 4px 12px rgba(0,0,0,0.05), translateY(-1px)`
- Transicao suave

### Input (src/components/ui/input.tsx)
- `background: #F5F5F3`
- `border: 1px solid transparent`
- `border-radius: 8px`
- Focus: `bg white, border indigo-500, shadow: 0 0 0 3px rgba(99,102,241,0.1)`
- Placeholder: zinc-400

### Badge (src/components/ui/badge.tsx)
- `border-radius: 6px`
- Variantes: success (emerald bg/border), destructive (rose bg/border), info (indigo bg/border), neutral (zinc bg/border)
- Font-size: 12px, font-weight: 500

### Dialog (src/components/ui/dialog.tsx)
- Overlay: `rgba(0,0,0,0.54)` com backdrop-blur leve
- Card: `border-radius: 12px, shadow-modal`

### Tooltip (src/components/ui/tooltip.tsx)
- Background: #111113, color: #E4E4E7, border-radius: 8px

### Sonner (src/components/ui/sonner.tsx)
- Position: bottom-right
- Background: #111113, color: #E4E4E7, border-radius: 12px
- Shadow: `0 8px 30px rgba(0,0,0,0.15)`

### Select (src/components/ui/select.tsx)
- Trigger: mesmas regras do Input (bg cinza, border transparente, focus indigo)
- Content: shadow-dropdown

---

## Fase 3 - Sidebar Escura (src/components/AppSidebar.tsx)

Redesign completo:
- Background: #111113 (quase-preto frio)
- Width: 240px
- Logo: Inter bold 16px, branco, subtitulo "ERP Financeiro" 11px zinc-500
- Mode switcher: tabs com bg #1E1E21, tab ativa #27272A branco, inativa zinc-500
- Nav items: 14px, icones 18px stroke-width 1.5, color zinc-500
  - Hover: bg #1E1E21, color zinc-200
  - Active: bg `rgba(99,102,241,0.12)`, color #818CF8, font-weight 500, icone #818CF8
- Separador: 1px solid #27272A
- Empresa ativa: card bg #1E1E21, radius 8px, label 11px zinc-500, nome 13px zinc-200
- Botao Sair: zinc-500, hover rose-500

---

## Fase 4 - AppLayout (src/components/AppLayout.tsx)

- Background: usa var(--background) = #FAFAF8
- Conteudo: max-width 1400px, padding 32px 40px
- Transicao de pagina: fade-in suave no children

---

## Fase 5 - KPICard Redesign (src/components/KPICard.tsx)

- Card branco, border zinc-200, radius 12px, shadow-card
- Hover: translateY(-1px), shadow-card-hover, border zinc-300
- Estrutura:
  - Label: 14px, zinc-500 (ACIMA do valor)
  - Icone: 20px, zinc-400, canto superior direito
  - Valor: 32px, font-weight 700, JetBrains Mono, letter-spacing -0.03em
    - Cor contextual: verde para receita, rose para despesa, foreground para neutro
  - Badge de variacao: seta colorida + "12.4%" + "vs mes anterior" em 11px zinc-400
- Animacao count-up mantida

---

## Fase 6 - Novo Componente: AI Insight Card

Criar em `src/components/AIInsightCard.tsx`:
- Border-left: 3px solid indigo-500
- Background: gradiente sutil de indigo-50 para branco
- Icone sparkle em indigo
- Titulo: "Insight da IA" 14px, font-weight 600, indigo-500
- Texto: insight financeiro, 14px, line-height 1.6, zinc-700
- CTA: "Ver analise completa ->" em 13px, indigo-500, sem background
- Animacao: fade + slide-up 300ms

---

## Fase 7 - Paginas Principais

### Index.tsx (Dashboard)
- Greeting contextual: "Bom dia, [nome]" baseado na hora + subtitulo contextual
- KPI grid: 4 colunas desktop
- AI Insight Card abaixo dos KPIs
- Chart tooltip: bg #111113, text zinc-200, radius 8px
- Grid lines: zinc-100
- Cores do chart: indigo para receita, rose para despesa

### PersonalDashboard.tsx
- Mesmo greeting contextual
- Cards KPI com valores em monospace
- Cores emerald/rose para receita/despesa
- Empty state com emoji + texto encorajador

### Auth.tsx
- Background #FAFAF8
- Card branco, radius 12px, shadow-card
- Logo + nome em Inter bold
- Inputs com bg cinza, focus indigo
- Botao primario indigo

### Transactions.tsx
- Tabela com header bg #FAFAF8, uppercase 12px zinc-500, letter-spacing 0.05em
- Rows: hover bg #FAFAF8
- Valores em monospace, alinhados a direita
- Acoes aparecem no hover com transicao de opacity

### TransactionRow.tsx
- Valores em `font-mono`
- Hover bg background (#FAFAF8)
- Icones de fonte com cor contextual

### TransactionForm.tsx
- Inputs com bg #F5F5F3, border transparente
- Focus: border indigo, ring shadow
- Botao primario: indigo

### DRE.tsx, Reports.tsx
- Headers de tabela estilizados (uppercase, zinc-500, 12px)
- Chart tooltip escuro

### CashFlowForecast.tsx, ExecutiveSummary.tsx, Simulator.tsx, CFODigital.tsx
- Aplicar mesmo padrao de cards, tipografia, cores
- Chart tooltip escuro

### Settings.tsx, ChartOfAccounts.tsx, CostCenters.tsx, Integrations.tsx
- Cards com hover translateY(-1px)
- Inputs com novo estilo

### PersonalTransactions.tsx, PersonalAccounts.tsx
- Valores em monospace
- Cores emerald/rose

### FinancialScore.tsx
- Card com shadow-card
- Ring SVG com cores do novo tema

### CFOChatWidget.tsx
- FAB: bg #111113, sem glow
- Chat panel: bg branco, radius 12px, shadow-dropdown
- Mensagem user: bg indigo-500
- Mensagem assistant: bg zinc-100
- Input: bg #F5F5F3

---

## Fase 8 - Elementos de Inovacao

### Greeting contextual (Index.tsx, PersonalDashboard.tsx)
```
const hour = new Date().getHours();
const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
// Usar user.email ou user.user_metadata.name
```

### Skeleton Loading (src/components/ui/skeleton.tsx)
- Animacao pulse com cores zinc-100 para zinc-200
- Usar em todas as paginas com loading state (substituir Loader2 spinner)

### Empty States
- Emoji grande + texto encorajador + botao CTA
- Aplicar em Transactions, PersonalTransactions, PersonalAccounts

---

## Resumo de Arquivos

**Arquivos a editar (29):**
- `index.html`
- `src/index.css`
- `tailwind.config.ts`
- `src/components/ui/button.tsx`
- `src/components/ui/card.tsx`
- `src/components/ui/input.tsx`
- `src/components/ui/badge.tsx`
- `src/components/ui/dialog.tsx`
- `src/components/ui/tooltip.tsx`
- `src/components/ui/sonner.tsx`
- `src/components/ui/select.tsx`
- `src/components/ui/skeleton.tsx`
- `src/components/AppSidebar.tsx`
- `src/components/AppLayout.tsx`
- `src/components/KPICard.tsx`
- `src/components/FinancialScore.tsx`
- `src/components/TransactionRow.tsx`
- `src/components/TransactionForm.tsx`
- `src/components/CFOChatWidget.tsx`
- `src/components/cfo/CFODashboard.tsx`
- `src/pages/Auth.tsx`
- `src/pages/Index.tsx`
- `src/pages/Transactions.tsx`
- `src/pages/DRE.tsx`
- `src/pages/Reports.tsx`
- `src/pages/CashFlowForecast.tsx`
- `src/pages/ExecutiveSummary.tsx`
- `src/pages/Simulator.tsx`
- `src/pages/CFODigital.tsx`
- `src/pages/WhatsAppAgent.tsx`
- `src/pages/Settings.tsx`
- `src/pages/settings/ChartOfAccounts.tsx`
- `src/pages/settings/CostCenters.tsx`
- `src/pages/settings/Integrations.tsx`
- `src/pages/personal/PersonalDashboard.tsx`
- `src/pages/personal/PersonalTransactions.tsx`
- `src/pages/personal/PersonalAccounts.tsx`

**Arquivos a criar (1):**
- `src/components/AIInsightCard.tsx`

**Nenhuma alteracao de logica, hooks, rotas ou banco de dados.** Mudanca puramente visual + componente de insight decorativo.
