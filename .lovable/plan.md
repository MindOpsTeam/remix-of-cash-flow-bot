

## Remover mock data — Conectar 3 páginas fiscais ao banco de dados

### Problema
As páginas Calendário de Impostos, Contas a Pagar e Arquivos Fiscais usam dados mock hardcoded. Precisam ser conectadas a tabelas reais no banco.

### 1. Criar 3 tabelas via migração

**`tax_guides`** — Guias de impostos
- `id`, `company_id`, `tipo` (text), `competencia` (text), `vencimento` (date), `valor` (numeric), `status` (text: a_pagar/pago/atrasado), `source` (text: manual/ocr/nf), `created_at`, `updated_at`
- RLS: `is_company_member(company_id)` para CRUD

**`bills_payable`** — Contas a pagar (boletos)
- `id`, `company_id`, `fornecedor` (text), `descricao` (text), `valor` (numeric), `vencimento` (date), `status` (text: a_vencer/vencido/pago), `source` (text: manual/ocr), `contact_id` (uuid nullable, FK contacts), `created_at`, `updated_at`
- RLS: `is_company_member(company_id)` para CRUD

**`fiscal_files`** — Arquivos fiscais
- `id`, `company_id`, `nome` (text), `tipo` (text: contrato/xml/certificado/outro), `file_url` (text), `file_size` (text), `source` (text: manual/ocr), `created_at`, `updated_at`
- RLS: `is_company_member(company_id)` para CRUD

### 2. Criar hooks de dados

**`src/hooks/useTaxGuides.ts`**
- useQuery para buscar `tax_guides` por `company_id`, ordenadas por `vencimento`
- Recalcula status automaticamente: se `vencimento < hoje` e status != pago → "atrasado"
- Mutation para criar/atualizar guias

**`src/hooks/useBillsPayable.ts`**
- useQuery para buscar `bills_payable` por `company_id`
- Recalcula: se `vencimento < hoje` e status != pago → "vencido", senão "a_vencer"
- Mutation para criar/atualizar

**`src/hooks/useFiscalFiles.ts`**
- useQuery para buscar `fiscal_files` por `company_id`
- Mutation para criar/deletar

### 3. Atualizar as 3 páginas

Substituir os arrays mock e `useState` por chamadas aos hooks acima. Manter exatamente o mesmo layout/design, apenas trocar a fonte de dados. Adicionar estados de loading e empty state.

### Arquivos

| Ação | Arquivo |
|------|---------|
| Migração | Criar tabelas `tax_guides`, `bills_payable`, `fiscal_files` com RLS |
| Criar | `src/hooks/useTaxGuides.ts` |
| Criar | `src/hooks/useBillsPayable.ts` |
| Criar | `src/hooks/useFiscalFiles.ts` |
| Editar | `src/pages/fiscal/TaxCalendar.tsx` — usar hook real |
| Editar | `src/pages/fiscal/BillsPayable.tsx` — usar hook real |
| Editar | `src/pages/fiscal/FiscalFiles.tsx` — usar hook real |

