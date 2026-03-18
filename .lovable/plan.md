

## Plano: Deploy da Edge Function `nfse-operations`

### Problema
O build falha porque a diretiva `// @deno-types="npm:@types/node-forge@1.3.11"` não resolve no ambiente de deploy. O `npm:node-forge@1.3.1` funciona sem tipos explícitos.

### Alteração
1. **Reescrever** `supabase/functions/nfse-operations/index.ts` com o conteúdo fornecido, removendo a linha `// @deno-types=...` (linha 16 do conteúdo atual)
2. **Adicionar** `verify_jwt = false` no `supabase/config.toml` para a função
3. **Deploy** automático

Arquivo único: `supabase/functions/nfse-operations/index.ts`
Config: `supabase/config.toml` (adicionar entrada)

