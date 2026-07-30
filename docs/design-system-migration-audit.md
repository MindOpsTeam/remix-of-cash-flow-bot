# Migração Viver de IA DS → FinanceAI

Data da auditoria: 2026-07-30

## 1. Repositórios e versões comprovadas

| Papel | Caminho / origem | Evidência |
|---|---|---|
| ERP canônico | `/Users/barboza/remix-of-cash-flow-bot` | `origin` = `MindOpsTeam/remix-of-cash-flow-bot`, `main`, SHA local/remoto `495b33ab33ee8092bfff843d15d51604222db31f` antes da migração |
| Cópia descartada | `/Users/barboza/code/mindops/remix-of-cash-flow-bot` | SHA `f657eab…`, meses atrás e `ahead 1`; não recebeu alterações |
| Design system | `rafaelmilagre7/viver-de-ia-ds` | `main`, SHA `874ae88b11f02361a17bf4924200d56d43464334`, versão `0.6.1` |
| Pacote consumido | `vendor/viver-de-ia-design-system` | `bun run build:lib` no SHA acima; pacote local reproduzível `@viverdeia/design-system@0.6.1` |

## 2. Inventário integral

### FinanceAI antes da migração

- React 18.3, Vite 5.4, TypeScript 5.8, Tailwind 3.4.
- 160 arquivos TSX, 55 páginas e 48 primitives `src/components/ui`.
- Radix/shadcn em formulários, dialogs, sheets, menus, tabelas e toasts.
- 400 utilities de paletas externas ao DS em `src` (amber/yellow/orange, purple/violet/cyan/sky, blues decorativos, reds/greens Tailwind).
- 18 referências ao ícone `Sparkles`.
- Login isolado com Poppins, gradiente lilás, CSS inline e cores hardcoded.
- Logo/favicons legados do FinanceAI sem os assets canônicos da Viver de IA.

### Design system incorporado

- 188 tokens gerados de `tokens.css`.
- 46 componentes UI + `ThemeProvider`, com bundles ESM/CJS, tipos, CSS completo e token JSON.
- Componentes incluídos:
  `Button`, `Pill`, `Card`, `Input`, `Avatar`, `Icon`, `ToastStack`, `Tooltip`,
  `Modal`, `Tabs`, `Switch`, `Checkbox`, `RadioGroup`, `Select`, `Progress`,
  `Drawer`, `Spinner`, `Skeleton`, `Breadcrumb`, `Pagination`, `Accordion`,
  `Stepper`, `EmptyState`, `Combobox`, `DropdownMenu`, `Popover`, `Command`,
  `DatePicker`, `Slider`, `Alert`, `DataTable`, `HoverCard`, `OTPInput`,
  `TagInput`, `Calendar`, `Carousel`, `TimePicker`, `Sheet`, `ContextMenu`,
  `MultiSelect`, `DateRangePicker`, `TreeView`, `Splitter`, `VirtualList`,
  `Lightbox` e `ColorPicker`.
- 15 assets oficiais de marca disponíveis em `public/brand/viver-de-ia`, além dos
  lockups usados pelo app em `src/assets/via`.
- Favicon PNG + ICO, PWA 192/512 px, Apple touch icon 180 px, app icon,
  monogramas e wordmarks navy/white.
- Geist e Geist Mono variáveis, normal/italic, servidas localmente com a licença
  original; nenhuma dependência de Google Fonts em runtime.
- Motion tokens, liquid glass, mesh, sombras, raios, tipografia Geist e temas
  claro/escuro.

## 3. Matriz de riscos destrutivos e solução aplicada

| Risco | Impacto se migrado de forma direta | Solução de compatibilidade |
|---|---|---|
| DS desenvolve em React 19/Vite 8; ERP usa React 18/Vite 5 | Upgrade de runtime poderia quebrar Radix, hooks e build | Consumir o bundle da library, cujos peers declaram React `^18 || ^19` e cujo guia cobre Vite 5+. Nenhum upgrade do runtime do ERP |
| Substituir 48 primitives Radix por APIs próprias do DS | Quebra de `asChild`, refs, focus traps, controlled state e formulários | Manter comportamento Radix e aplicar tokens/forma/motion do DS; usar componentes DS diretamente onde a API é alinhada |
| Tokens do ERP são canais HSL; tokens `--via-*` usam hex/rgba/gradiente | `bg-primary/10` e outras opacidades deixariam de compilar | Ponte HSL em `src/index.css`, com cada papel apontando ao valor equivalente do DS |
| DS usa `[data-theme]`; Tailwind usava classe `.dark` | Tema escuro parcial ou flash de tema | `ThemeProvider`, bootstrap no `<head>` e `darkMode: ["selector", "[data-theme=\"dark\"]"]` |
| CSS global do DS pode colidir com páginas antigas | Tipografia/tamanhos inesperados | Ordem oficial: `tokens.css` → `style.css` → Tailwind/global → camada `via-theme.css`; classes de página continuam com maior especificidade |
| Paleta aberta codifica significado em 400 locais | Troca manual incompleta e regressão visual | Codemod idempotente `scripts/migrate-via-colors.mjs`; papéis `primary`, `warning`, `success`, `destructive` preservam semântica |
| Verde/coral usados como decoração | Viola a paleta e confunde status | Verde fica apenas em sucesso/receita real; coral apenas em erro, perda, atraso ou ação destrutiva; atenção vira navy/accent |
| Charts tinham roxo e laranja hardcoded | Visual fora da marca e contraste inconsistente | Série canônica `--via-data-1/2`, navy, success, coral e texto muted; eixos/grid usam tokens do DS |
| Login antigo concentrava CSS e animação própria | Maior ponto de ruptura visual e responsiva | Refatoração visual total mantendo handlers Supabase, validação, `next` seguro e mensagens |
| Troca de logo/favicon | Cache e referências antigas poderiam quebrar | Novos nomes (`favicon-via.*`) e manifest atualizado; arquivos legados preservados, portanto rollback é trivial |
| Animações podem afetar usuários sensíveis | Acessibilidade | Motion tokens do DS + override global de `prefers-reduced-motion` |
| Pacote completo aumenta CSS/bundle | Custo de download | Bundle JS segue tree-shaking; CSS integral é intencional para disponibilizar todos os 46 componentes. O warning de chunk >500 kB já existia antes da migração |
| Manifesto do DS declara `UNLICENSED` | Publicar o pacote fora do ecossistema interno poderia criar risco de distribuição | Pacote mantido privado e vendorizado, sem publicação em registry. Confirmar autorização do proprietário antes de redistribuição externa; a licença OFL da Geist foi preservada junto aos arquivos |
| `package-lock.json` já divergia do `package.json` | Instalações npm não reproduziam o manifesto atual (`@lovable.dev/mcp-js` e `jspdf`) | Lock npm reconciliado junto com o pacote local do DS; `bun.lock` também atualizado e validado com `bun install --frozen-lockfile`. O `bun.lockb` legado foi preservado e o CI deve usar o lock textual atual |
| Auditoria npm aponta advisories anteriores à migração | Atualização automática poderia forçar Vite/Router majors e quebrar runtime, plugins e rotas | Não executar `npm audit fix` às cegas. Tratar em mudança separada: PostCSS acima de `8.5.17`; matriz Vite 7+/plugin SWC/Lovable; migração React Router 6→7; acompanhar `@lovable.dev/mcp-js`, que ainda não oferece fix no advisory atual |
| Mudança visual tocar dados/rotas | Risco funcional alto | Nenhuma migration Supabase, edge function, schema, hook financeiro ou rota de produção foi alterada |

## 4. Estratégia de adoção por família

| Família | Modo de adoção |
|---|---|
| Fundação/tema | Direto: `ThemeProvider`, `useTheme`, tokens, CSS completo, Geist, assets e motion |
| Marca e shell | Direto: app icon/wordmark, favicon, sidebar, topbar, mobile sheet e tema |
| Feedback simples | Direto quando seguro: `EmptyState`, `Spinner`, `Icon`, `Pill`; toasts existentes recebem skin semântica |
| Botões, inputs, cards, badges e tabelas | Primitives existentes preservadas; anatomia, tokens, raios, sombras, focus e motion alinhados ao DS |
| Dialog, sheet, menu, popover, tooltip, tabs, checkbox, switch e select | Radix preservado para manter focus/keyboard/controlled APIs; DS aplicado por tokens e classes |
| Componentes avançados sem equivalente já usado | Todos estão vendorizados, tipados e com CSS carregado; prontos para import nominal sem nova dependência |
| Gráficos e dados | Paleta `--via-data-*`, números tabulares Geist Mono, hairlines, estados semânticos e densidade preservada |

## 5. AIDesigner

- Prompt: referência de dashboard ERP light-first, editorial, denso, navy, liquid
  glass intencional, sem purple/cyan/gold/yellow ou sparkles.
- Run remoto: `3d8c0927-5a2f-4727-974a-e9a9ac6a16c2`.
- Run local:
  `.aidesigner/runs/2026-07-30T20-34-25-586Z-create-a-polished-production-dashboa/`.
- Preview: `preview.png`.
- Análise de adoção: `adoption.json`.
- Superfícies alvo: login, `AppLayout`, `AppSidebar`, topbar, dashboard,
  primitives e todas as páginas autenticadas que usam o shell.

## 6. Evidências finais

### Build, pacote e regressão funcional

- `bun install --frozen-lockfile`: passou, resolvendo
  `@viverdeia/design-system@vendor/viver-de-ia-design-system`.
- `bun run build`: passou com 4.209 módulos transformados.
- JavaScript principal: `523,34 kB / 156,77 kB gzip` antes e
  `551,20 kB / 164,75 kB gzip` depois. O aumento gzip foi de ~5,1%.
- CSS: `89,54 kB / 15,41 kB gzip` antes e
  `242,37 kB / 37,12 kB gzip` depois. O crescimento é a folha integral do DS,
  mantida de propósito para que nenhum dos 46 componentes fique sem estilo.
- Os quatro arquivos variáveis Geist/Geist Mono somam ~294 kB, são cacheáveis
  separadamente e substituem chamadas externas de fonte.
- O warning de chunk acima de 500 kB já existia no baseline. O único outro
  aviso de build é a base Browserslist desatualizada.
- Vitest: 17 arquivos, 154 testes, todos aprovados. Dois deles validam
  nominalmente os 46 exports, `ThemeProvider` e os 188 tokens.
- Playwright desktop: login/manifest públicos, tema/assets e todas as 51 rotas
  protegidas aprovados; nenhuma exceção de página ou overflow horizontal.
- Playwright mobile/WebKit: as mesmas 51 rotas aprovadas sem overflow do
  viewport.
- Quatro cenários que mutam um tenant real continuam corretamente pulados sem
  `E2E_PASSWORD`; a auditoria nova usa interceptação local e nunca grava no
  Supabase.

### Auditoria visual

- Capturas finais em `artifacts/design-system`:
  `login-desktop-light.png`, `login-desktop-dark.png`,
  `login-mobile-light.png`, `dashboard-desktop-light.png`,
  `dashboard-desktop-dark.png` e `dashboard-mobile-light.png`.
- As seis capturas reportaram overflow `0`.
- Login, shell, sidebar, topbar, KPIs, tabelas, gráficos e painéis foram
  inspecionados em claro/escuro e desktop/mobile.
- Foco visível, labels, landmarks, skip link, estados Radix e
  `prefers-reduced-motion` foram preservados.

### Auditoria estática

- Zero utility de paleta aberta proibida em `src`.
- Zero referência ao ícone `Sparkles`.
- Os únicos `#hex` encontrados em `src` são a asserção do token navy, um número
  de nota fiscal (`#4521`) e seletores internos do Recharts — não cores
  renderizadas fora dos tokens.
- `git diff --check`: passou.
- ESLint do baseline: 265 problemas (216 erros, 49 avisos).
- ESLint após a migração: exatamente os mesmos 265 problemas; os arquivos
  novos e a refatoração principal passam isoladamente. A dívida preexistente
  não foi mascarada nem ampliada.
- `npm audit --omit=dev`: 18 advisories no grafo atual, sendo 12 high,
  6 moderate e 0 critical. Não foram introduzidos pelo pacote do DS; a solução
  compatível está registrada na matriz acima porque o reparo exige upgrades
  de runtime/build fora do escopo visual.

## 7. Gates de conclusão

- [x] Projeto local provado contra o GitHub.
- [x] Pacote canônico `0.6.1` construído e vendorizado.
- [x] Todos os 46 componentes, tipos, tokens e estilos presentes.
- [x] Todos os assets de logo incorporados; favicon e manifest atualizados.
- [x] Paleta aberta removida de `src`; `Sparkles` removido.
- [x] Runtime, rotas, Supabase e lógica financeira preservados.
- [x] Build de produção e instalação congelada concluídos.
- [x] Unit, E2E público, 51 rotas desktop/mobile e regressão de lint auditados.
- [x] Capturas finais integradas e verificação de contraste/overflow.
