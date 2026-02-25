

# Atualizar Lista Completa de 80 Eventos Asaas + Corrigir Edge Function

## Problema Atual
- A lista de eventos no frontend tem apenas ~45 eventos (incompleta e com nomes incorretos em algumas categorias como "Antecipacoes" e "Status da Conta")
- A edge function `asaas-api` no action `create-webhook` NAO envia o campo `events` no payload, ou seja, o webhook e criado sem especificar quais eventos receber
- A edge function `asaas-webhook` nao reconhece as novas categorias (SUBSCRIPTION, CHECKOUT, BALANCE, INTERNAL_TRANSFER, ACCESS_TOKEN, RECEIVABLE_ANTICIPATION)

## Mudancas

### 1. Frontend: `src/pages/settings/AsaasIntegration.tsx`

Substituir o objeto `ALL_EVENTS` pela lista oficial completa de 80 eventos, agrupados em 11 categorias:

- **Cobrancas** (28 eventos): inclui novos como PAYMENT_PARTIALLY_REFUNDED, PAYMENT_REFUND_IN_PROGRESS, PAYMENT_REFUND_DENIED, PAYMENT_ANTICIPATED, PAYMENT_AUTHORIZED, PAYMENT_AWAITING_RISK_ANALYSIS, PAYMENT_APPROVED_BY_RISK_ANALYSIS, PAYMENT_REPROVED_BY_RISK_ANALYSIS, PAYMENT_CREDIT_CARD_CAPTURE_REFUSED, PAYMENT_SPLIT_CANCELLED, PAYMENT_SPLIT_DIVERGENCE_BLOCK, PAYMENT_SPLIT_DIVERGENCE_BLOCK_FINISHED
- **Assinaturas** (7 eventos): categoria nova
- **Notas Fiscais** (8 eventos): corrigir INVOICE_CANCELED (era INVOICE_CANCELLED)
- **Transferencias** (7 eventos): sem mudancas
- **Pague Contas** (7 eventos): sem mudancas
- **Antecipacoes** (7 eventos): renomear de ANTICIPATION_* para RECEIVABLE_ANTICIPATION_* + novos eventos (SCHEDULED, PENDING)
- **Recarga Celular** (4 eventos): adicionar PENDING e REFUNDED
- **Situacao da Conta** (16 eventos): substituir os 3 eventos antigos pelos 16 novos oficiais (BANK_ACCOUNT_INFO, COMMERCIAL_INFO, DOCUMENT, GENERAL_APPROVAL)
- **Checkout** (4 eventos): categoria nova
- **Bloqueios de Saldo** (2 eventos): categoria nova
- **Movimentacoes Internas** (2 eventos): categoria nova
- **Chaves de API** (6 eventos): categoria nova -- REMOVIDO pois nao e da lista oficial (total fica 92 com eles, mas o user disse 80)

Nota: O user listou 98 eventos no total (incluindo ACCESS_TOKEN), mas chamou de "80 eventos". Implementarei todos os listados.

### 2. Edge Function: `supabase/functions/asaas-api/index.ts`

No action `create-webhook`, adicionar os campos que faltam no payload:
- `name: "FinanceAI - Webhook Automatico"`
- `events: config.enabled_events` (array com os eventos selecionados pelo usuario)

Isso garante que o webhook sera criado no Asaas com os eventos corretos.

### 3. Edge Function: `supabase/functions/asaas-webhook/index.ts`

Atualizar a funcao `getEventCategory` para reconhecer as novas categorias:
- SUBSCRIPTION_* -> SUBSCRIPTION
- CHECKOUT_* -> CHECKOUT
- BALANCE_* -> BALANCE
- INTERNAL_TRANSFER_* -> INTERNAL_TRANSFER
- ACCESS_TOKEN_* -> ACCESS_TOKEN
- RECEIVABLE_ANTICIPATION_* -> RECEIVABLE_ANTICIPATION

E atualizar `getEntityFromPayload` para extrair entidades de subscription e checkout.

### Arquivos Editados (3)

1. `src/pages/settings/AsaasIntegration.tsx` -- nova lista completa de eventos
2. `supabase/functions/asaas-api/index.ts` -- adicionar `name` e `events` no payload do webhook
3. `supabase/functions/asaas-webhook/index.ts` -- novas categorias no getEventCategory

### Sem Migracoes de Database

Nenhuma alteracao de schema necessaria. Os campos `enabled_events` (TEXT[]) e `event_category` (text) ja suportam os novos valores.

