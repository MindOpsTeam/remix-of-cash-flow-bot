
# Sincronizar Dashboard Pessoal com Realtime do Asaas

## Problema
Quando um pagamento chega via webhook do Asaas, a tabela `asaas_payments` e atualizada no banco. A pagina de transacoes (`/personal/transactions`) funciona porque ao navegar para ela os dados sao buscados novamente. Porem o Dashboard (`/personal`) nao tem nenhuma subscription realtime -- os dados ficam no cache do React Query e so atualizam manualmente (refresh da pagina).

O hook `usePersonalNotifications` ja escuta `asaas_webhook_events` via realtime e dispara toasts, mas nao invalida as queries de KPIs nem de transacoes Asaas usadas pelo dashboard.

## Solucao

### 1. Adicionar realtime no `usePersonalKPIs.ts`
Adicionar um `useEffect` com subscription Supabase Realtime na tabela `asaas_payments` (filtrado por `user_id`). Ao receber INSERT ou UPDATE, invalidar as query keys:
- `asaas_payments_kpis`
- `personal_kpis`
- `personal_month_compare`
- `personal_monthly_chart`

Isso garante que os cards de Entradas, Saldo do Mes, Taxas e o grafico de 6 meses atualizem automaticamente.

### 2. Expandir o `usePersonalNotifications.ts`
Aproveitar a subscription existente em `asaas_webhook_events` para tambem invalidar as queries do dashboard quando um evento de pagamento chegar:
- `asaas_payments_kpis`
- `asaas_payments_transactions`
- `asaas_balance`
- `personal_kpis`
- `personal_monthly_chart`

### 3. Habilitar Realtime na tabela `asaas_payments`
Criar uma migration SQL para adicionar a tabela `asaas_payments` a publication `supabase_realtime`, permitindo que o Supabase Realtime notifique o frontend sobre mudancas nela.

## Detalhes Tecnicos

**Migration SQL:**
```text
ALTER PUBLICATION supabase_realtime ADD TABLE public.asaas_payments;
```

**usePersonalKPIs.ts** -- adicionar no hook:
```text
useEffect(() => {
  if (!user?.id) return;
  const channel = supabase
    .channel("dashboard-asaas-payments")
    .on("postgres_changes", {
      event: "*",
      schema: "public",
      table: "asaas_payments",
      filter: `user_id=eq.${user.id}`,
    }, () => {
      queryClient.invalidateQueries({ queryKey: ["asaas_payments_kpis"] });
      queryClient.invalidateQueries({ queryKey: ["personal_kpis"] });
      queryClient.invalidateQueries({ queryKey: ["personal_month_compare"] });
      queryClient.invalidateQueries({ queryKey: ["personal_monthly_chart"] });
      queryClient.invalidateQueries({ queryKey: ["asaas_balance"] });
    })
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}, [user?.id, queryClient]);
```

**usePersonalNotifications.ts** -- adicionar invalidacoes extras no callback existente:
```text
queryClient.invalidateQueries({ queryKey: ["asaas_payments_kpis"] });
queryClient.invalidateQueries({ queryKey: ["asaas_payments_transactions"] });
queryClient.invalidateQueries({ queryKey: ["asaas_balance"] });
```

Isso cria duas camadas de atualizacao: (1) realtime direto na tabela `asaas_payments` para o dashboard, e (2) o webhook event como trigger secundario que tambem invalida o cache.
