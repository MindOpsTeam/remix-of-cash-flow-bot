

# Clonar Integracao Asaas para Modo Empresa (PJ)

## Objetivo
Replicar toda a infraestrutura de integracao Asaas que hoje funciona por `user_id` (pessoal) para funcionar por `company_id` (empresarial), seguindo o padrao existente do projeto onde tabelas PJ usam `company_id` + RLS via `is_company_member()`.

## Alteracoes

### 1. Banco de Dados - 3 novas tabelas + realtime

**Tabela `company_asaas_config`** - Espelho da `asaas_config` mas com `company_id`:
- Mesmas colunas: environment, api_keys, webhook_*, enabled_events, etc.
- RLS: `is_company_member(company_id)` para ALL

**Tabela `company_asaas_payments`** - Espelho da `asaas_payments` mas com `company_id`:
- Mesmas colunas: asaas_id, customer_id, status, value, net_value, billing_type, etc.
- UNIQUE(company_id, asaas_id)
- RLS: `is_company_member(company_id)` para ALL

**Tabela `company_asaas_webhook_events`** - Espelho da `asaas_webhook_events` mas com `company_id`:
- Mesmas colunas: event_id, event_type, event_category, payload, etc.
- UNIQUE(company_id, event_id)
- RLS: `is_company_member(company_id)` para SELECT (service role insere)

Habilitar realtime para `company_asaas_payments`.

### 2. Edge Functions

**`supabase/functions/company-asaas-api/index.ts`** - Clone do `asaas-api`:
- Recebe `company_id` no body
- Valida que o usuario e membro da empresa via query em `company_members`
- Busca config em `company_asaas_config` por `company_id`
- Sync de pagamentos grava em `company_asaas_payments`
- Restante da logica identica (test-connection, create-webhook, sync-payments, etc.)

**`supabase/functions/company-asaas-webhook/index.ts`** - Clone do `asaas-webhook`:
- Busca config em `company_asaas_config` por `webhook_auth_token`
- Insere eventos em `company_asaas_webhook_events`
- Upsert de pagamentos em `company_asaas_payments`

### 3. Pagina de Configuracao

**`src/pages/settings/AsaasIntegration.tsx`** - Adaptar para modo dual:
- Detectar se esta no modo business (rota `/settings/...`) ou personal (rota `/personal/...`)
- No modo business: usar `company_id` do hook `useCompany`, chamar `company-asaas-api`, ler de `company_asaas_config`
- No modo personal: manter comportamento atual com `user_id` e `asaas-api`
- A UI permanece identica, apenas muda a fonte de dados e as funcoes chamadas

### 4. Rota no App.tsx
A rota `/settings/integrations/asaas` ja existe e aponta para `AsaasIntegrationPage`. Nenhuma mudanca necessaria aqui.

### 5. Integracao com Dashboard Empresarial (futuro)
As tabelas `company_asaas_payments` ficarao disponiveis para futura integracao com os KPIs e transacoes do modo empresarial, similar ao que ja foi feito no modo pessoal.

## Detalhes Tecnicos

**Migration SQL** cria as 3 tabelas, indices unicos, RLS policies e habilita realtime.

**AsaasIntegration.tsx** - mudanca principal:
```text
const isBusinessRoute = !location.pathname.startsWith("/personal");
const { company } = useCompany();

// Tabelas e funcoes variam conforme o modo:
const configTable = isBusinessRoute ? "company_asaas_config" : "asaas_config";
const eventsTable = isBusinessRoute ? "company_asaas_webhook_events" : "asaas_webhook_events";
const edgeFunction = isBusinessRoute ? "company-asaas-api" : "asaas-api";
const ownerFilter = isBusinessRoute 
  ? { key: "company_id", value: company?.id }
  : { key: "user_id", value: user?.id };
```

**Edge function `company-asaas-api`** - validacao de membro:
```text
const { data: membership } = await serviceClient
  .from("company_members")
  .select("id")
  .eq("company_id", companyId)
  .eq("user_id", userId)
  .maybeSingle();
if (!membership) return 403;
```

Isso garante isolamento completo entre dados pessoais e empresariais, cada um com suas proprias tabelas, RLS e edge functions.

