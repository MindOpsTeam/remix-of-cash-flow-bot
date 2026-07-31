# Plan: ERP Premium com BI de primeira (cockpit, integrações-first, agentes)

**Fonte**: pedido do Guilherme em 2026-07-30 (cockpit F1 no consolidado, matar o "colar extrato" como caminho principal, agentes completos com WhatsApp, mais funcionalidade em geral).
**Complexidade**: LARGE (5 fases independentes, cada uma entregável e publicável sozinha).

## Resumo

O produto já tem a infraestrutura que o pedido exige: Open Finance Pluggy funcionando até o staging, Inter com extrato/saldo, Asaas fechando o loop de cobrança, 2 agentes reais em pg_cron com fila de aprovação, IA server-side com governança (`_shared/ia.ts`). O que falta é (a) a última milha do Open Finance até o DRE, (b) uma camada de métricas rica sobre as views que já existem, (c) generalizar o motor de agentes em templates multi-canal, e (d) o BI self-service. Nada aqui toca a régua do DRE (10 invariantes de `docs/REVISAO-PROFUNDA-2026-07.md`); tudo ACRESCENTA leitores e escritores classificados.

## Fatos do código que ancoram o plano

| Fato | Onde |
|---|---|
| "Colar extrato" na DRE só existe no empty state | `src/pages/DRE.tsx:187-196`; também em `src/pages/Transactions.tsx:125-133` |
| Open Finance sincroniza mas MORRE no staging: a action `import` nunca é chamada pelo front | `supabase/functions/openfinance-sync/index.ts:46-84`; único invoke é `useBankConnections.ts:50-52` com `action:"sync"` |
| O banner de pendências do OF manda para `/transactions`, onde não há tela de revisão | `src/components/openfinance/OpenFinanceConnect.tsx:87-90` |
| Classificação IA em cascata (regra aprendida → 1 chamada de modelo → validação) já existe e aprende com correção humana | `supabase/functions/classificar-lote/index.ts:1-14,63-80` |
| Inter entra direto via `reconcile-transactions` sem classificação | `supabase/functions/inter-banking/index.ts:338-388` |
| Dashboard atual: 4 KPIs + estrutura de custos + 4 gráficos + tabela, tudo de `v_company_margin` | `src/pages/Index.tsx`, `src/hooks/useMarginBI.ts`, `src/components/bi/*` |
| Views prontas não exploradas no painel: `v_dre_linhas`, `v_group_ap_ar`, `v_centro_custo_mes`, `v_cliente_360`, `v_ativacao_empresa` | `src/integrations/supabase/types.ts` |
| Dados prontos não explorados: `receivables` (DSO/aging/inadimplência), `bills_payable` (DPO/aging), `contracts` (MRR), `budgets`, `monthly_close`, `inter_config.last_balance`, índices BCB (`indices-sync`) | schema + edges |
| Edges de IA prontas e subusadas: `ai-summary` (resumo executivo), `ai-forecast` (projeção de caixa) | `supabase/functions/ai-summary`, `ai-forecast` |
| Agentes reais: só 2 (cobrança com LLM, anomalia estatística), fila `agent_actions`, config `agent_rules` UNIQUE(company, agent) | `supabase/functions/agent-collections`, `agent-anomalies`, migrations 20260709010000 e 20260728060000 |
| Divergência de enum: `agent_rules` aceita `anomalies`, `agent_actions` não (anomalia grava como `alerts`) | `agent-anomalies/index.ts:99` |
| Único envio autônomo é `smart-alerts` (WhatsApp/Evolution), com regras hardcoded que IGNORAM os toggles de `user_preferences` e destinatário derivado da última mensagem inbound (se ninguém escreveu, descarta em silêncio) | `supabase/functions/smart-alerts/index.ts:36-126`; toggles órfãos em `src/pages/settings/Preferences.tsx:152-185` |
| NotificationBell é stub estático, NÃO existe tabela `notifications` | `src/components/NotificationBell.tsx:18-24` |
| WhatsAppAgent chama Evolution direto do browser com a API key em texto puro | `src/pages/WhatsAppAgent.tsx:168,222-225,256` |
| Cron versionado com 6 jobs via `chamar_funcao_agendada` + CRON_SECRET no Vault | `supabase/migrations/20260728090000_agendamentos_versionados.sql` |
| Realidade de uso: 129 empresas, 34 transações no total. Todo widget novo PRECISA de empty state com CTA de conexão | contexto 2026-07-27 |

## Padrões a espelhar (não reinventar)

| Categoria | Fonte | Padrão |
|---|---|---|
| Hook de BI | `src/hooks/useMarginBI.ts` | useQuery + staleTime 30s, lib pura separada (`src/lib/margin.ts`) com testes |
| Widget de gráfico | `src/components/bi/ChartPanel.tsx` | ChartPanel + ChartEmptyState, delays de animação, aria-labels |
| Config por empresa com segredo | migrations `20260727230000` (Pluggy) e Focus | tabela config + RLS `is_company_member`, segredo no Vault via RPC SECURITY DEFINER, preview mascarado |
| Edge com auth manual | `classificar-lote` (`requireCompany` de `_shared/auth.ts`) | verify_jwt false + membership em código; cron via header `x-cron-secret` |
| IA governada | `_shared/ia.ts` | determinístico antes de modelo, número nunca sai de LLM, `registrarUso` em `ai_usage` |
| Régua de agente | `_shared/agentes.ts` + `src/test/agentes.test.ts` | decisão determinística de QUANDO, LLM só redige; teste importa o arquivo da edge direto |
| Preferências | `user_preferences.prefs` jsonb | onde guardar layout de dashboard por usuário |
| Testes E2E | `e2e/design-system.spec.ts` (mocks) e `e2e/app.spec.ts` (tenant real) | mocks PostgREST p/ visual; tenant temporário SQL p/ fluxo real (gotchas: role sem 'owner', coalesce nos tokens de auth.users) |
| Migration | `supabase/migrations/2026*` | idempotente, RLS junto, eu escrevo e aplico via lovable query_sql read_only:false no projeto oxymhnddzamsjxwfglud |

---

## FASE 1 — Banco conectado vira o caminho principal; colar extrato vira fallback (URGENTE)

Objetivo: nenhum empty state pede texto colado como primeira opção; dinheiro do Open Finance chega ao DRE.

### T1.1 Caixa de entrada bancária (a tela que falta)
- **Criar** `src/pages/BankInbox.tsx` (rota `/bank-inbox`, grupo Operação) listando `bank_transactions_raw` com `status='new'`: data, descrição, valor, direção, conta bancária, Select de conta contábil.
- Classificar em lote na abertura via `classificar-lote` (mesma cascata; correções humanas alimentam `aprender`, espelhando `ImportarExtrato.tsx:163-175`).
- Importar selecionadas: evoluir `openfinance-sync` action `import` para aceitar `account_id` por item e gravar `status:'confirmed'` quando revisado por humano (hoje entra `pending` sem conta e não conta no DRE). Anti-duplicata: manter passagem pelo `reconcile-transactions` (candidatos já incluem `receivable`).
- `OpenFinanceConnect.tsx:87-90` e o badge de pendências passam a linkar para `/bank-inbox`.

### T1.2 DRE e Transactions com hierarquia certa
- **Editar** `DRE.tsx:187-196` e `Transactions.tsx:125-133,165`: CTA primário "Conectar banco" (leva ao widget Pluggy de `/settings/bank-accounts`; se já conectado, mostra status da conexão + botão sincronizar + pendências da caixa de entrada). Asaas e Inter como opções secundárias. "Colar extrato" vira link discreto "importar manualmente" (componente `ImportarExtrato` intacto, só rebaixado).
- Componente novo `src/components/openfinance/ConnectFirstCTA.tsx` reutilizável (DRE, Transactions, dashboard vazio).

### T1.3 Classificação na entrada para todas as vias bancárias
- Inter: após o `sync` (`inter-banking/index.ts:338-388`), rodar os inseridos sem conta pela mesma cascata (chamada interna a `classificar-lote` ou reuso da lib compartilhada). Zero mudança na régua: continua entrando como hoje, apenas ganha `account_id` sugerido.

### T1.4 Sync automático diário do Open Finance
- Job cron `openfinance-sync-daily` no padrão de `20260728090000` varrendo `bank_connections` ativas (webhook Pluggy já cobre push; o cron cobre conexões sem webhook e drift).

**Validação F1**: unit (parser/mappers intactos), teste novo da action import com account_id, E2E mock da caixa de entrada, E2E tenant real: staging → revisão → DRE mostra o valor. `npm run test && npm run build && npx playwright test`.

---

## FASE 2 — Cockpit F1 no painel consolidado

Objetivo: painel denso, elegante e decisório; tudo computável com dados que JÁ existem.

### T2.1 Camada de métricas
- **Criar** `src/lib/metrics.ts` (puro, testado) + `src/hooks/useCockpit.ts` (padrão useMarginBI): fontes `v_dre_linhas`, `v_company_margin`, `v_group_ap_ar`, `v_centro_custo_mes`, `v_cliente_360`, `receivables`, `bills_payable`, `contracts`, `budgets`, `bank_accounts`+`inter_config.last_balance`, `monthly_close`, `agent_actions`.
- Métricas novas: saldo de caixa consolidado, runway (caixa ÷ burn médio 3m), burn rate, MRR e churn de contratos, DSO, DPO, ciclo de caixa, aging AR/AP em buckets (a vencer, 1-15, 16-30, 30+), inadimplência %, ticket médio, concentração top-5 clientes, orçamento vs realizado, crescimento MoM/YoY, ponto de equilíbrio, impostos a vencer, status do fechamento.

### T2.2 Metas / OKR
- **Migration** `kpi_metas` (company_id, metric_key, periodo, alvo, direcao, RLS `is_company_member`). CRUD leve em `/settings` ou inline no widget ("definir meta"). Widget de progresso (anel/barra) na faixa de metas do cockpit.

### T2.3 Layout do cockpit (Index.tsx)
- Linha 1 pulso: caixa, runway, MRR, resultado do mês, margem operacional, com sparklines (KPICard ganha prop `spark?: number[]`).
- Linha 2 metas: anéis de progresso das metas definidas (vazio = CTA "defina sua primeira meta").
- Linha 3 análise: gráficos atuais (tendência/ranking/participação) + curva de caixa acumulada e aging AR/AP empilhado.
- Linha 4 inteligência: card "Insights da IA" consumindo `ai-summary` (edge pronta, cache 1x/dia em `user_preferences` ou tabela leve) + ações pendentes dos agentes (link `/agents`) + despesa por centro de custo (`v_centro_custo_mes`).
- Regra de vazio: TODO widget sem dado renderiza ChartEmptyState com CTA da Fase 1 (conectar banco). O cockpit é o vendedor da ativação, nunca uma parede de zeros.
- Design: tokens do DS VIA vigentes, `dataviz` skill antes de qualquer gráfico novo; zero paleta decorativa; visual-verify no browser antes de fechar.

**Validação F2**: testes de `metrics.ts` (arestas: divisão por zero, empresa sem receivables), E2E mock do cockpit populado E vazio, screenshot desktop/mobile, régua do DRE intocada (diff nas views = zero).

---

## FASE 3 — Agentes completos (templates, multi-instância, multi-canal)

Objetivo: galeria de agentes prontos + customizáveis, avisando in-app e por WhatsApp.

### T3.1 Fundação
- **Migration**: tabela `notifications` (company_id, user_id nullable, titulo, corpo, categoria, lida, agent_instance_id, RLS por membro) + tabela `agent_instances` (company_id, template_key, nome, ativo, config jsonb, canais jsonb `{inapp, whatsapp}`, schedule_key) permitindo N instâncias por template (hoje `agent_rules` trava em 1 por agente). Corrigir o CHECK de `agent_actions.agent` para incluir `anomalies` (divergência atual). `agent_rules` existente migra para instâncias (insert 1:1) sem quebrar as edges atuais.
- NotificationBell real: useQuery + realtime em `notifications`, badge de não lidas, marcar como lida (substitui o stub de 28 linhas).

### T3.2 Runner e templates
- **Criar** `supabase/functions/agent-runner` (cron diário no padrão versionado): carrega `agent_instances` ativas, executa o checker do template, grava `agent_actions` (quando exige aprovação) ou `notifications` direto, e despacha canais.
- Registry de templates em `supabase/functions/_shared/templates-agentes.ts` (decisão determinística; LLM só redige texto, padrão `_shared/agentes.ts`):
  1. Cobrança (existente, vira template; edge atual mantida até migrar)
  2. Anomalia de gasto (existente, idem)
  3. Caixa baixo / runway < N dias
  4. Contas a vencer D-3
  5. Meta estourada / batida (lê `kpi_metas` da F2)
  6. Imposto a vencer (`tax_guides`)
  7. Fechamento pendente após dia N
  8. Resumo semanal do CFO (LLM sobre contexto do `cfo-digital`, só narrativa, números vêm prontos)
  9. Analista custom: prompt do usuário + agenda, mesma governança `ai_usage`
- `smart-alerts` refatorado para virar os templates 3/4 e passar a respeitar os toggles de `user_preferences` (hoje órfãos).

### T3.3 Canal WhatsApp decente
- Destinatário explícito por empresa (`whatsapp_configs.notify_number` novo) em vez de "última mensagem inbound"; sem número configurado, o agente avisa in-app e marca o canal como não configurado na UI (nada de descarte silencioso).
- **Hardening obrigatório no caminho**: `WhatsAppAgent.tsx` para de chamar Evolution com API key no browser; chamadas passam por edge proxy e a key vai para o Vault (padrão `set_focus_token`).

### T3.4 UI /agents
- Galeria de templates (card: o que faz, canais, ativar), lista de instâncias com config (generalizar `ConfiguracaoAgentes.tsx`, removendo os defaults duplicados que já divergem de `_shared/agentes.ts`), histórico de execuções, fila de aprovação existente mantida.

**Validação F3**: testes dos checkers puros, teste do runner com instância fake, E2E: ativar template → rodar runner com x-cron-secret → notificação aparece no sino. WhatsApp testado manualmente contra a Evolution disponível.

---

## FASE 4 — BI self-service (o cliente monta a própria visão)

### T4.1 Catálogo tipado de métricas e dimensões
- **Criar** `src/lib/bi-catalog.ts`: ~20 métricas (fonte, agregação, formato) × dimensões (tempo, conta contábil, centro de custo, empresa, cliente, origem) × tipos de gráfico (linha, barra, área, pizza NUNCA, tabela, KPI). Catálogo é código; configuração é dado.

### T4.2 Persistência e builder
- **Migration** `dashboard_widgets` (company_id, user_id, titulo, config jsonb validada por zod, posicao, RLS por membro).
- Wizard "Novo gráfico" (3 passos: métrica → dimensão/período → tipo, com preview ao vivo) + seção "Minhas visões" no cockpit renderizando via ChartPanel. Reordenação simples por setas/posição primeiro; drag and drop só depois se pedir.

**Validação F4**: zod rejeita config inválida (teste), E2E criar widget → aparece → sobrevive reload, mobile sem overflow.

---

## FASE 5 — Interatividade transversal

- Período global no cockpit/DRE/Reports com estado na URL (item STAGED da revisão profunda; searchParams, padrão URL-as-state).
- Drill-down: clique em barra/linha/fatia navega para `/transactions` filtrada (query params).
- Presets de relatório em Reports + export CSV/PDF nos widgets novos (libs `csv-export`/`pdf-export` existentes).
- Card de insight IA por página (DRE, Receivables, Contas a pagar) reusando `ai-summary` com contexto da página.

---

## Riscos

| Risco | Prob. | Mitigação |
|---|---|---|
| Quebrar a régua do DRE (invariante nº1 do produto) | Média | Nenhuma view alterada; import do staging só grava `confirmed` após revisão humana; diff de views = zero em toda fase; testes de `dre.test.ts` como gate |
| Cockpit denso virar parede de zeros (34 transações no sistema todo) | Alta | Empty state com CTA de conexão em TODO widget; F1 antes de F2 de propósito |
| Duplicata OF × Asaas × Inter ao importar staging | Média | Manter `reconcile-transactions` no caminho do import; dedupe por `external_id` já existe |
| Custo de IA (resumos/insights por empresa) | Média | Cache diário; determinístico antes de modelo; `ai_usage` já mede; modelos flash-lite por padrão |
| WhatsApp/Evolution instável (histórico: parado desde março, 401 loggedOut conhecido) | Alta | Canal in-app é o primário e sempre funciona; WhatsApp é aditivo com status visível de configuração |
| Migrations em produção com 129 empresas | Média | Idempotentes, só ADD (nenhum drop), aplicadas por mim via query_sql com backup do padrão da casa quando tocar dado |
| Frontend publicado está velho (Publish manual, issue #3) | Certa | Cada fase termina com commit na main + lembrete de Publish; sem Publish o cliente não vê |
| Escopo gigante de uma vez | Alta | 5 fases independentes; cada uma mergeável e testável sozinha; ordem = prioridade declarada (extrato primeiro) |

## Validação global (toda fase)

```bash
npm run test          # 154+ unit, sem regressão
npm run build         # vite production
npx playwright test   # design-system + app spec (desktop e mobile)
npx eslint <arquivos tocados>   # repo-wide continua no baseline 216/48
```

## Estimativa

| Fase | Tamanho | Entrega |
|---|---|---|
| F1 extrato → integração-first + caixa de entrada | M | 1 sessão |
| F2 cockpit + metas + insights | L | 1-2 sessões |
| F3 agentes completos | L | 2 sessões |
| F4 BI self-service | M | 1 sessão |
| F5 interatividade | M | 1 sessão |

## Aceite

- [ ] Empty states de DRE/Transactions lideram com integração; colar extrato rebaixado a fallback
- [ ] Transação do Open Finance chega ao DRE após revisão na caixa de entrada
- [ ] Cockpit com 15+ métricas, metas, insights de IA e zero widget "mudo" quando vazio
- [ ] 5+ templates de agente ativáveis, sino funcional, WhatsApp com destinatário explícito
- [ ] Cliente cria um gráfico próprio e ele persiste
- [ ] Régua do DRE byte a byte intacta; testes e build verdes em todas as fases
