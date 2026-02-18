

## Corrigir Cache do PostgREST e Garantir Dados Iniciais

### Problema
As politicas RLS estao PERMISSIVE no banco de dados (confirmado via `pg_policy`), porem o PostgREST esta usando uma versao em cache das politicas antigas (RESTRICTIVE). Isso causa erro 403 ao tentar criar a empresa, e sem empresa nenhum dado inicial e carregado nos dropdowns.

### Causa Raiz
O PostgREST cacheia o schema e as politicas RLS. Mesmo apos a migracao que alterou as politicas para PERMISSIVE, o cache nao foi invalidado. E necessario forcar o reload do schema.

### Solucao
Uma unica migracao SQL que:

1. **Forca o reload do schema do PostgREST** usando `NOTIFY pgrst, 'reload schema'`
2. **Recria as politicas da tabela `companies`** (DROP + CREATE) como garantia extra de que o PostgREST ira detectar a mudanca
3. **Limpa triggers duplicados** - existem 2 triggers na tabela companies (`on_company_created` e `seed_accounts_on_company_create`), ambos chamando a mesma funcao. Manter apenas um.

### Detalhes Tecnicos

```sql
-- Forcar reload do PostgREST
NOTIFY pgrst, 'reload schema';

-- Recriar politica de INSERT na companies (garantia)
DROP POLICY IF EXISTS "Authenticated users can create companies" ON public.companies;
CREATE POLICY "Authenticated users can create companies"
  ON public.companies AS PERMISSIVE FOR INSERT
  TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- Recriar politica de SELECT na companies
DROP POLICY IF EXISTS "Members can view their companies" ON public.companies;
CREATE POLICY "Members can view their companies"
  ON public.companies AS PERMISSIVE FOR SELECT
  TO authenticated USING (is_company_member(id));

-- Recriar politica de UPDATE na companies
DROP POLICY IF EXISTS "Members can update their companies" ON public.companies;
CREATE POLICY "Members can update their companies"
  ON public.companies AS PERMISSIVE FOR UPDATE
  TO authenticated USING (is_company_member(id));

-- Limpar trigger duplicado
DROP TRIGGER IF EXISTS seed_accounts_on_company_create ON public.companies;

-- Garantir que o trigger correto existe
DROP TRIGGER IF EXISTS on_company_created ON public.companies;
CREATE TRIGGER on_company_created
  AFTER INSERT ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.seed_default_accounts();
```

### Nenhuma alteracao no frontend
O codigo do `TransactionForm.tsx` e `useCompany.tsx` ja estao corretos. O problema e exclusivamente no backend (cache do PostgREST).

### Resultado Esperado
Apos a migracao:
1. O PostgREST recarrega as politicas
2. O usuario faz logout e login
3. A empresa e criada automaticamente (trigger dispara seed)
4. Os dropdowns de Conta Contabil, Centro de Custo e Conta Bancaria aparecem populados
5. O usuario pode criar lancamentos imediatamente
