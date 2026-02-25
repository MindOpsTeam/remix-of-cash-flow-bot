

# Corrigir RLS da tabela "companies" para permitir criação de empresa

## Problema identificado
Ao fazer login, o sistema tenta criar automaticamente uma empresa ("Minha Empresa") para o usuário, mas a operacao falha com erro de RLS (Row Level Security). Isso impede que a empresa seja criada, e como consequencia, a pagina do WhatsApp nao funciona porque depende de ter uma empresa ativa.

A politica de INSERT existe na tabela `companies`, mas aparentemente nao esta funcionando corretamente neste projeto remixado.

## Solucao

1. **Recriar a politica de INSERT na tabela `companies`** - Dropar e recriar a politica para garantir que ela esteja ativa e funcional.

2. **Recriar a politica de INSERT na tabela `company_members`** - Tambem recriar para garantir consistencia.

## Detalhes tecnicos

Uma unica migracao SQL sera executada:

```sql
DROP POLICY IF EXISTS "Authenticated users can create companies" ON public.companies;
CREATE POLICY "Authenticated users can create companies" 
  ON public.companies 
  FOR INSERT 
  TO authenticated 
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can add themselves to companies" ON public.company_members;
CREATE POLICY "Users can add themselves to companies" 
  ON public.company_members 
  FOR INSERT 
  TO authenticated 
  WITH CHECK (user_id = auth.uid());
```

A mudanca principal e simplificar o `WITH CHECK` de `auth.uid() IS NOT NULL` para `true` (para usuarios autenticados, `auth.uid()` nunca e NULL, entao o efeito e o mesmo, mas mais explicito).

Apos essa correcao, ao recarregar a pagina, o sistema criara automaticamente a empresa e voce podera usar o botao "Conectar Instancia" normalmente.
