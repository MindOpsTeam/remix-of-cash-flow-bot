# Plan: Conta de demonstração com tour guiado (wow-first)

**Fonte**: pedido do Guilherme 2026-07-31 — botão de demonstração direto na
tela de login, conta seedada, onboarding dedicado a MOSTRAR o produto, o
usuário só clica Continuar; começar pelo fator wow e depois o poderio todo.
**Complexidade**: MEDIUM-LARGE (1 a 1,5 sessão).

## Decisões de arquitetura (e por quê)

| Decisão | Racional |
|---|---|
| Conta demo COMPARTILHADA `demo@financeai.app` com papel **viewer** | O RBAC recém-construído torna a demo segura por construção: visitante não escreve NADA, nem por API, nem por RPC (venda_balcao checa papel). Zero risco de um visitante sujar a demo do outro |
| Credencial demo embutida no botão do login | Conta pública por design, dados fictícios, papel somente leitura — não é segredo, é porta de entrada |
| Grupo demo com **3 CNPJs** seedados (matriz + 2 filiais) | A consolidação multi-CNPJ é diferencial; a demo precisa nascer mostrando o grupo |
| Seed via script SQL idempotente que EU aplico em prod (`supabase/seed-demo.sql`, versionado; re-seed apaga e recria por org DEMO-) | Drift zero: se algo mudar, re-seedar restaura o palco. Não é migration (não roda em todo ambiente) |
| Tour como barra fixa inferior (não modal) que NAVEGA de página em página | O produto real é o palco; o tour é legenda. Modal esconderia exatamente o que queremos mostrar |

## Fatos do código que ancoram

- Login: `src/components/auth/LoginSignupForm.tsx` (o botão entra aqui).
- RBAC viewer: RESTRICTIVE policies em 15 tabelas + `pode_escrever_na_empresa`
  nas RPCs (migrations 20260731110000) — a jaula da demo já existe.
- Cockpit/BI/agentes/caixa de entrada/consolidado/PDV/contador: tudo pronto;
  a demo é SEED + NARRATIVA, não feature nova.
- Staging bancário (`bank_transactions_raw`) aceita seed direto → a Caixa de
  entrada aparece VIVA na demo sem Pluggy nenhum.
- Notificações e agent_instances seedáveis → sino cheio e galeria ativa.
- Tour precisa de rota atual: barra monta no `AppLayout` quando o usuário é o
  demo (email) e navega com o router.

## Tasks

### T1 — Seed do palco (`supabase/seed-demo.sql`)
Idempotente (DELETE por `org_id LIKE 'DEMO-%'` + recria):
- 1 auth user `demo@financeai.app` (senha fixa) + 1 "dono fantasma" admin.
- 3 companies (Holding Aurora Matriz, Aurora Digital, Aurora Varejo) com
  regime/regimes diferentes, `plan_key='pro'`, group_code mapeado no plano de
  contas (consolidação perfeita) e demo user como **viewer nas três**.
- 12 meses de `transactions` confirmadas e classificadas por CNPJ (curvas
  diferentes: matriz estável, digital crescendo, varejo apertado — histórias
  visíveis nos gráficos), intercompany entre matriz e filiais (eliminações
  aparecem na consolidada).
- `receivables` abertos + vencidos (aging e inadimplência com cor),
  `bills_payable` com vencimentos próximos (radar aceso), `contracts` ativos
  (MRR), `kpi_metas` (uma batida, uma em risco), `tax_guides` próximas.
- `bank_transactions_raw` com ~15 linhas `new` (a Caixa de entrada nasce com
  trabalho para a IA mostrar), `bank_connections` fictícia "Banco Aurora".
- `agent_instances` ativas + `notifications` recentes (sino com badge),
  `dashboard_widgets` (2 visões de BI prontas), produtos com estoque e NCM,
  vendas de balcão históricas (turno do PDV com números).

### T2 — Botão no login + entrada
- `LoginSignupForm`: botão secundário "Ver demonstração" (ícone play) →
  `signInWithPassword(demo)` → navega `/dashboard?tour=1`.
- Falha de login demo (senha trocada etc.) → toast honesto, sem quebrar login normal.

### T3 — DemoTour (a narrativa)
Componente montado no AppLayout quando `user.email === demo` (badge "modo
demonstração" no topo + tour). Barra inferior fixa: título, texto curto,
passo N/10, botões Continuar / Sair da demo (signOut). Posição em
sessionStorage. Roteiro wow-first:
1. `/dashboard` — **o wow**: "Três CNPJs, um cockpit: caixa, runway, metas,
   inadimplência e a IA lendo seu mês. Isso monta SOZINHO a partir do banco."
2. `/bank-inbox` — o diferencial nº 1: "o extrato chegou do banco; a IA já
   classificou; você só confirma. É assim que o DRE se constrói sem digitação."
3. Sino + `/agents` — "o ERP que avisa antes: agentes vigiam caixa, contas,
   impostos e metas, no painel e no WhatsApp."
4. `/consolidado` — "grupo inteiro, conta a conta, com eliminações explícitas."
5. `/dashboard` (Minhas visões) — "BI self-service: monte o gráfico que o seu
   negócio pede, sem planilha."
6. `/pdv` — "frente de caixa que baixa estoque, lança receita e emite NFC-e."
7. `/contador` — "o pacote do contador sai daqui em 1 clique."
8. `/reforma` — "Reforma Tributária simulada por regime, ano a ano, hoje."
9. `/settings/integrations` — "bancos, Asaas, Inter, Conta Azul, notas — e
   API pública para você criar o que faltar no Lovable."
10. Fechamento — "Crie sua conta em 1 minuto" → botão sai da demo e abre o
    cadastro (signOut + /); o guia de instalação real assume de lá.

### T4 — Guard-rails de demo
- `DemoBadge` no topo: "Você está numa demonstração (somente leitura)".
- Toasts de escrita bloqueada pela RLS ganham mensagem amigável na demo?
  (não: o viewer já recebe erro claro; o tour avisa que é leitura).
- Botões de convite/config aparecem mas o RBAC barra — o tour usa isso como
  prova: "papéis valem no banco, não só na tela".

### T5 — E2E + smoke
- E2E mock: botão de demo visível no login; tour renderiza passo 1 e navega
  no Continuar (mock de auth demo).
- Smoke real: login demo em produção via Playwright (config local), tour
  completo, ZERO escrita possível (tentativa de criar meta falha com RLS).

## Riscos

| Risco | Prob. | Mitigação |
|---|---|---|
| Visitante simultâneo (conta compartilhada) | Certa | Viewer read-only: ninguém muda nada; tour é client-side |
| Drift do palco (dado fictício envelhece) | Alta | Re-seed idempotente; datas do seed são RELATIVAS a now() para os gráficos nunca envelhecerem |
| Senha demo pública em bundle | Certa e aceita | Papel viewer + dados fictícios + rate limit do Supabase |
| PDV/metas não demonstráveis "ao vivo" (viewer não escreve) | Média | O tour narra e mostra dados prontos; v2 opcional: filial sandbox `member` re-seedada por cron |
| Publish manual | Certa | Como sempre: entra na main, você publica |

## Validação

```bash
npm run test && npm run build && npx playwright test
```
Mais seed aplicado em prod + smoke de login demo real.

## Aceite
- [ ] Botão "Ver demonstração" no login entra sem cadastro
- [ ] Palco seedado: cockpit cheio, caixa de entrada viva, sino com avisos, consolidada de 3 CNPJs, BI com visões, PDV com turno
- [ ] Tour de 10 passos navegando com Continuar, wow primeiro
- [ ] Visitante não consegue escrever NADA (provado por teste)
- [ ] Sair da demo leva ao cadastro real
