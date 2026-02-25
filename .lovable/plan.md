

# Unificar Plataforma Pessoal + Empresarial com WhatsApp

## Visao Geral

Trazer as funcionalidades de gestao financeira pessoal do projeto "Couple's Coin" para dentro deste projeto (FinanceAI), criando uma plataforma unificada que atende tanto pessoa fisica quanto juridica, mantendo a integracao com WhatsApp.

## Arquitetura Proposta

A abordagem sera criar um **modo de uso** (pessoal vs empresarial) que o usuario escolhe ao fazer login ou nas configuracoes. Isso determina quais modulos ficam visiveis na sidebar e quais tabelas sao usadas.

```text
+---------------------------+
|       FinanceAI            |
|  (plataforma unificada)    |
+---------------------------+
|                           |
|  Modo Pessoal (PF)        |  Modo Empresarial (PJ)
|  - Dashboard pessoal       |  - Dashboard empresarial
|  - Transacoes pessoais     |  - Lancamentos / DRE
|  - Contas bancarias        |  - Plano de Contas
|  - Cartoes de credito      |  - Centros de Custo
|  - Metas / Orcamentos      |  - CFO Digital
|  - Categorias (Kakeibo)    |  - Simulador / Previsao
|  - Importar CSV            |  - Resumo Executivo
|  - Analise IA              |  - Relatorios
|  - Controle de gastos      |  - WhatsApp Agent
|                           |
|  >> WhatsApp integrado     |  >> WhatsApp integrado
|     em ambos os modos      |     em ambos os modos
+---------------------------+
```

## Etapas de Implementacao

### Etapa 1 - Tabelas do modulo pessoal (migracao SQL)

Criar as tabelas que existem no projeto pessoal mas nao existem aqui:

- `accounts` - contas bancarias pessoais (com saldo, tipo, owner)
- `categories` - categorias de despesa/receita com icone e cor
- `subcategories` - subcategorias vinculadas a categorias
- `category_rules` - regras de auto-categorizacao
- `credit_cards` - cartoes de credito (limite, vencimento, bandeira)
- `budgets` - orcamentos mensais por categoria
- `goals` - metas financeiras (reserva de emergencia, viagens, etc)
- `control_charts` - paineis de controle personalizados
- `import_sessions` - sessoes de importacao CSV
- `reconciliation_checklist` - conciliacao bancaria
- `alerts` - alertas inteligentes pessoais
- `ai_conversations` - conversas com IA

Todas com RLS baseado em `user_id = auth.uid()` (sem empresa).

### Etapa 2 - Configuracao de modo (pessoal/empresarial)

- Adicionar coluna `mode` na tabela `companies` ou criar uma tabela `user_preferences` com campo `preferred_mode` (`personal` | `business`)
- Criar hook `useAppMode()` para alternar entre modos
- Permitir que o usuario troque de modo a qualquer momento

### Etapa 3 - Sidebar unificada

Refatorar `AppSidebar.tsx` para mostrar menus diferentes baseado no modo:

- **Modo Pessoal**: Dashboard, Transacoes, Contas, Cartoes, Transferencias, Metas, Orcamentos, Controle, Categorias, Relatorios, Importar CSV, Conciliacao, Analise IA, WhatsApp
- **Modo Empresarial**: Dashboard, Lancamentos, DRE, Relatorios, CFO Digital, Simulador, Previsao, Resumo Executivo, WhatsApp, Configuracoes

Um seletor de modo ficara no topo da sidebar.

### Etapa 4 - Paginas do modulo pessoal

Portar as seguintes paginas do projeto Couple's Coin:

1. **Dashboard pessoal** - cards de entradas/saidas, saldo, proxima fatura, radar alimentacao, top categorias, metas, grafico Kakeibo
2. **Transacoes pessoais** - lista com filtros avancados (periodo, pessoa, conta, cartao, categoria)
3. **Contas** - gerenciar contas bancarias com saldo
4. **Cartoes de credito** - gerenciar cartoes, faturas, limites
5. **Transferencias** - entre contas
6. **Metas** - reserva de emergencia, metas de poupanca
7. **Orcamentos** - limites mensais por categoria
8. **Categorias** - com subcategorias e metodo Kakeibo
9. **Controle** - paineis de controle personalizados
10. **Importar CSV** - importacao de extratos bancarios
11. **Conciliacao** - conciliacao bancaria
12. **Analise IA** - consultor financeiro com IA

### Etapa 5 - Hooks e logica de negocio

Portar os hooks do projeto pessoal:
- `useAccounts`, `useCategories`, `useCreditCards`, `useGoals`, `useBudgets`
- `useTransactions` (versao pessoal), `useTransfers`
- `useDashboardData`, `useDashboardAnalytics`, `useKakeboSummary`
- `useControlCharts`, `useReconciliation`, `useFinancialAdvisor`
- `useReportsData`, `useSubscriptions`, `useAlerts`

### Etapa 6 - WhatsApp para modo pessoal

Adaptar a integracao WhatsApp existente para funcionar tambem no modo pessoal, permitindo:
- Registrar despesas/receitas via mensagem
- Consultar saldo e gastos do mes
- Receber alertas de orcamento

## Sequencia recomendada

Dado o tamanho do trabalho, sugiro dividir em fases:

**Fase 1** (esta sessao): Criar as tabelas, o sistema de modo, a sidebar unificada, e 2-3 paginas essenciais (Dashboard pessoal, Transacoes, Contas)

**Fase 2** (proxima sessao): Cartoes, Metas, Orcamentos, Categorias

**Fase 3**: Importar CSV, Conciliacao, Controle, Analise IA, adaptacao WhatsApp

## Detalhes tecnicos

- As tabelas pessoais usarao `user_id` diretamente (sem company_id), diferente das tabelas empresariais
- O hook `useAppMode()` armazenara o modo em `localStorage` + contexto React
- A autenticacao permanece a mesma (ja funciona para ambos)
- Os componentes UI (shadcn) sao compartilhados
- Edge functions do WhatsApp precisarao de uma flag para saber se o contexto e pessoal ou empresarial

