

## OCR → Auto-cadastro de Contato + Registro de Nota Fiscal

**Objetivo**: Quando o usuário confirma um documento escaneado via OCR, o sistema deve:
1. Auto-cadastrar o contato (cliente/fornecedor) se não existir, com base nos dados extraídos (nome, CNPJ/CPF)
2. Se for receita (NF emitida), criar também um registro na tabela `invoices` (Vendas > Notas Fiscais)

### Mudanças

**1. Ampliar extração OCR — `supabase/functions/ocr-document/index.ts`**

- Adicionar campo `beneficiary` ao prompt de extração (já existe no prompt mas precisa garantir que captura nome e documento do tomador/destinatário)
- Adicionar campos: `beneficiary_document` (CNPJ/CPF do tomador) para facilitar cadastro

**2. Atualizar `ScanResult` — `src/hooks/useDocumentScanner.ts`**

- Adicionar `beneficiary_document` ao interface `ScanResult`

**3. Auto-cadastro de contato + invoice no `createTransactionFromScan`**

No `useDocumentScanner.ts`, na função `createTransactionFromScan`:

- **Buscar contato existente** pelo `issuer_document` (CNPJ/CPF do emitente) ou `beneficiary_document`
  - Se receita: o contato é o **beneficiary** (tomador do serviço — o cliente)
  - Se despesa: o contato é o **issuer** (fornecedor)
- **Se não existe**: inserir automaticamente na tabela `contacts` com:
  - `name`: issuer ou beneficiary
  - `document`: CNPJ/CPF
  - `type`: "customer" (se receita) ou "supplier" (se despesa)
  - `person_type`: detectar pelo tamanho do documento (11 chars = pf, 14+ = pj)
  - `company_id`: company.id
- **Se receita e document_type é nota_fiscal/nfse**: inserir na tabela `invoices` com:
  - `company_id`, `contact_id` (do contato encontrado/criado)
  - `type`: "nfse" ou "nfe" (conforme document_type)
  - `status`: "authorized"
  - `number`: document_number
  - `issue_date`: date
  - `total`: amount
  - `notes`: description

**4. Exibir contato sugerido na UI — `src/pages/DocumentScanner.tsx`**

- Na seção de dados extraídos (read-only), mostrar o nome e CNPJ do contato identificado (emitente ou beneficiário conforme o tipo)
- Adicionar indicador visual: "Contato será cadastrado automaticamente" se novo, ou "Contato existente: [nome]" se já existe

### Detalhes técnicos

- A busca de contato existente usa `supabase.from("contacts").select("id, name").eq("company_id", company.id).eq("document", cleanDoc)` onde `cleanDoc` remove pontuação
- Função auxiliar `cleanDocument(doc)` que remove `.`, `-`, `/` para comparação normalizada
- O insert no `invoices` usa `contact_id` do contato encontrado/criado
- Invalidar queries `["contacts"]` e `["invoices"]` após criação

