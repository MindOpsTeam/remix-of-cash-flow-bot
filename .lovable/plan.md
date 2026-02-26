

# Atualizar Edge Functions de API Sync (PF + PJ)

## Objetivo
Substituir completamente os arquivos `asaas-api/index.ts` e `company-asaas-api/index.ts` com as versoes expandidas que incluem 3 novas acoes de sync: `sync-transfers`, `sync-bills` e `sync-subscriptions`.

## Alteracoes

### 1. `supabase/functions/asaas-api/index.ts` (PF)
Substituicao completa com o codigo fornecido. Mudancas em relacao ao atual:
- Adiciona import de `mapTransferData`, `mapBillData`, `mapSubscriptionData` do `_shared/asaas-processor.ts`
- Expande o `validateEnum` para aceitar as 3 novas acoes
- Adiciona 3 novos cases no switch: `sync-transfers`, `sync-bills`, `sync-subscriptions`
- Cada sync usa paginacao com offset/limit=100, chama o endpoint Asaas correspondente e faz upsert nas tabelas PF (`asaas_transfers`, `asaas_bills`, `asaas_subscriptions`)

### 2. `supabase/functions/company-asaas-api/index.ts` (PJ)
Substituicao completa com o codigo fornecido. Mesma logica do PF mas:
- Requer `company_id` no body (validado com `validateUUID`)
- Valida membresia do usuario na empresa via `company_members`
- Upsert nas tabelas PJ (`company_asaas_transfers`, `company_asaas_bills`, `company_asaas_subscriptions`)
- Webhook URL aponta para `company-asaas-webhook`

### 3. Deploy
Ambas as funcoes serao deployadas automaticamente apos a escrita dos arquivos.

## Nenhuma outra alteracao
Nenhum outro arquivo sera modificado. As tabelas ja existem no banco. Os modulos `_shared/` ja estao criados.

