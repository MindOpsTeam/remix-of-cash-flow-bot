
# Integracao Completa com API Asaas

## Visao Geral

Criar uma integracao production-ready com a API do Asaas, incluindo: tabela de configuracao, tabela de logs de webhook, Edge Function dedicada para receber webhooks do Asaas, Edge Function para operacoes na API Asaas (testar conexao, criar webhook automaticamente, reativar fila), e uma pagina completa de configuracao no frontend.

---

## Fase 1 - Database (Migracoes SQL)

### Tabela `asaas_config`
Armazena credenciais e configuracao do Asaas por empresa.

```text
Colunas:
- id (uuid, PK)
- company_id (uuid, FK -> companies, UNIQUE)
- environment ('sandbox' | 'production')
- api_key_sandbox (text, encrypted at rest)
- api_key_production (text, encrypted at rest)
- webhook_auth_token (text) -- token para validar webhooks
- webhook_id (text, nullable) -- ID do webhook criado no Asaas
- webhook_status ('active' | 'inactive' | 'interrupted', default 'inactive')
- notification_email (text, nullable)
- enabled_events (jsonb, default all events)
- created_at, updated_at
```

RLS: somente membros da empresa (is_company_member) podem CRUD.

### Tabela `asaas_webhook_logs`
Registra cada notificacao recebida do Asaas.

```text
Colunas:
- id (uuid, PK)
- company_id (uuid, FK -> companies)
- asaas_event (text) -- ex: PAYMENT_RECEIVED
- entity_id (text, nullable) -- ex: pay_abc123
- payload (jsonb)
- http_status_returned (integer, default 200)
- idempotency_key (text, UNIQUE) -- para deduplicacao
- processed (boolean, default false)
- error_message (text, nullable)
- created_at
```

RLS: somente membros da empresa podem SELECT. INSERT via service role (edge function).

---

## Fase 2 - Edge Functions

### Edge Function: `asaas-webhook` (recebe notificacoes)

Endpoint publico (verify_jwt = false) que:
1. Recebe POST do Asaas
2. Extrai `asaas-access-token` do header para autenticar
3. Busca `asaas_config` pelo token
4. Gera idempotency_key = `{event}_{entity_id}_{dateCreated}` para evitar duplicatas
5. Verifica se ja existe log com esse idempotency_key (processamento idempotente)
6. Registra na tabela `asaas_webhook_logs`
7. Retorna 200 imediatamente (Asaas espera resposta rapida)

Eventos suportados (todos do Asaas):
- PAYMENT_* (CREATED, UPDATED, CONFIRMED, RECEIVED, OVERDUE, DELETED, REFUNDED, etc.)
- TRANSFER_* (CREATED, PENDING, IN_BANK_PROCESSING, DONE, FAILED, etc.)
- BILL_* (CREATED, PENDING, BANK_PROCESSING, PAID, CANCELLED, FAILED, REFUNDED)
- INVOICE_* (CREATED, UPDATED, SYNCHRONIZED, AUTHORIZED, CANCELLED, ERROR)
- ANTICIPATION_* (CREATED, APPROVED, DENIED, CREDITED, etc.)
- MOBILE_PHONE_RECHARGE_* (CONFIRMED, CANCELLED)
- ACCOUNT_STATUS_* (INITIAL_ALERT, FINAL_ALERT, AWAITING_ACTION_AUTHORIZATION)
- PAYMENT_DUEDATE_WARNING, PAYMENT_CHECKOUT_VIEWED

### Edge Function: `asaas-api` (proxy autenticado)

Edge Function autenticada (valida JWT do usuario) que faz proxy para a API Asaas:

Acoes suportadas (via `action` no body):
1. **test-connection**: GET /v3/finance/getCurrentBalance -- retorna saldo
2. **create-webhook**: POST /v3/webhooks -- cria webhook automaticamente com a URL do edge function e todos os eventos habilitados
3. **reactivate-webhook**: PUT /v3/webhooks/{id} -- reenvia com `interrupted: false`
4. **get-webhook-status**: GET /v3/webhooks/{id} -- verifica status atual

A funcao busca a API key e environment da tabela `asaas_config` usando o company_id do usuario autenticado.

---

## Fase 3 - Frontend

### Rota: `/settings/integrations/asaas`

Nova pagina `src/pages/settings/AsaasIntegration.tsx` com 3 secoes:

**Secao 1 - Credenciais:**
- Input password para API Key Producao (toggle visibilidade)
- Input password para API Key Sandbox (toggle visibilidade)
- Switch Sandbox/Producao
- Input para Webhook Auth Token + botao "Gerar token" (crypto.randomUUID)
- Input para email de notificacao
- Botao "Salvar credenciais" (upsert na tabela asaas_config)
- Botao "Testar conexao" (chama edge function asaas-api action=test-connection, mostra saldo)

**Secao 2 - Webhook:**
- Badge de status colorido (ativo=verde, inativo=cinza, interrompido=amarelo)
- URL readonly do webhook (copiavel)
- Botao "Criar/Atualizar Webhook" (chama edge function asaas-api action=create-webhook)
- Botao "Reativar Fila" (se interrompido, chama action=reactivate-webhook)
- Tabela com ultimos 20 logs (data, evento, entity_id, status HTTP)

**Secao 3 - Eventos Ativos:**
- Grid de checkboxes agrupadas por categoria:
  - Cobranças (PAYMENT_*)
  - Transferências (TRANSFER_*)
  - Contas a Pagar (BILL_*)
  - Notas Fiscais (INVOICE_*)
  - Antecipações (ANTICIPATION_*)
  - Recarga Celular (MOBILE_PHONE_RECHARGE_*)
  - Status da Conta (ACCOUNT_STATUS_*)
- Botoes "Selecionar todos" / "Desmarcar todos"

### Atualizacoes no Router e Sidebar

- Adicionar rota `/settings/integrations/asaas` no App.tsx
- Adicionar link "Asaas" na pagina de Integracoes como card navegavel (alem dos webhooks genericos)

---

## Fase 4 - Configuracao

### config.toml
Adicionar as 2 edge functions com `verify_jwt = false`:
```toml
[functions.asaas-webhook]
verify_jwt = false

[functions.asaas-api]
verify_jwt = false
```

A funcao `asaas-api` valida JWT no codigo para acessar dados do usuario.
A funcao `asaas-webhook` valida via token do header.

---

## Arquivos a Criar

1. `supabase/functions/asaas-webhook/index.ts` -- receptor de webhooks
2. `supabase/functions/asaas-api/index.ts` -- proxy para API Asaas
3. `src/pages/settings/AsaasIntegration.tsx` -- pagina de configuracao

## Arquivos a Editar

1. `src/App.tsx` -- adicionar rota /settings/integrations/asaas
2. `src/pages/settings/Integrations.tsx` -- adicionar card "Asaas" com link
3. Migracoes SQL -- criar tabelas asaas_config e asaas_webhook_logs com RLS

## Nenhuma Secret Nova Necessaria

As API keys do Asaas sao armazenadas na tabela `asaas_config` (por empresa), nao como secrets do projeto. As edge functions usam SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY que ja existem.
