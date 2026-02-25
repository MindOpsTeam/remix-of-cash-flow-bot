
# Corrigir leitura do saldo Asaas

## Problema

A edge function `asaas-api` retorna:
```text
{ "ok": true, "data": { "totalBalance": 0.01 } }
```

O hook `usePersonalAccounts.ts` acessa `data?.balance` (linha 82), mas o campo correto e `data?.data?.totalBalance`.

Resultado: `asaasBalance` fica `0` e `hasAsaas` funciona (porque `asaasBalanceQuery.data` existe), mas o saldo exibido e R$ 0,00 em vez de R$ 0,01.

## Correcao

**Arquivo:** `src/hooks/usePersonalAccounts.ts`

1. Linha 76: Ajustar o tipo de retorno para refletir a estrutura real da API:
   - De: `{ balance?: number; [key: string]: unknown }`
   - Para: `{ ok: boolean; data?: { totalBalance?: number } }`

2. Linha 82: Corrigir o acesso ao saldo:
   - De: `asaasBalanceQuery.data?.balance ?? 0`
   - Para: `asaasBalanceQuery.data?.data?.totalBalance ?? 0`

Nenhuma outra alteracao necessaria. O Dashboard e a pagina de Contas ja consomem `asaasBalance` e `totalBalance` do hook, entao a correcao se propaga automaticamente.
