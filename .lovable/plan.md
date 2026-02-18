

## Correcao Definitiva das Politicas RLS e Trigger

### Problema Real
Apesar de 3 tentativas anteriores de migracao, o banco de dados continua com:
- Todas as 21 politicas RLS marcadas como RESTRICTIVE (bloqueiam tudo)
- O trigger `on_company_created` ausente (dados iniciais nao sao criados)
- Resultado: 403 em toda operacao, impossivel criar empresa, centros de custo ou lancamentos

### Causa
As migracoes anteriores provavelmente usaram `CREATE POLICY ... IF NOT EXISTS` ou nao fizeram o DROP correto, mantendo as politicas restritivas originais.

### Solucao
Uma unica migracao SQL que:

1. **Faz DROP explicito de TODAS as politicas existentes por nome** em cada tabela
2. **Recria cada politica com `AS PERMISSIVE` explicito**
3. **Recria o trigger** `on_company_created` vinculado a funcao `seed_default_accounts()`

### Tabelas e Politicas Afetadas

**companies** (3 politicas):
- INSERT: qualquer usuario autenticado pode criar
- SELECT: membros podem visualizar suas empresas
- UPDATE: membros podem atualizar suas empresas

**company_members** (2 politicas):
- SELECT: membros podem ver outros membros
- INSERT: usuarios podem se adicionar a empresas

**chart_of_accounts** (4 politicas):
- SELECT, INSERT, UPDATE, DELETE para membros da empresa

**cost_centers** (4 politicas):
- SELECT, INSERT, UPDATE, DELETE para membros da empresa

**bank_accounts** (4 politicas):
- SELECT, INSERT, UPDATE, DELETE para membros da empresa

**transactions** (4 politicas):
- SELECT, UPDATE, DELETE: membros da empresa
- INSERT: membro da empresa + user_id = auth.uid()

### Trigger
```
DROP TRIGGER IF EXISTS on_company_created ON public.companies;
CREATE TRIGGER on_company_created
  AFTER INSERT ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.seed_default_accounts();
```

### Detalhes Tecnicos

A migracao usara DROP POLICY seguido de CREATE POLICY para cada politica individual, sem depender de IF NOT EXISTS. Exemplo:

```sql
DROP POLICY IF EXISTS "Authenticated users can create companies" ON public.companies;
CREATE POLICY "Authenticated users can create companies"
  ON public.companies
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
```

### Apos a Correcao
1. Fazer logout e login novamente no preview
2. A empresa sera criada automaticamente com plano de contas, centros de custo e conta bancaria
3. Testar criacao de centro de custo e lancamento

