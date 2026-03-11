

# Realtime para todas as transações, transferências e alterações

## Situação atual

**Tabelas com realtime habilitado:** `personal_transactions`, `personal_accounts`, `asaas_payments`, `asaas_webhook_events`, `company_asaas_payments`, `asaas_transfers`, `asaas_bills`, `asaas_subscriptions`, `asaas_invoices`, `asaas_anticipations` e equivalentes PJ.

**Tabelas SEM realtime:**
- `transactions` (lançamentos PJ)
- `personal_transfers`
- `owner_transactions`
- `personal_budgets`
- `personal_credit_cards`
- `personal_goals`

**Hooks/páginas SEM subscription realtime:**
- `Transactions.tsx` (PJ) — fetch manual, sem channel
- `usePersonalTransfers.ts` — sem channel
- `useOwnerTransactions.ts` — sem channel
- `useCFODashboard.ts` — sem channel
- `PersonalTransactions.tsx` — depende do hook que não tem channel próprio (KPIs tem, mas a lista não)

## Plano

### 1. Migração SQL — habilitar realtime nas tabelas faltantes

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.personal_transfers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.owner_transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.personal_budgets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.personal_credit_cards;
ALTER PUBLICATION supabase_realtime ADD TABLE public.personal_goals;
```

### 2. Criar hook centralizado `useRealtimeInvalidation.ts`

Um hook reutilizável que recebe uma lista de tabelas + filtros e invalida queries automaticamente. Isso evita duplicar channels em cada hook/página.

```typescript
// Recebe config: { table, filter, queryKeys[] }[]
// Cria um único channel com múltiplos .on() listeners
// Invalida as queryKeys correspondentes em cada evento
```

### 3. Adicionar realtime subscriptions nos hooks/páginas

| Arquivo | Mudança |
|---------|---------|
| `src/pages/Transactions.tsx` | Adicionar channel para `transactions` filtrado por `company_id`, refetch ao receber evento |
| `src/hooks/usePersonalTransfers.ts` | Adicionar channel para `personal_transfers` filtrado por `user_id`, invalidar queries |
| `src/hooks/useOwnerTransactions.ts` | Adicionar channel para `owner_transactions` filtrado por `user_id`, invalidar queries relacionadas |
| `src/hooks/useCFODashboard.ts` | Adicionar channel para `transactions` filtrado por `company_id`, re-fetch dados |
| `src/hooks/usePersonalTransactions.ts` | Adicionar channel para `personal_transactions` filtrado por `user_id` (o hook já invalida via mutation, mas falta o listener para mudanças externas como WhatsApp/webhook) |

### 4. Arquivos afetados

- **Nova migração SQL** — habilitar realtime em 6 tabelas
- `src/hooks/usePersonalTransfers.ts` — adicionar useEffect com channel
- `src/hooks/useOwnerTransactions.ts` — adicionar useEffect com channel
- `src/hooks/usePersonalTransactions.ts` — adicionar useEffect com channel para mudanças externas
- `src/hooks/useCFODashboard.ts` — adicionar channel para transactions PJ
- `src/pages/Transactions.tsx` — adicionar channel para transactions PJ

