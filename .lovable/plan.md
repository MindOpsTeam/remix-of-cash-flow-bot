
# Reestruturacao da Integracao Asaas: Company-based para User-based

## Visao Geral

Migrar toda a integracao Asaas de um modelo baseado em `company_id` para `user_id`, substituir a tabela de logs por `asaas_webhook_events` com mais campos, e criar a nova tabela `asaas_payments` como espelho das cobrancas do Asaas.

---

## Fase 1 - Migracao de Database

Executar uma unica migracao SQL que:

1. **Drop tabelas antigas**: `asaas_webhook_logs` e `asaas_config`
2. **Criar `asaas_config`** com schema do usuario:
   - `user_id` (UUID, FK auth.users, UNIQUE) em vez de `company_id`
   - Novos campos: `webhook_url`, `webhook_email`, `webhook_send_type`
   - `enabled_events` como `TEXT[]` (array nativo) em vez de `JSONB`
   - RLS: `auth.uid() = user_id` para ALL operations
3. **Criar `asaas_webhook_events`** (substitui `asaas_webhook_logs`):
   - `user_id`, `event_id` (UNIQUE por user), `event_type`, `event_category`
   - `entity_id`, `entity_type`, `payload`, `processed`, `processed_at`
   - `error`, `attempts` para retry tracking
   - Indices em `event_type`, `processed`, `created_at`, `entity_id`
   - RLS: SELECT only para `auth.uid() = user_id`
4. **Criar `asaas_payments`** (espelho de cobrancas):
   - `user_id`, `asaas_id` (UNIQUE por user)
   - Todos os campos do schema fornecido (billing_type, status, value, net_value, due_date, etc.)
   - Campos JSONB para pix_transaction, credit_card, discount, fine, interest, split, chargeback, refunds
   - RLS: ALL para `auth.uid() = user_id`

---

## Fase 2 - Edge Function: `asaas-webhook`

Reescrever para usar o novo schema:

- Buscar `asaas_config` por `webhook_auth_token` (retorna `user_id` em vez de `company_id`)
- Determinar `event_category` a partir do prefixo do evento (PAYMENT, TRANSFER, BILL, etc.)
- Inserir em `asaas_webhook_events` com: `user_id`, `event_id`, `event_type`, `event_category`, `entity_id`, `entity_type`, `payload`
- Idempotencia via UNIQUE(user_id, event_id) -- usar o `id` do payload do Asaas como event_id
- Para eventos PAYMENT_*, fazer upsert em `asaas_payments` automaticamente (sincronizar espelho)
- Retornar 200 imediatamente

---

## Fase 3 - Edge Function: `asaas-api`

Reescrever para usar `user_id` em vez de `company_id`:

- Remover verificacao de company membership
- Buscar `asaas_config` por `user_id` (do JWT claims)
- Acoes mantidas: `test-connection`, `create-webhook`, `reactivate-webhook`, `get-webhook-status`
- No `create-webhook`, salvar `webhook_url` e `webhook_email` no config
- Nova acao: `sync-payments` -- busca pagamentos do Asaas e sincroniza na tabela `asaas_payments`

---

## Fase 4 - Frontend: `AsaasIntegration.tsx`

Reescrever para usar `user_id` em vez de `company_id`:

- Remover dependencia de `useCompany()` -- usar `useAuth()` para obter user
- Queries: `asaas_config` filtrado por `user_id` (RLS cuida automaticamente)
- Logs: ler de `asaas_webhook_events` em vez de `asaas_webhook_logs`
- Tabela de logs mostra: data, event_type, event_category, entity_id, processed (badge)
- Save: upsert com `user_id` em vez de `company_id`
- Chamar edge functions sem `company_id` no body (extraido do JWT)
- Novos campos no form: `webhook_send_type` (select SEQUENTIALLY/NON_SEQUENTIALLY)

---

## Arquivos

**Editar (3):**
- `supabase/functions/asaas-webhook/index.ts` -- novo schema user-based + upsert payments
- `supabase/functions/asaas-api/index.ts` -- user_id em vez de company_id
- `src/pages/settings/AsaasIntegration.tsx` -- useAuth em vez de useCompany, novas tabelas

**Migracao SQL (1):**
- Drop old tables, create 3 new tables com RLS

**Sem alteracoes em:** App.tsx, rotas, config.toml (ja configurados)
