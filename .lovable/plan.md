

## Plano: Integrar emissão de NFS-e

### Estado atual
- `nfse_config` tabela existe com RLS corretas (`is_company_member`)
- `invoices` tabela existe mas **falta a coluna `xml_content`**
- Frontend (`NfseEmit.tsx`, `Fiscal.tsx`, rota `/fiscal/nfse/emit`) já estão no código
- `nfse-proxy` edge function existe no código mas **não está no `config.toml`** e não foi deployada
- Build error atual: `nfse-operations` falha com import `npm:node-forge@1.3.1`
- Secrets `NFSE_WORKER_URL` e `NFSE_WORKER_API_KEY` não existem

### Alterações necessárias

1. **Migration**: Adicionar coluna `xml_content TEXT` à tabela `invoices`

2. **Secrets**: Configurar `NFSE_WORKER_URL` e `NFSE_WORKER_API_KEY`

3. **Fix nfse-operations build error**: Trocar `npm:node-forge@1.3.1` por import via esm.sh para compatibilidade com o edge runtime

4. **config.toml**: Adicionar entrada para `nfse-proxy` com `verify_jwt = false`

5. **Deploy**: Deployar `nfse-proxy` e `nfse-operations`

### Arquivos editados
- `supabase/config.toml` (adicionar nfse-proxy)
- `supabase/functions/nfse-operations/index.ts` (fix import)
- Migration SQL (adicionar xml_content)

