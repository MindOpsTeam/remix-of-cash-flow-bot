
# Aplicar Design System Inspirado no Medium.com

## Visao Geral

Transformar toda a identidade visual do FinanceAI: sair do tema dark/glassmorphism atual para um design editorial limpo, tipografico e minimalista inspirado no Medium.com. A mudanca afeta cores, tipografia, espacamento, componentes base e todas as paginas.

## Etapa 1 - Fontes do Google Fonts

Adicionar no `index.html` as fontes:
- **Playfair Display** (titulos/headlines - serif)
- **Source Serif Pro** (corpo de texto - serif)
- **Inter** (interface/navegacao - sans-serif)

## Etapa 2 - CSS Variables e Tema (`src/index.css`)

Substituir todo o sistema de cores CSS variables:

**Light Mode (padrao):**
- `--background`: #F7F4ED (creme quente)
- `--foreground`: #242424 (texto principal)
- `--card`: #FFFFFF
- `--primary`: #1A8917 (verde accent)
- `--muted-foreground`: #6B6B6B
- `--border`: #E6E6E6
- `--destructive`: vermelho para erros
- `--secondary`: #F2F2F2

**Dark Mode:**
- `--background`: #121212
- `--foreground`: #E6E6E6
- `--card`: #1E1E1E
- `--primary`: #2ECC40

Remover todas as classes `glass-card`, `glass-card-premium`, `glow-border`, `glow-pulse`, `gradient-text`, `kpi-glow`, `score-ring` e substitui-las por estilos flat/clean.

Adicionar classes utilitarias novas:
- `.font-headline` (Playfair Display, serif)
- `.font-body` (Source Serif Pro, serif)
- `.font-ui` (Inter, sans-serif)

## Etapa 3 - Tailwind Config (`tailwind.config.ts`)

Atualizar:
- `fontFamily` com as 3 familias (headline, body, ui)
- Cores mapeadas para o novo sistema
- `borderRadius` padrao para valores menores (4px inputs, 20px botoes pill)
- Container max-width: 1192px

## Etapa 4 - Componentes Base (shadcn)

### Button (`src/components/ui/button.tsx`)
- Pill shape (border-radius: 20px) para todos os botoes
- Variante default: bg #242424, text white, hover #000
- Variante accent: bg #1A8917, text white, hover #0F7B0F
- Variante outline: border #242424, transparent bg
- Variante ghost: sem border, cor #6B6B6B
- Transicao: 150ms ease

### Card (`src/components/ui/card.tsx`)
- Sem shadow (flat)
- Background branco
- Border sutil #E6E6E6 ou apenas border-bottom #F2F2F2
- Sem arredondamento excessivo (border-radius: 8px max)

### Input (`src/components/ui/input.tsx`)
- Border: 1px solid #E6E6E6
- Border-radius: 4px
- Focus: border-color #242424
- Font-size: 16px
- Placeholder: #9B9B9B

### Dialog (`src/components/ui/dialog.tsx`)
- Overlay: rgba(0,0,0,0.54)
- Card: bg white, border-radius 4px, max-width 560px, padding 44px

### Badge (`src/components/ui/badge.tsx`)
- Pill shape (border-radius: 16px)
- Background: #F2F2F2, color: #242424
- Font-size: 13px, font-weight: 500

### Tooltip
- Background: #242424, color: white, border-radius: 4px

## Etapa 5 - AppSidebar (`src/components/AppSidebar.tsx`)

- Background: #FFFFFF
- Border-right: 1px solid #E6E6E6
- Logo em serif bold (Playfair Display)
- Links em sans-serif (Inter), 14px, font-weight 400
- Active state: font-weight 600, color #242424 (sem glow)
- Hover: opacity 0.7
- Mode switcher: estilo pill com cores flat
- Remover `glass-card`, `glow-border` da empresa ativa

## Etapa 6 - AppLayout (`src/components/AppLayout.tsx`)

- Container com max-width 1192px
- Padding: 40px lateral desktop, 24px mobile
- Background: #F7F4ED

## Etapa 7 - Paginas Principais

### Auth.tsx
- Background creme #F7F4ED
- Card branco, sem glass, sem glow
- Botao pill preto
- Titulos em serif

### Index.tsx (Dashboard)
- Titulo em serif (Playfair Display)
- KPICards: fundo branco, flat, sem sombra, sem glow
- Grafico: cores #1A8917 (receita) e #E53E3E (despesa)
- Remover animacoes excessivas (manter fade-in sutil)

### KPICard.tsx
- Fundo branco, border sutil
- Sem `glass-card-premium`, sem `hover:scale`, sem `glow-pulse`
- Icone em verde accent
- Texto em #242424

### FinancialScore.tsx
- Fundo branco, flat
- Remover `glass-card-premium`, `score-ring`
- Anel SVG com cores flat

### TransactionRow.tsx
- Sem background, border-bottom #F2F2F2
- Hover: background #F7F4ED sutil
- Valores em verde/vermelho flat

### Transactions.tsx, DRE, Reports, etc.
- Aplicar mesmo padrao: titulos serif, containers brancos flat, botoes pill

### PersonalDashboard.tsx, PersonalTransactions.tsx, PersonalAccounts.tsx
- Mesmo tratamento: cards brancos flat, tipografia editorial

### CFOChatWidget.tsx
- FAB: fundo #242424, sem glow-pulse
- Chat panel: fundo branco, sem glass
- Mensagens user: bg #242424
- Mensagens assistant: bg #F2F2F2

## Etapa 8 - Limpeza

- Remover `src/App.css` (estilos legados nao utilizados)
- Remover todas as classes glass/glow do CSS
- Manter animacoes sutis (fade-in 300ms, slide-up 400ms)
- Skeleton loading: gradiente #F2F2F2 para #E6E6E6

## Resumo Tecnico

**Arquivos a criar:** nenhum novo (apenas editar existentes)

**Arquivos a editar:**
- `index.html` (fontes Google)
- `src/index.css` (variaveis, classes utilitarias)
- `tailwind.config.ts` (fontes, cores, spacing)
- `src/components/ui/button.tsx`
- `src/components/ui/card.tsx`
- `src/components/ui/input.tsx`
- `src/components/ui/badge.tsx`
- `src/components/ui/dialog.tsx`
- `src/components/ui/tooltip.tsx`
- `src/components/AppSidebar.tsx`
- `src/components/AppLayout.tsx`
- `src/components/KPICard.tsx`
- `src/components/FinancialScore.tsx`
- `src/components/TransactionRow.tsx`
- `src/components/TransactionForm.tsx`
- `src/components/CFOChatWidget.tsx`
- `src/pages/Auth.tsx`
- `src/pages/Index.tsx`
- `src/pages/Transactions.tsx`
- `src/pages/personal/PersonalDashboard.tsx`
- `src/pages/personal/PersonalTransactions.tsx`
- `src/pages/personal/PersonalAccounts.tsx`
- Demais paginas (DRE, Reports, Settings, etc.)

**Arquivo a remover:** `src/App.css`

A mudanca e puramente visual -- nenhuma logica de negocio, hooks, rotas ou banco de dados sera alterada.
