

# Separação PF × PJ: Eliminar Confusão Patrimonial

## Problema

O sistema atual mistura dados do Asaas (gateway de pagamento empresarial) dentro do patrimônio pessoal:

1. **`usePersonalAccounts`** cria uma "Conta Asaas" virtual dentro das contas PF, inflando o saldo pessoal com receita da empresa
2. **`usePersonalKPIs`** soma pagamentos Asaas nos KPIs pessoais (entradas do mês, taxas)
3. **`PersonalAccounts`** exibe o card "Conta Asaas" junto das contas pessoais
4. **`ConsolidatedPatrimony`** puxa `totalBalance` de `usePersonalAccounts` (que já inclui Asaas), misturando PJ dentro de PF

Resultado: o saldo PF aparece inflado com dinheiro da empresa. Exatamente a confusão patrimonial que a plataforma deveria prevenir.

## Solução

Remover completamente o saldo Asaas do lado PF. O Asaas é um gateway empresarial e deve alimentar apenas o lado PJ. A comunicação PF↔PJ acontece **exclusivamente** via `owner_transactions` (retiradas, aportes, pró-labore, dividendos).

### 1. Limpar `usePersonalAccounts` — remover lógica Asaas

Remover do hook:
- Query `asaas_config_exists`
- Query `asaas_balance` (edge function)
- Query `asaas_payments_fallback_balance`
- Variáveis `asaasBalance`, `hasAsaas`, `asaasAccount`
- Remoção do Asaas do cálculo de `totalBalance` e `summary`

O hook passa a retornar **apenas** contas manuais de `personal_accounts`.

### 2. Limpar `usePersonalKPIs` — remover adições Asaas

Remover:
- Query `asaas_payments_kpis`
- `asaasKpiAdditions` e sua soma nos KPIs
- Realtime listener de `asaas_payments`

KPIs pessoais passam a refletir **apenas** `personal_transactions`.

### 3. Limpar `PersonalAccounts` page — remover card Asaas

Remover o bloco que renderiza o card virtual "Conta Asaas" na listagem de contas.

### 4. Alimentar PJ com saldo Asaas no `ConsolidatedPatrimony`

O saldo PJ no `ConsolidatedPatrimony` já calcula a partir de `transactions` (tabela empresarial). Para incluir o saldo Asaas no lado PJ:
- Adicionar query para `company_asaas_config` (verificar se empresa tem Asaas configurado)
- Se sim, buscar saldo via `company-asaas-api` edge function ou fallback via `company_asaas_payments`
- Somar ao `pjBalance`

Se o Asaas estiver configurado apenas no nível pessoal (`asaas_config`), ele **não aparece em lugar nenhum do patrimônio** até ser migrado para `company_asaas_config`. Isso é intencional — dinheiro do gateway precisa estar vinculado à empresa.

## Arquivos alterados

| Arquivo | Mudança |
|---------|---------|
| `src/hooks/usePersonalAccounts.ts` | Remover toda lógica Asaas (queries, variáveis, retorno) |
| `src/hooks/usePersonalKPIs.ts` | Remover query e cálculo de Asaas nos KPIs |
| `src/pages/personal/PersonalAccounts.tsx` | Remover card "Conta Asaas" |
| `src/components/ConsolidatedPatrimony.tsx` | Adicionar saldo Asaas PJ via `company_asaas_payments` |

Nenhuma migration SQL necessária.

