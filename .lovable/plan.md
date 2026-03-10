

# Refatoração: Dashboard, Navegação e Páginas Financeiras

## Problemas Identificados

### 1. Dashboard PJ sobrecarregado
O dashboard atual empilha 7 seções verticais: 4 KPIs + FinancialScore + 2 cards IA + Patrimônio Consolidado + Gráfico + Últimos Lançamentos. Informação demais sem hierarquia clara.

### 2. "Transferências" vs "Lançamentos/Transações" confuso
- **PJ**: "Lançamentos" = tabela `transactions` (receitas/despesas manuais). "Transferências" = dados do Asaas (transferências bancárias, assinaturas, antecipações). Conceitos completamente diferentes mas nomes parecidos.
- **PF**: "Transações" = tabela `personal_transactions`. "Transferências" = mix de transferências entre contas internas + Asaas. Mesma confusão.
- O usuário não entende por que existem duas páginas que parecem a mesma coisa.

### 3. Contas a Pagar sem botão de cadastro
Tanto PF quanto PJ, a página "Contas a Pagar" exibe APENAS dados vindos do Asaas. Sem botão "Nova Conta a Pagar" para cadastro manual. Se o Asaas não estiver configurado, a página é inútil.

### 4. PJ não tem transferência entre contas bancárias
A PF tem transferência entre contas pessoais, mas a PJ (que tem `bank_accounts`) não tem funcionalidade equivalente.

---

## Plano de Ação

### Tarefa 1: Simplificar Dashboard PJ
- Manter apenas: 4 KPIs no topo + gráfico receitas/despesas + últimos lançamentos
- Remover `FinancialScore` e `ConsolidatedPatrimony` do dashboard (mover para Relatórios)
- Manter cards CFO Digital e WhatsApp mas mais compactos (uma linha, não dois cards grandes)
- Resultado: dashboard limpo com informação acionável

### Tarefa 2: Simplificar Dashboard PF
- Manter: 4 KPIs + gráfico + AI Insight
- Remover `ConsolidatedPatrimony` do dashboard (mover para Relatórios)
- Remover cards "Ações Rápidas" e "Resumo" (redundantes com sidebar)

### Tarefa 3: Renomear e Reorganizar Menu
Renomear itens para eliminar ambiguidade:

**PJ (Empresa):**
- "Lançamentos" permanece (receitas/despesas)
- "Transferências" → renomear para "Asaas" e mover para dentro de Integrações ou renomear para "Movimentações Asaas"
- Adicionar "Transferências entre Contas" como item separado em Operações
- "Contas a Pagar" permanece

**PF (Pessoal):**
- "Transações" permanece
- "Transferências" → separar: tab "Entre Contas" fica como página própria, tabs Asaas movem para contexto da integração
- "Contas a Pagar" permanece

### Tarefa 4: Adicionar Cadastro Manual em "Contas a Pagar"
- Ambas as páginas (PF e PJ) ganham um botão "Nova Conta a Pagar"
- Criar formulário simples: descrição, valor, vencimento, status (pendente/paga)
- PF: salvar em `personal_transactions` com type="despesa" e status="pending"
- PJ: salvar em `transactions` com type="expense" e status="pending"
- Manter tabs Asaas como fonte secundária de dados

### Tarefa 5: Adicionar Transferências entre Contas PJ
- Criar página simples de transferência entre `bank_accounts` da empresa
- Formulário: conta origem, conta destino, valor, data, descrição
- Registrar como dois lançamentos espelhados em `transactions` (saída de uma conta, entrada em outra)

---

## Resumo de Arquivos Afetados

- `src/pages/Index.tsx` - simplificar dashboard PJ
- `src/pages/personal/PersonalDashboard.tsx` - simplificar dashboard PF
- `src/components/AppSidebar.tsx` - renomear/reorganizar menus
- `src/pages/personal/PersonalBills.tsx` - adicionar botão + form de cadastro manual
- `src/pages/CompanyBills.tsx` - adicionar botão + form de cadastro manual
- `src/pages/CompanyTransfers.tsx` - renomear, esclarecer que é Asaas
- `src/pages/personal/PersonalTransfers.tsx` - separar transferências internas do Asaas
- Possível nova página para transferências entre contas PJ

