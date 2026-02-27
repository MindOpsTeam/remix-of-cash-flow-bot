
# Migration: Criar tabela `owner_transactions`

## Resumo
Criar uma migration SQL com duas acoes (sem alterar nenhum arquivo frontend):

### 1. Criar tabela `owner_transactions`
- Campos: id, user_id, company_id, transaction_type (com CHECK constraint), amount, date, description, pf_account_id, pj_bank_account_id, pf_transaction_id, pj_transaction_id, status, created_at, updated_at
- Foreign keys para: auth.users, companies, personal_accounts, bank_accounts, personal_transactions, transactions
- 3 indices (user_id, company_id, date DESC)
- RLS habilitado com 4 policies (SELECT, INSERT, UPDATE, DELETE) baseadas em auth.uid() = user_id
- Trigger update_updated_at usando funcao ja existente

### 2. Colunas `source` e `source_id` em `personal_transactions`
- Ja verificado: ambas as colunas **ja existem** no banco
- O `ADD COLUMN IF NOT EXISTS` sera incluido por seguranca (no-op)

### 3. Regenerar types.ts
- Apos a migration, os types serao regenerados automaticamente para incluir `owner_transactions`

### Verificacoes feitas
- Tabela `owner_transactions` ainda NAO existe
- `personal_transactions.source` ja existe (text, NOT NULL, default 'manual')
- `personal_transactions.source_id` ja existe (uuid)
- `transactions.source` ja existe
- Funcao `update_updated_at_column()` ja existe

### Nenhuma alteracao frontend
Nenhum arquivo em `src/` sera modificado manualmente. Apenas a migration SQL e a regeneracao automatica de types.
