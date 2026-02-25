

# Implementacao Completa: Secoes 9-14 do Modulo Pessoal

Este plano cobre 6 grandes funcionalidades. Dado o escopo, sera dividido em fases incrementais para garantir qualidade.

---

## Fase 1: Database Views e Infraestrutura

Criar views SQL para centralizar calculos que serao usados em multiplas paginas:

**Migracao SQL:**
- `v_personal_kpis`: KPIs do mes atual (entradas, saidas, saldo, taxas, cobrancas vencidas)
- `v_personal_month_compare`: Comparativo mes atual vs anterior (receita, despesa, variacao %)
- `v_personal_forecast`: Projecao 30 dias baseada em transacoes recorrentes + cobrancas pendentes do Asaas

Fonte de dados: `personal_transactions` + `asaas_payments` (filtrados por `user_id`).

---

## Fase 2: Dashboard Pessoal Aprimorado (secoes 11 e 12 parciais)

**Arquivo:** `src/pages/personal/PersonalDashboard.tsx` (reescrever)

- Manter os 4 KPI cards atuais
- Adicionar grafico de barras empilhadas (Recharts `ComposedChart`): receita liquida (verde) vs despesas (rose) por mes, com linha de resultado liquido sobreposta
- Adicionar AI Insight Card com dados reais usando funcao `generateInsight(kpis, comparison)` que prioriza alertas (inadimplencia > queda receita > taxas altas > saldo negativo)

**Novo hook:** `src/hooks/usePersonalKPIs.ts`
- Busca dados das views `v_personal_kpis` e `v_personal_month_compare`
- Tambem calcula dados dos ultimos 6 meses para o grafico mensal

---

## Fase 3: Previsao de Fluxo Pessoal (/personal/forecast) - Secao 9

**Novo arquivo:** `src/pages/personal/PersonalForecast.tsx`

- Grafico de area (Recharts `AreaChart`) com proximos 30 dias
- Area verde: entradas previstas (cobrancas pendentes Asaas + recorrencias)
- Area rose: saidas previstas (despesas recorrentes)
- Linha: saldo acumulado projetado
- Referencia no zero; area vermelha translucida se cruzar zero
- 3 cards acima: "Previsto a receber (30d)", "Previsto a pagar (30d)", "Saldo projetado"

**Novo hook:** `src/hooks/usePersonalForecast.ts`
- Busca cobrancas pendentes do Asaas (`asaas_payments` com status PENDING/CONFIRMED)
- Busca transacoes recorrentes (`personal_transactions` com `is_recurring = true`)
- Projeta 30 dias a frente

**Rota:** `/personal/forecast`
**Sidebar:** Adicionar item "Previsao" no `personalItems`

---

## Fase 4: Resumo Executivo Pessoal (/personal/summary) - Secao 10

**Novo arquivo:** `src/pages/personal/PersonalSummary.tsx`

5 cards com texto dinamico gerado client-side (sem IA):

1. **Visao Geral do Mes**: "Em {mes}, voce recebeu R$ {entradas} de {qtd} cobrancas..."
2. **Comparativo**: "Comparado ao mes anterior, sua receita {subiu/caiu} {X}%..."
3. **Inadimplencia**: "Voce tem {N} cobranca(s) vencida(s)..." ou "Nenhuma cobranca vencida!"
4. **Previsao**: "Para os proximos 30 dias, voce tem R$ {a_receber}..."
5. **Taxas**: "Voce pagou R$ {taxas} em taxas de gateway..."

Usa os mesmos hooks `usePersonalKPIs` e `usePersonalForecast`.

**Rota:** `/personal/summary`
**Sidebar:** Adicionar item "Resumo" no `personalItems`

---

## Fase 5: Notificacoes In-App - Secao 12

**Novo arquivo:** `src/hooks/usePersonalNotifications.ts`
- Subscribe a `asaas_webhook_events` via Supabase Realtime
- Mapeia eventos para toasts: PAYMENT_RECEIVED (verde), PAYMENT_CONFIRMED (azul), PAYMENT_OVERDUE (amber), PAYMENT_REFUNDED (rose), TRANSFER_DONE (neutro), BILL_PAID (neutro)
- Toast bottom-right, estilo escuro, 5 segundos

**Componente:** `src/components/NotificationBell.tsx`
- Icone de sino na navbar (AppLayout) com badge de contagem
- Dropdown com ultimas notificacoes nao lidas
- Marca como lido ao clicar

**Tabela:** Usar `personal_alerts` ja existente para persistir notificacoes.

**Migracao:** Habilitar realtime na tabela `asaas_webhook_events`:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.asaas_webhook_events;
```

---

## Fase 6: Contas Aprimoradas - Secao 13

**Arquivo:** `src/pages/personal/PersonalAccounts.tsx` (aprimorar)

- Adicionar conta "Asaas" automatica com badge "Sincronizada" quando integracao ativa
- Saldo Asaas atualizado via API (busca saldo da edge function `asaas-api` action `test-connection`)
- Saldo das contas manuais calculado: `initial_balance + SUM(receitas) - SUM(despesas)` das transacoes vinculadas

---

## Fase 7: Regras de Negocio - Secao 14

**Modificacoes em `PersonalTransactions.tsx`:**
- Transacoes com `source='asaas'` sao READONLY (sem botao editar/excluir valor/data/status)
- Permitir apenas recategorizacao e notas
- Transacoes manuais (`source='manual'`) totalmente editaveis

**Migracao:** Adicionar colunas `source` e `source_id` na tabela `personal_transactions`:
```sql
ALTER TABLE personal_transactions
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS source_id text;
CREATE UNIQUE INDEX IF NOT EXISTS idx_personal_tx_source_unique
  ON personal_transactions(user_id, source, source_id)
  WHERE source_id IS NOT NULL;
```

---

## Resumo de Arquivos

| Arquivo | Acao |
|---|---|
| Migracao SQL | Views + colunas source/source_id + realtime |
| `src/hooks/usePersonalKPIs.ts` | Criar (KPIs + comparativo mensal) |
| `src/hooks/usePersonalForecast.ts` | Criar (projecao 30 dias) |
| `src/hooks/usePersonalNotifications.ts` | Criar (realtime Asaas events) |
| `src/components/NotificationBell.tsx` | Criar (sino + badge + dropdown) |
| `src/pages/personal/PersonalDashboard.tsx` | Reescrever (grafico + insight IA) |
| `src/pages/personal/PersonalForecast.tsx` | Criar (previsao fluxo pessoal) |
| `src/pages/personal/PersonalSummary.tsx` | Criar (resumo executivo pessoal) |
| `src/pages/personal/PersonalAccounts.tsx` | Aprimorar (conta Asaas sync) |
| `src/pages/personal/PersonalTransactions.tsx` | Aprimorar (readonly Asaas) |
| `src/components/AppSidebar.tsx` | Adicionar Previsao e Resumo |
| `src/components/AppLayout.tsx` | Adicionar NotificationBell |
| `src/App.tsx` | Adicionar 2 rotas novas |

---

## Ordem de Implementacao

1. Migracao SQL (views + colunas + realtime)
2. Hooks (usePersonalKPIs, usePersonalForecast, usePersonalNotifications)
3. Dashboard aprimorado com grafico e insight
4. Pagina Previsao de Fluxo
5. Pagina Resumo Executivo
6. NotificationBell + integracao AppLayout
7. Contas com Asaas sync
8. Regras de negocio (readonly Asaas transactions)
9. Rotas e sidebar

