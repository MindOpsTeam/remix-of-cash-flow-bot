

# Por que o saldo Asaas não aparece no Patrimônio

## Diagnóstico

O fluxo já funciona parcialmente:
- A `asaas_config` está configurada (production) ✅
- O pagamento de R$120 existe em `asaas_payments` (CONFIRMED em 04/03) ✅
- O hook `usePersonalKPIs` já soma pagamentos Asaas nos KPIs do mês (entradas, gráfico) ✅
- O hook `usePersonalAccounts` já cria uma "Conta Asaas" virtual com o saldo da API ✅

**O problema**: o `ConsolidatedPatrimony` usa `totalBalance` de `usePersonalAccounts`, que **depende da Edge Function `asaas-api` retornar o saldo**. Se essa chamada falha silenciosamente ou retorna `totalBalance: undefined`, o saldo Asaas fica R$0. Além disso, a tabela `personal_accounts` está **vazia** — não há nenhuma conta manual cadastrada, então o saldo PF inteiro depende exclusivamente dessa chamada de API.

O R$120 é um **pagamento recebido**, não uma conta/saldo. Ele já aparece nos KPIs como "Entrada do mês", mas o **patrimônio** mostra o **saldo atual da conta Asaas** (que pode ser diferente do valor dos pagamentos).

## Plano de correção

### 1. Garantir que o saldo Asaas reflita no patrimônio mesmo com falhas
- Em `usePersonalAccounts`, tratar erro da Edge Function graciosamente: se falhar, usar fallback calculando a soma dos `net_value` dos `asaas_payments` com status RECEIVED/CONFIRMED como saldo aproximado.

### 2. Criar conta padrão automática
- Ao detectar `personal_accounts` vazio e Asaas configurado, auto-criar uma conta "Carteira" (tipo `checking`, saldo 0) para que o usuário tenha onde vincular transações manuais futuras.

### 3. Vincular transação órfã existente
- Migration SQL: associar a transação de R$3.240 (sem `account_id`) à conta recém-criada e recalcular saldo.

## Arquivos alterados

| Arquivo | Mudança |
|---------|---------|
| `src/hooks/usePersonalAccounts.ts` | Fallback de saldo Asaas via `asaas_payments`; auto-criar conta padrão |
| Migration SQL | Backfill `account_id` de transações órfãs + recálculo |

