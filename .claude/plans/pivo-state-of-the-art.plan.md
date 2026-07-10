# Plan: Pivô FinanceAI → ERP financeiro state-of-the-art (PME BR)

**Fonte**: Deep research 2026-07-09 (Gartner MQ Cloud ERP Finance out/2025, Intuit/SAP/Microsoft agentic AI, NT 2025.002 CBS/IBS, Res. CGSN 189/2026 NFS-e Nacional)
**Complexidade**: Large (5 fases, ~10-14 semanas de trabalho incremental)
**Restrição mestre**: NÃO destrutivo. 79 usuários / 92 empresas em produção. Toda migration é aditiva, toda feature nova entra atrás de rota/flag nova, nada de reescrever o que funciona.

## Norte estratégico (do research)

1. Classificação/conciliação/forecast por IA viraram **baseline** — nosso diferencial deixa de ser "ter IA" e passa a ser **agentes que executam fluxos ponta a ponta com humano no loop**.
2. Dois prazos regulatórios mandam na ordem: **rejeição CBS/IBS ~03/08/2026** (NFe/NFCe/NFSe/CTe) e **NFS-e Nacional obrigatória p/ Simples 01/09/2026** (nossa emissão própria via SEFIN é rota oficial → motor de aquisição).
3. Benchmark multi-entidade = Intuit Enterprise Suite: consolidação AP/AR, intercompany, padronização de plano de contas entre CNPJs.
4. Gartner: 60% das trocas de ERP até 2027 decididas por **plataforma** (API pública, orquestração).
5. Agente WhatsApp em grupo é **diferencial genuíno vs líderes globais** — dobrar a aposta.

## Padrões do código a espelhar (não reinventar)

| Categoria | Fonte | Padrão |
|---|---|---|
| Multi-tenant | `supabase/migrations/20260701000000_multitenant_org_id_margin_bi.sql` + `src/hooks/useCompany.tsx` | RLS por `is_company_member`, RPC `SECURITY DEFINER` p/ operações cross-tenant, escopo em localStorage `cfo:*` |
| BI/vistas | view `v_company_margin` (security_invoker) + `src/hooks/useMarginBI.ts` + `src/lib/margin.ts` | View SQL como fonte, hook TanStack Query por cima, cálculo puro em lib/ testável |
| Edge functions IA | `supabase/functions/cfo-digital/index.ts`, `ai-forecast` | Lovable AI Gateway (`LOVABLE_API_KEY`), Gemini flash; contexto financeiro montado server-side |
| Cron | `smart-alerts` | Header `X-Cron-Secret` + `CRON_SECRET` |
| Fiscal | `supabase/functions/_shared/plugnotas.ts` + `src/components/plugnotas/*Form.tsx` | Helper compartilhado + form por documento + `EmissionHistory` |
| Rotas | `src/App.tsx` | Lazy por rota, `ProtectedRoute`, grupos por área |
| Deploy | gotcha do projeto | DDL via `lovable-cloud query_sql read_only:false`; edge functions só via commit+push+prompt no Lovable |

---

## FASE 0 — Fundação e higiene (pré-requisito, ~1 semana)

Objetivo: chão firme antes do pivô. Nada visível ao usuário.

### Task 0.1: Rede de testes mínima
- **Ação**: recriar `src/test/audit-pf-pj.test.ts` (script `audit:pf-pj` aponta p/ arquivo inexistente) e cobrir `src/lib/margin.ts` + `src/lib/plugnotas.ts` com unit tests. Meta: as libs puras 100%, não o app inteiro.
- **Validar**: `npm test` verde; `npm run audit:pf-pj` volta a rodar.

### Task 0.2: Auditoria de endpoints (26 funções, todas verify_jwt:false)
- **Ação**: rodar skills `lovable-endpoint-audit` + `lovable-rls-audit`; corrigir P0/P1. Remover as 3 funções deployadas órfãs (`asaas-api`, `asaas-webhook`, `ai-classify-personal` — substituídas pelas `company-asaas-*`).
- **Validar**: relatório sem P0; funções órfãs ausentes em `lovable_list_functions`.

### Task 0.3: Decisão NFS-e — UMA via primária
- **Ação**: consolidar na via **NFS-e Nacional própria** (`nfse-worker` na Railway + `nfse-proxy`/`nfse-operations`) como caminho primário de NFS-e, PlugNotas como fallback pago e via única p/ NFe/NFCe/CTe/MDFe. `nfse-nacional-mcp` vira ferramenta de dev/suporte (não caminho de produção). Documentar em `docs/ARCHITECTURE-FISCAL.md`.
- **Validar**: doc escrito; emissão NFS-e de teste passa pelo worker.

---

## FASE 1 — Regulatório 2026 (URGENTE, deadline ago-set/2026, ~2-3 semanas)

Objetivo: nenhum cliente tem nota rejeitada em agosto; setembro vira campanha de aquisição.

### Task 1.1: Gap analysis CBS/IBS no PlugNotas
- **Ação**: verificar (docs + sandbox) se o PlugNotas já aceita/propaga os grupos IBS/CBS da NT 2025.002 para NFe/NFCe/CTe. Registrar resultado; se não suportar, abrir plano de contingência (emissão NFe direta é aposta grande — decisão separada).
- **Validar**: emissão sandbox com destaque CBS/IBS aceita pela SEFAZ de homologação.

### Task 1.2: Campos CBS/IBS no domínio
- **Ação**: migration aditiva — colunas de tributação (cbs_valor, ibs_valor, regime, cClassTrib) em `invoices`/`plugnotas_documents`; atualizar `NfeForm/NfceForm/CteForm` e `_shared/plugnotas.ts` para enviar os grupos. NFSe idem via worker (`nfse-worker/src/lib/dps-xml.ts`).
- **Validar**: `npm test` + emissão homologação dos 4 documentos afetados.

### Task 1.3: "Pronto para a Reforma" na UI
- **Ação**: banner/checklist por empresa (regime tributário, cClassTrib padrão por produto/serviço) em `/settings/company` + card no dashboard. É também argumento de venda.
- **Validar**: empresa sem configuração vê o checklist; configurada emite com destaque.

### Task 1.4: NFS-e Nacional como produto de aquisição
- **Ação**: onboarding self-service do certificado A1 (upload .pfx já existe via `nfse-operations parse_cert`) + landing/flow "emita NFS-e Nacional grátis" p/ Simples; medir ativação. Hardening do `nfse-worker` (retry, fila, status).
- **Validar**: fluxo end-to-end novo CNPJ Simples → cert → emissão em < 10 min.

---

## FASE 2 — IA agêntica com humano no loop (quick wins, ~3 semanas, paralelizável c/ Fase 1)

Objetivo: empacotar a IA existente como AGENTES nomeados que executam fluxo ponta a ponta. Espelhar o modelo Intuit (agentes por domínio) sem prometer autonomia total.

### Task 2.1: Agente de Cobrança (sobre Asaas)
- **Ação**: nova edge function `agent-collections` (cron + on-demand): detecta faturas a vencer/vencidas em `company_asaas_*`, propõe régua de cobrança (lembrete → 2ª via → renegociação), rascunha mensagens; usuário aprova na UI (`/agents/collections`) ou via WhatsApp. Fila de aprovação em tabela `agent_actions` (nova, RLS `is_company_member`).
- **Mirror**: `smart-alerts` (cron), `cfo-digital` (LLM), padrão `whatsapp-webhook` p/ resposta.
- **Validar**: fatura vencida gera ação pendente; aprovação dispara cobrança no sandbox Asaas.

### Task 2.2: Fechamento mensal assistido
- **Ação**: checklist de close por empresa/mês (nova tabela `monthly_close` + view de pendências: transações sem categoria, conciliação aberta, PF/PJ misturado, notas sem lançamento); agente sugere resolução em lote (reusa `ai-classify` e `reconcile-transactions`); ao fechar, congela o período (flag, não lock destrutivo) e gera resumo executivo (`ai-summary`).
- **Validar**: mês com pendências → resolver em lote → status "fechado" + DRE do período estável.

### Task 2.3: Anomaly detection (item do baseline que falta)
- **Ação**: incorporar ao `smart-alerts`: desvios de padrão (despesa fora da curva por categoria/centro de custo, duplicidade provável, margem despencando num CNPJ). Alertas no `NotificationBell` + WhatsApp.
- **Validar**: transação sintética 5x acima da média da categoria gera alerta.

### Task 2.4: WhatsApp — de chat para painel de aprovação
- **Ação**: o agente do grupo passa a entregar as ações dos agentes (cobrança, close, anomalias) com aprovação por resposta ("aprovar 3"), usando `whatsapp_pending_actions` (tabela já existe, está vazia — ativar). É o nosso diferencial vs líderes: operar o financeiro de dentro do WhatsApp.
- **Validar**: ação pendente aparece no grupo; resposta de aprovação executa e confirma.

---

## FASE 3 — Multi-CNPJ nível Enterprise Suite (estrutural, ~3-4 semanas)

Objetivo: fechar as lacunas vs benchmark IES apontadas no research.

### Task 3.1: Plano de contas padronizado entre CNPJs
- **Ação**: conceito de "plano de contas do grupo" (template no nível do usuário/grupo) + mapeamento por empresa; assistente de-para com `ai-classify`. Hoje são 2.914 contas soltas — a padronização é aditiva (mapping table), sem tocar nas contas existentes.
- **Validar**: DRE consolidada agrupa por conta do grupo mesmo com planos divergentes.

### Task 3.2: Intercompany básico
- **Ação**: marcar transações entre empresas do grupo (transferências, rateios, mútuos) e eliminá-las na visão consolidada do BI (`v_company_margin` v2 + `useMarginBI`). Sem contabilidade de eliminação formal — só consolidação gerencial correta.
- **Validar**: transferência entre 2 CNPJs do grupo não infla receita/despesa consolidada.

### Task 3.3: Orçamento vs realizado
- **Ação**: tabelas `budgets`/`budget_lines` (empresa × conta × mês), UI em `/budget`, comparação no BI (nova série no `MarginTrendChart` + página realizado×orçado); agente comenta desvios no resumo executivo.
- **Validar**: orçamento carregado → desvio aparece no dashboard e no `ai-summary`.

### Task 3.4: Workflow de aprovação em contas a pagar
- **Ação**: `bills_payable` ganha estados (rascunho → aprovação → agendado → pago) + regra por alçada (valor/role em `company_members`); aprovação na UI e via WhatsApp (reusa `agent_actions` da Fase 2).
- **Validar**: conta acima da alçada exige aprovador; abaixo, flui direto.

### Task 3.5: Permissões granulares
- **Ação**: expandir roles em `company_members` (admin/financeiro/leitura) e aplicar nas policies novas + gating de rotas no `AppSidebar`. Aditivo: role default preserva comportamento atual.
- **Validar**: usuário "leitura" não consegue criar transação (UI e RLS).

---

## FASE 4 — Plataforma (aposta estrutural, ~2-3 semanas)

### Task 4.1: API pública v1
- **Ação**: edge function `public-api` com API keys por empresa (tabela `api_keys`, hash + escopo), endpoints read-first (transações, DRE, fluxo, faturas) + webhooks de eventos (reusa `webhooks`/`webhook-logs` existentes). OpenAPI publicado.
- **Validar**: `curl` com key lê transações da empresa; key revogada → 401.

### Task 4.2: Relatórios exportáveis/customizáveis
- **Ação**: gerador de relatório por blocos (período, empresas, contas, centros) com export PDF (jsPDF já no stack) e CSV; salvar presets por usuário (`user_preferences`).
- **Validar**: preset salvo reabre idêntico; PDF bate com dados da tela.

### Task 4.3: Mobile-first de verdade
- **Ação**: passe `responsive-mobile` nas rotas de maior uso (dashboard, transações, aprovações) + PWA (manifest/installable). Aprovações da Fase 2/3 são o caso de uso mobile matador.
- **Validar**: Playwright 320/375px sem overflow nas 6 rotas top.

---

## FASE 5 — Top of mind (contínuo, começa junto da Fase 1)

- **Posicionamento**: "o ERP financeiro com agentes de IA que trabalham por você — e que já está pronto para a Reforma Tributária". Reforma (ago/set 2026) é a onda de mídia; NFS-e Nacional grátis é a isca de topo de funil.
- **Onboarding/ativação**: `OnboardingWizard` reformulado — em 10 min: conectar banco (Inter), importar extrato, emitir 1ª nota, receber 1º insight do CFO no WhatsApp. Medir ativação (skill `onboarding-design`).
- **Prova social**: dashboards de casos com dados anonimizados dos 92 CNPJs (com consentimento) — "PMEs que fecham o mês em X dias".
- **Pesquisa complementar** (pendência do research): rodar deep-research #2 sobre players BR (Omie/Conta Azul/Bling/TOTVS × CBS/IBS × pricing) + PlugNotas/IBS-CBS + Open Finance (Pluggy/Belvo) para calibrar pricing e a Task 1.1.

---

## Dependências e sequência

```
F0 ──► F1 (regulatório)  ──► F5 (campanha reforma)
  └──► F2 (agentes)      ──► F3.4 (aprovações reusa agent_actions)
              F3 (multi-CNPJ) ──► F4 (API expõe consolidado)
```
F1 e F2 correm em paralelo após F0. F3 começa quando F1 estiver em homologação. F4 por último.

## Riscos

| Risco | Prob. | Mitigação |
|---|---|---|
| PlugNotas atrasar suporte CBS/IBS | Média | Task 1.1 na frente de tudo; fallback = adiar emissão própria, comunicar clientes |
| Cronograma fiscal mudar por Nota Técnica | Alta | Re-checar NTs a cada sprint da F1; feature flag por regime |
| Regressão em produção (79 usuários) | Média | Migrations aditivas, flags, verify e2e por fase, nada de alterar RLS existente sem policy paralela |
| Deploy de edge function gated (MCP 403) | Certa | Fluxo commit+push+prompt Lovable já validado no projeto |
| Agentes IA errando cobrança/close | Média | Humano no loop SEMPRE (aprovação explícita); research mostrou que "autônomo" dos líderes também é assistido |
| Escopo inflar (ERP completo: folha, ativos, multi-moeda) | Alta | Fora do plano deliberadamente — PME BR mono-moeda; folha nunca (terceirizar via integração futura) |

## Validação por fase

```bash
npm run lint && npm test          # sempre
npm run audit:pf-pj               # após F0.1
npm run build                     # bundle < 400kb gzip (budget app page)
# e2e Playwright por fase (fluxos: emissão, cobrança, close, aprovação)
# emissão homologação SEFAZ (F1) | sandbox Asaas (F2.1)
```

## Aceitação global

- [ ] Nenhuma migration destrutiva; RLS existente intacta
- [ ] Ago/2026: 100% das emissões com CBS/IBS aceitas
- [ ] Set/2026: fluxo NFS-e Nacional self-service no ar
- [ ] 3 agentes nomeados em produção (Cobrança, Close, Alertas) com aprovação humana
- [ ] BI consolidado com intercompany + orçado×realizado
- [ ] API pública v1 documentada
- [ ] Ativação onboarding medida e > baseline
