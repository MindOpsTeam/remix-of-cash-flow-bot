

## Corrigir Dropdowns Vazios - Solucao Definitiva

### Problemas Identificados

1. **Todas as 21 politicas RLS estao RESTRICTIVE** - A configuracao atual mostra "Permissive: No" em TODAS as politicas. Quando uma politica e RESTRICTIVE, ela funciona como um filtro adicional que restringe acesso, ao inves de conceder acesso. Isso bloqueia a criacao da empresa (erro 403).

2. **O trigger nao existe** - A secao de triggers mostra "There are no triggers in the database". Isso significa que mesmo que a empresa fosse criada, a funcao `seed_default_accounts()` nunca seria chamada, e os dados iniciais (contas, centros de custo, banco) nunca seriam inseridos.

### Solucao

Uma unica migracao SQL que:

1. **Recria TODAS as 21 politicas como PERMISSIVE** (DROP + CREATE com `AS PERMISSIVE` explicito)
2. **Recria o trigger** `on_company_created` na tabela `companies`
3. **Forca reload do cache** com `NOTIFY pgrst, 'reload schema'`

### Tabelas afetadas

- `companies` (3 politicas: SELECT, INSERT, UPDATE)
- `company_members` (2 politicas: SELECT, INSERT)
- `chart_of_accounts` (4 politicas: SELECT, INSERT, UPDATE, DELETE)
- `cost_centers` (4 politicas: SELECT, INSERT, UPDATE, DELETE)
- `bank_accounts` (4 politicas: SELECT, INSERT, UPDATE, DELETE)
- `transactions` (4 politicas: SELECT, INSERT, UPDATE, DELETE)

### Fluxo apos a correcao

```text
Login -> useCompany busca company_members -> vazio
      -> INSERT companies ("Minha Empresa") -> SUCESSO (politica PERMISSIVE)
      -> Trigger on_company_created dispara seed_default_accounts()
      -> Seed cria: 16 contas, 5 centros de custo, 1 conta bancaria
      -> INSERT company_members -> SUCESSO
      -> Dropdowns carregam dados via SELECT -> SUCESSO
```

### Detalhes Tecnicos da Migracao

```sql
-- ============ COMPANIES ============
DROP POLICY IF EXISTS "Authenticated users can create companies" ON public.companies;
CREATE POLICY "Authenticated users can create companies"
  ON public.companies AS PERMISSIVE FOR INSERT
  TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Members can view their companies" ON public.companies;
CREATE POLICY "Members can view their companies"
  ON public.companies AS PERMISSIVE FOR SELECT
  TO authenticated USING (is_company_member(id));

DROP POLICY IF EXISTS "Members can update their companies" ON public.companies;
CREATE POLICY "Members can update their companies"
  ON public.companies AS PERMISSIVE FOR UPDATE
  TO authenticated USING (is_company_member(id));

-- ============ COMPANY_MEMBERS ============
DROP POLICY IF EXISTS "Members can view company members" ON public.company_members;
CREATE POLICY "Members can view company members"
  ON public.company_members AS PERMISSIVE FOR SELECT
  TO authenticated USING (is_company_member(company_id));

DROP POLICY IF EXISTS "Users can add themselves to companies" ON public.company_members;
CREATE POLICY "Users can add themselves to companies"
  ON public.company_members AS PERMISSIVE FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid());

-- (mesma logica para chart_of_accounts, cost_centers, bank_accounts, transactions)

-- ============ TRIGGER ============
DROP TRIGGER IF EXISTS on_company_created ON public.companies;
CREATE TRIGGER on_company_created
  AFTER INSERT ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.seed_default_accounts();

-- ============ CACHE ============
NOTIFY pgrst, 'reload schema';
```

### Nenhuma alteracao no frontend

O codigo do `TransactionForm.tsx` e `useCompany.tsx` ja esta correto. O problema e 100% no backend.

### Apos a migracao

O usuario precisa fazer logout e login novamente para que o fluxo de criacao da empresa seja re-executado com as politicas corrigidas.

