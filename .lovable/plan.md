

# Integrar Pagamentos Asaas nos KPIs e Transacoes

## Problema
Os pagamentos recebidos via Asaas (tabela `asaas_payments`) nao aparecem nos KPIs do Dashboard nem na lista de transacoes. O usuario quer ver:
- Quem enviou e quando
- Valores deste mes contando no "Entradas (mes)" e "Saldo do Mes"
- Historico de transacoes Asaas visivel na pagina de transacoes

## Dados Disponiveis
A tabela `asaas_payments` ja tem dados sincronizados:
- `value`, `net_value` (valor bruto e liquido)
- `payment_date`, `confirmed_date`, `credit_date` (datas relevantes)
- `customer_id` (quem pagou)
- `status` (RECEIVED, CONFIRMED, etc.)
- `description`, `billing_type` (PIX, BOLETO, etc.)

## Alteracoes

### 1. `src/hooks/usePersonalKPIs.ts` - Incluir pagamentos Asaas nos KPIs
- Adicionar query para buscar `asaas_payments` com status RECEIVED ou CONFIRMED do mes atual
- Somar os valores (`net_value`) nas entradas do mes
- Incluir nos dados do grafico de 6 meses (como receita)
- Recalcular `saldo_mes` incluindo pagamentos Asaas

### 2. `src/hooks/usePersonalTransactions.ts` - Mesclar transacoes Asaas
- Adicionar query para buscar `asaas_payments` do usuario
- Converter cada pagamento Asaas em formato `PersonalTransaction` (virtual, readonly)
- Mesclar com transacoes manuais na lista filtrada
- Marcar com `source: "asaas"` para diferenciar na UI

### 3. `src/pages/personal/PersonalTransactions.tsx` - Exibir transacoes Asaas
- Renderizar transacoes Asaas com badge "Asaas" ou icone Zap
- Mostrar `billing_type` (PIX, Boleto) e `customer_id` como informacoes adicionais
- Transacoes Asaas sao read-only (sem botao de excluir)

### 4. `src/pages/personal/PersonalDashboard.tsx` - Ajustar KPIs
- O card "Entradas (mes)" passa a incluir pagamentos Asaas recebidos no mes
- O card "Saldo do Mes" reflete o novo total
- O grafico de 6 meses inclui receitas Asaas

## Detalhes Tecnicos

**Query de pagamentos Asaas (no hook):**
```text
supabase.from("asaas_payments")
  .select("*")
  .eq("user_id", userId)
  .in("status", ["RECEIVED", "CONFIRMED"])
```

**Mapeamento para transacao virtual:**
- `title`: description ou "Pagamento Asaas"
- `amount`: net_value (valor liquido)
- `date`: confirmed_date ou payment_date ou due_date
- `type`: "receita"
- `person`: customer_id
- `source`: "asaas" (novo campo visual)

**Calculo de KPIs ajustado:**
- `entradas_mes` = entradas manuais (view) + soma asaas_payments RECEIVED/CONFIRMED do mes
- `saldo_mes` = saldo manual (view) + soma asaas do mes
- Taxas: `value - net_value` somado ao `taxas_mes`

O grafico de 6 meses tambem inclui os pagamentos Asaas agrupados por mes usando `confirmed_date`.

