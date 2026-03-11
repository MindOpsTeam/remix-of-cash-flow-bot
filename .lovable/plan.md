

# Partidas Dobradas e Conciliação — Plano

## Contexto atual

A aplicação tem múltiplas fontes de dados financeiros:

| Fonte | Tabela PF | Tabela PJ |
|-------|-----------|-----------|
| Manual (plataforma) | `personal_transactions` (source=manual) | `transactions` (source=manual) |
| WhatsApp | `personal_transactions` (source=whatsapp) | `transactions` (source=whatsapp) |
| Asaas API | `asaas_payments` (merge client-side) | `company_asaas_payments` (merge client-side) |
| Inter API | — | `transactions` (source=inter, external_id) |

**Problemas identificados:**

1. **Sem partidas dobradas**: Transações não geram contrapartidas contábeis. Ex: uma despesa de R$100 deveria debitar "Despesas" e creditar "Caixa/Banco", mas hoje só registra um lado.
2. **Duplicação potencial**: Usuário registra "Aluguel R$2000" via WhatsApp, e depois o mesmo aluguel aparece na API do banco. Ficam dois lançamentos.
3. **Asaas é mergeado client-side**: `usePersonalTransactions` faz merge em memória de `personal_transactions` + `asaas_payments`. Não há conciliação real.
4. **Tabela `personal_reconciliation` existe** mas não está sendo usada em nenhum hook ou página.

## Solução proposta

### 1. Modelo de Partidas Dobradas

Adicionar tabela `journal_entries` (PF) e `company_journal_entries` (PJ) para registrar os lançamentos contábeis com débito e crédito:

```text
journal_entries
├── id (uuid)
├── user_id (uuid)
├── transaction_id → personal_transactions.id
├── debit_account (text)   — ex: "Despesas:Alimentação"
├── credit_account (text)  — ex: "Ativo:Carteira"
├── amount (numeric)
├── date (date)
├── description (text)
└── created_at (timestamptz)
```

A cada inserção em `personal_transactions`, um trigger ou lógica no hook cria automaticamente o journal entry correspondente:
- **Despesa**: Débito na categoria de despesa, Crédito na conta (account_id)
- **Receita**: Débito na conta (account_id), Crédito na categoria de receita

### 2. Conciliação automática

Criar Edge Function `reconcile-transactions` que:

1. Ao receber dados da API (Inter sync, Asaas webhook), antes de inserir, busca transações manuais/whatsapp no mesmo período (±2 dias) com valor similar (±5%)
2. Se encontrar match:
   - Atualiza a transação manual existente com `status = "reconciled"`, `source = "reconciled"`, `external_id` do banco
   - NÃO cria duplicata
3. Se não encontrar match:
   - Insere normalmente como nova transação

**Critérios de matching:**
- Mesmo `user_id` / `company_id`
- Tipo compatível (receita↔credit, despesa↔debit)
- Valor dentro de margem de 5% (taxas bancárias podem alterar ligeiramente)
- Data dentro de janela de ±2 dias
- Status != "reconciled" (evita re-conciliar)

### 3. Materializar Asaas no banco

Em vez do merge client-side atual, o webhook Asaas já deveria inserir em `personal_transactions` (source="asaas") com `external_id = asaas_id`. Isso permite conciliação uniforme e simplifica o frontend.

### 4. UI de Conciliação

Página/modal onde o usuário vê transações com possíveis duplicatas detectadas e pode:
- Confirmar match (conciliar)
- Rejeitar match (manter ambas)
- Resolver manualmente

### Arquivos afetados

- **Migração SQL**: criar `journal_entries`, `company_journal_entries`, trigger para gerar entries automáticos
- **`supabase/functions/reconcile-transactions/index.ts`**: nova Edge Function de conciliação
- **`supabase/functions/whatsapp-webhook/index.ts`**: chamar conciliação antes de inserir
- **`supabase/functions/inter-banking/index.ts`**: chamar conciliação no sync
- **`supabase/functions/asaas-webhook/index.ts`**: inserir em `personal_transactions` com source="asaas" em vez de só `asaas_payments`
- **`src/hooks/usePersonalTransactions.ts`**: remover merge client-side de `asaas_payments` (dados já estarão em `personal_transactions`)
- **Nova página `src/pages/personal/PersonalReconciliation.tsx`**: UI de conciliação

### Ordem de implementação

1. Migração SQL (tabelas + triggers de journal entries)
2. Edge Function de conciliação
3. Atualizar webhooks (Asaas, Inter, WhatsApp) para usar conciliação
4. Simplificar hooks frontend
5. UI de conciliação

