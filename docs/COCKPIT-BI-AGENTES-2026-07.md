# Cockpit, BI self-service e Agentes — entrega de 2026-07-30

Plano executado: `.claude/plans/erp-bi-premium.plan.md` (F1–F4 completas, F5
parcial). Régua do DRE intocada em todas as fases: nenhum writer novo grava
sem revisão humana, nenhuma view mudou de significado.

## F1 — Banco conectado é o caminho principal

- **Caixa de entrada bancária** (`/bank-inbox`, `src/pages/BankInbox.tsx`):
  fecha a última milha do Open Finance. O staging `bank_transactions_raw`
  ganhou tela de revisão com classificação em cascata (`classificar-lote`,
  com aprendizado das correções) e importação **confirmada e classificada**.
- `openfinance-sync` action `import` reescrita
  (`supabase/functions/openfinance-sync/index.ts`): dedupe por `external_id`,
  conciliação com lançamento digitado (±3 dias, fontes
  manual/whatsapp/receivable/texto/contrato — régua espelhada do reconcile em
  `_shared/openfinance-import.ts`, testada) e só então insert `confirmed`.
  Ação `ignore` para transferências próprias. Varredura por `x-cron-secret`.
- Empty states de DRE e Lançamentos lideram com **Conectar banco**
  (`ConnectFirstCTA`); colar extrato virou fallback discreto.
- Cron `openfinance-sync-daily` 08h30 UTC (job 12), migration
  `20260730120000`.

## F2 — Cockpit no painel consolidado

- Camada de métricas pura `src/lib/metrics.ts` (MRR mensalizado, aging AR/AP,
  inadimplência por status efetivo, DSO/DPO, burn sobre meses fechados,
  runway, concentração de clientes, progresso de meta) + `useCockpit`
  (consulta paralela, escopo-aware).
- Painel: pulso (Caixa/Runway/MRR/Inadimplência), **metas** (`kpi_metas`,
  migration `20260730121000`, CRUD no card), aging clicável, radar
  operacional (impostos 60d, fechamento, ações de agente, ciclo de caixa),
  despesa por centro de custo, concentração de clientes, **análise de IA**
  sob demanda (`ai-summary` SSE, cache por dia) e sparklines nos KPIs.

## F3 — Agentes completos

- Catálogo + régua determinística em `_shared/templates-agentes.ts` (puro; a
  galeria renderiza e o runner executa O MESMO arquivo). Seis templates:
  Vigia de Caixa, Sentinela de Contas, Guarda Fiscal, Vigia de Metas, Resumo
  do CFO (IA), Analista Sob Medida (IA, prompt do cliente). IA só redige
  narrativa sobre números prontos, medida em `ai_usage`.
- `agent-runner` (cron 11h45, job 13; ou "Rodar agora" por empresa): dedupe
  por `dedupe_key` × janela de dias, despacho in-app + WhatsApp.
- **Sino real**: tabela `notifications` (INSERT só via service role; membro
  lê/marca lida), realtime, badge. Migration `20260730130000` também corrige
  o CHECK de `agent_actions` (aceita `anomalies`) e cria
  `whatsapp_configs.notify_number` — destinatário explícito, fim do descarte
  silencioso do smart-alerts.
- Agentes nativos (cobrança/anomalia) seguem em `agent_rules` e nas edges
  próprias, exibidos pela config existente — sem espelho para divergir.

## F4 — BI self-service

- `src/lib/bi-catalog.ts`: 9 métricas × 4 dimensões × 4 formatos; combinações
  válidas garantidas por zod (o builder não grava config inválida). Pizza não
  existe de propósito.
- `dashboard_widgets` (migration `20260730140000`): visões da empresa,
  autor registrado. Wizard de 3 passos, reordenação, remoção; renderização em
  `CustomWidget` com a linguagem visual dos gráficos nativos.

## Verificação em produção (2026-07-30)

- Crons 12 (`openfinance-sync-daily`) e 13 (`agent-runner-daily`) agendados;
  ambos executados manualmente via `chamar_funcao_agendada` → HTTP 200.
- Migrations aplicadas por query_sql; edges deployadas via gitsync + agente.
- 196 testes unitários, 12 E2E (52 rotas desktop+mobile), build ok, lint dos
  arquivos novos limpo (baseline do repo inalterado).

## Dívidas conhecidas (issues)

- `WhatsAppAgent.tsx` ainda chama a Evolution API do browser com a key em
  texto puro — hardening (Vault + proxy edge) planejado na F3 e não executado.
- `ConfiguracaoAgentes.tsx` duplica defaults de `_shared/agentes.ts`.
- E2E com tenant real para a Caixa de entrada bancária (hoje só mock).
