

# Conta Asaas Automatica na Pagina de Contas

## Problema
A pagina de Contas (`/personal/accounts`) so mostra contas manuais da tabela `personal_accounts`. Mesmo com a integracao Asaas ativa e com saldo, a conta Asaas nao aparece porque ninguem busca o saldo via API.

## Solucao
Adicionar uma conta virtual "Asaas" automaticamente quando o usuario tem integracao ativa, buscando o saldo em tempo real via edge function.

## Alteracoes

### 1. `src/hooks/usePersonalAccounts.ts`
- Adicionar query para verificar se o usuario tem `asaas_config` ativa
- Adicionar query para buscar saldo Asaas via `supabase.functions.invoke("asaas-api", { body: { action: "test-connection" } })`
- Expor `asaasAccount` (objeto virtual com nome "Conta Asaas", tipo "gateway", saldo da API) e `hasAsaas` no retorno
- Incluir o saldo Asaas no calculo de `totalBalance`

### 2. `src/pages/personal/PersonalAccounts.tsx`
- Renderizar a conta Asaas como primeiro card quando `hasAsaas` for true
- Badge "Sincronizada" (verde) no card da conta Asaas
- Icone diferenciado (Zap ou RefreshCw) para a conta Asaas
- Sem botoes de editar/excluir na conta Asaas (somente leitura)
- Incluir saldo Asaas nos cards de resumo (Saldo Total, Maior Saldo)

### 3. `src/pages/personal/PersonalDashboard.tsx`
- Incluir saldo Asaas no card "Saldo Total" para refletir o valor real

## Detalhes Tecnicos

A busca do saldo Asaas reutiliza a action `test-connection` da edge function `asaas-api`, que ja retorna `{ balance, ... }`. A query tera `staleTime` de 5 minutos para evitar chamadas excessivas.

A conta Asaas e virtual (nao gravada no banco) e renderizada condicionalmente quando `asaas_config` existe para o usuario.

