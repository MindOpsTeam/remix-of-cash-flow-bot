

# Expansao de Eventos Asaas — Combater Confusao Patrimonial

## Problemas Atuais (Build Errors)

Antes de implementar novas funcionalidades, existem 2 arquivos compartilhados que estao faltando no repositorio e causam erros de build em TODAS as edge functions:

1. **`supabase/functions/_shared/cors.ts`** — exporta `getCorsHeaders()` e `corsPreflightResponse()`, usado por 11 edge functions
2. **`supabase/functions/_shared/validate.ts`** — exporta `parseJsonBody()`, `validate()`, `validateRequired()`, `validateEnum()`, `validateUUID()`, `validateString()`, `sanitizeForPrompt()`, usado por 6 edge functions
3. **Tipo `SupabaseClient` em `asaas-processor.ts`** — o tipo customizado nao bate com o cliente real do Supabase. Precisa usar `any` ou o tipo correto.

Esses arquivos serao criados primeiro para resolver o build.

---

## Etapa 1: Corrigir Build — Criar arquivos _shared faltantes

### `supabase/functions/_shared/cors.ts`
Implementar CORS helpers usados por todas as edge functions:
- `getCorsHeaders(req, extraHeaders?)` — retorna headers CORS padrao
- `corsPreflightResponse(req, extraHeaders?)` — responde OPTIONS com 204

### `supabase/functions/_shared/validate.ts`
Implementar validadores usados pelas edge functions:
- `parseJsonBody(req)` — parse seguro do body JSON
- `validate(...errors)` — combina erros de validacao
- `validateRequired(body, fields)` — valida campos obrigatorios
- `validateEnum(value, name, options)` — valida valor em lista
- `validateUUID(value, name)` — valida formato UUID
- `validateString(value, name)` — valida string nao vazia
- `sanitizeForPrompt(text)` — sanitiza texto para uso em prompts AI

### `supabase/functions/_shared/asaas-processor.ts`
Corrigir o tipo `SupabaseClient` para aceitar o cliente real do Supabase (usar `any` no parametro).

---

## Etapa 2: Migration SQL — Novas tabelas estruturadas

Uma unica migration criando 10 novas tabelas (5 categorias x 2 modos PF/PJ):

### Transfers (PF + PJ)
```text
asaas_transfers / company_asaas_transfers
Colunas: asaas_id, type, status, value, net_value, fee, transfer_fee,
         description, bank_account (JSONB), scheduled_date,
         transaction_receipt_url, authorized, operation_type,
         external_reference, raw_payload
UNIQUE: (owner_id, asaas_id)
```

### Bills (PF + PJ)
```text
asaas_bills / company_asaas_bills
Colunas: asaas_id, status, value, fee, description, company_name,
         identification_field, type, due_date, schedule_date,
         payment_date, can_be_cancelled, failure_reason, raw_payload
UNIQUE: (owner_id, asaas_id)
```

### Subscriptions (PF + PJ)
```text
asaas_subscriptions / company_asaas_subscriptions
Colunas: asaas_id, customer_id, billing_type, status, value,
         next_due_date, cycle, description, discount/fine/interest/split (JSONB),
         max_payments, payment_count, external_reference, end_date, raw_payload
UNIQUE: (owner_id, asaas_id)
```

### Invoices (PF + PJ)
```text
asaas_invoices / company_asaas_invoices
Colunas: asaas_id, payment_id, status, number, service_description,
         value, net_value, observations, taxes (JSONB), customer_id,
         effective_date, external_reference, municipality_inscription,
         rps_series, rps_number, pdf_url, xml_url, error_message, raw_payload
UNIQUE: (owner_id, asaas_id)
```

### Anticipations (PF + PJ)
```text
asaas_anticipations / company_asaas_anticipations
Colunas: asaas_id, status, anticipated_value, net_value, fee,
         total_value, installment_count, payment_id, anticipation_date,
         credit_date, debit_date, due_date, denial_reason, raw_payload
UNIQUE: (owner_id, asaas_id)
```

Todas com:
- RLS: `auth.uid() = user_id` (PF) / `is_company_member(company_id)` (PJ)
- Trigger `update_updated_at_column()`
- Realtime habilitado para todas as tabelas PF
- Indices em `status` e `created_at`

---

## Etapa 3: Expandir Notificacoes

### `src/hooks/usePersonalNotifications.ts`
Adicionar novos eventos ao `eventMap`:
- TRANSFER_DONE, TRANSFER_FAILED, TRANSFER_BLOCKED, etc.
- BILL_PAID, BILL_FAILED, BILL_CANCELLED, etc.
- SUBSCRIPTION_INACTIVATED, SUBSCRIPTION_DELETED
- INVOICE_AUTHORIZED, INVOICE_ERROR, INVOICE_CANCELED
- RECEIVABLE_ANTICIPATION_CREDITED, _DENIED, _OVERDUE
- BALANCE_VALUE_BLOCKED, BALANCE_VALUE_UNBLOCKED
- INTERNAL_TRANSFER_CREDIT, INTERNAL_TRANSFER_DEBIT

Expandir invalidacoes de queries para incluir as novas tabelas:
- `asaas_transfers`, `asaas_bills`, `asaas_subscriptions`, `asaas_invoices`, `asaas_anticipations`

---

## Etapa 4: Deploy

As edge functions `asaas-webhook`, `company-asaas-webhook`, `asaas-api` e `company-asaas-api` ja tem a logica de processamento via `asaas-processor.ts` (que ja cobre TRANSFER, BILL, SUBSCRIPTION, INVOICE e RECEIVABLE_ANTICIPATION). So precisam ser re-deployadas apos a criacao dos arquivos `_shared` faltantes.

---

## Resumo de Arquivos

| Arquivo | Acao |
|---------|------|
| `supabase/functions/_shared/cors.ts` | **Criar** — CORS helpers |
| `supabase/functions/_shared/validate.ts` | **Criar** — validadores |
| `supabase/functions/_shared/asaas-processor.ts` | **Editar** — corrigir tipo SupabaseClient |
| Migration SQL | **Criar** — 10 tabelas + RLS + realtime |
| `src/hooks/usePersonalNotifications.ts` | **Editar** — expandir eventMap + invalidacoes |

