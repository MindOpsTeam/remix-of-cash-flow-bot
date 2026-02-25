

# Corrigir criacao de empresa usando funcao SECURITY DEFINER

## Problema
A politica de INSERT na tabela `companies` existe e esta correta (`WITH CHECK (true)` para `authenticated`), porem o INSERT continua falhando com erro 403. Isso impede a criacao automatica da empresa e, consequentemente, o botao "Conectar" nao funciona porque depende de ter uma empresa ativa (`company` e `null`).

## Solucao

Criar uma funcao de banco de dados com `SECURITY DEFINER` que cria a empresa e adiciona o usuario como membro em uma unica operacao. Essa funcao roda com os privilegios do dono da funcao (superuser), ignorando RLS.

### Passo 1 - Migracao SQL
Criar a funcao `create_company_for_user`:

```sql
CREATE OR REPLACE FUNCTION public.create_company_for_user(company_name text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_company_id uuid;
  result json;
BEGIN
  INSERT INTO companies (name) VALUES (company_name)
  RETURNING id INTO new_company_id;

  INSERT INTO company_members (company_id, user_id, role)
  VALUES (new_company_id, auth.uid(), 'admin');

  SELECT json_build_object(
    'id', c.id,
    'name', c.name,
    'cnpj', c.cnpj
  ) INTO result
  FROM companies c WHERE c.id = new_company_id;

  RETURN result;
END;
$$;
```

### Passo 2 - Atualizar useCompany.tsx
Substituir o INSERT direto por uma chamada RPC:

```typescript
const { data: newCompany, error } = await supabase
  .rpc("create_company_for_user", { company_name: "Minha Empresa" });
```

Isso elimina a dependencia das politicas RLS para a criacao inicial da empresa.

### Resultado esperado
Ao recarregar a pagina, a empresa sera criada automaticamente via funcao RPC, e o botao "Conectar" na pagina WhatsApp funcionara normalmente.

