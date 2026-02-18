

## Correção Definitiva: Políticas RLS e Trigger

### Problema
As migrações anteriores tentaram corrigir as políticas de segurança do banco de dados, mas elas continuam bloqueando todas as operações. Isso impede:
- Criação da empresa ao fazer login
- Cadastro de centros de custo
- Qualquer operação de dados na plataforma

### Causa Raiz
1. Todas as 20+ políticas de segurança estão configuradas como "restritivas" em vez de "permissivas", o que bloqueia todas as operações
2. O mecanismo que cria automaticamente os dados iniciais (plano de contas, centros de custo, conta bancária) ao criar uma empresa está ausente

### Solução
Uma migração de banco de dados que:

1. **Remove todas as políticas existentes** de todas as 6 tabelas (companies, company_members, chart_of_accounts, cost_centers, bank_accounts, transactions)

2. **Recria cada política explicitamente como PERMISSIVE** usando a sintaxe `CREATE POLICY ... AS PERMISSIVE` para garantir que funcionem corretamente

3. **Recria o trigger** `on_company_created` que dispara a função `seed_default_accounts()` quando uma nova empresa e criada

### Detalhes Tecnicos

As politicas serao recriadas com `AS PERMISSIVE` explicito em vez de depender do comportamento padrao do PostgreSQL. Exemplo:

```sql
CREATE POLICY "policy_name"
  ON public.table_name
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (condition);
```

Tabelas afetadas e quantidade de politicas:
- `companies`: 3 politicas (INSERT, SELECT, UPDATE)
- `company_members`: 2 politicas (SELECT, INSERT)
- `chart_of_accounts`: 4 politicas (SELECT, INSERT, UPDATE, DELETE)
- `cost_centers`: 4 politicas (SELECT, INSERT, UPDATE, DELETE)
- `bank_accounts`: 4 politicas (SELECT, INSERT, UPDATE, DELETE)
- `transactions`: 4 politicas (SELECT, INSERT, UPDATE, DELETE)

O trigger sera criado como:
```sql
CREATE TRIGGER on_company_created
  AFTER INSERT ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.seed_default_accounts();
```

### Apos a Correcao
Sera necessario fazer logout e login novamente para que a empresa seja criada automaticamente com todos os dados iniciais. Depois disso, os centros de custo, plano de contas e CFO Digital funcionarao normalmente.

