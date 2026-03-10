

# Auditoria Completa e Plano de Refatoração

## Falhas Encontradas

### 1. Valores que Não Batem

**PJ Balance no "Patrimônio Consolidado" é fictício:**
- `ConsolidatedPatrimony.tsx` calcula saldo PJ como `SUM(revenue) - SUM(expense)` de TODAS as transações confirmadas de todos os tempos. Isso não é saldo bancário real — é apenas o "resultado acumulado". Ignora saldos iniciais das contas bancárias (`bank_accounts`) e não reflete a realidade.

**Personal KPIs view retorna ZERO se não houver transações no mês:**
- `v_personal_kpis` usa `GROUP BY user_id` com filtro de mês atual. Se o usuário não tem transações no mês, a view retorna 0 linhas (não uma linha com zeros). O hook usa `maybeSingle()` e cai no fallback de zeros, mas as taxas/vencidas do Asaas que existem também desaparecem.

**Forecast pessoal trata TODOS os pagamentos Asaas como entradas:**
- `usePersonalForecast.ts` linha 68: pagamentos pendentes do Asaas são somados como `dailyEntradas`, mas pagamentos Asaas são cobranças que o usuário EMITIU — são receitas a receber, não genéricas. Se o conceito mudar, os valores ficam errados.

### 2. CFO Chat Widget Aparece no Modo Pessoal mas Não Funciona

- `CFOChatWidget` é renderizado em `AppLayout`, que é usado por TODAS as páginas (PF e PJ).
- O widget usa `useCompany()`, que retorna `null` no modo pessoal.
- Resultado: o botão flutuante aparece, o usuário clica, mas nenhuma mensagem é enviada (guard `if (!company) return`).

### 3. WhatsApp no Sidebar Pessoal mas É Business-Only

- `personalNav` inclui WhatsApp em "Análise" (linha 128 do AppSidebar).
- A página `WhatsAppAgent.tsx` usa `useCompany()` — sem empresa, nada funciona.
- A rota `/whatsapp` não tem guarda de modo (é "shared"), mas a funcionalidade é 100% PJ.

### 4. Dashboard PJ Genérico e Sem Destaque da IA

- O dashboard principal (`Index.tsx`) é uma tela padrão de KPIs + gráfico + últimos lançamentos.
- O CFO Digital e o sistema de mensageria (WhatsApp) — que são os diferenciais — estão enterrados em submenus.
- Não há nenhum card ou call-to-action no dashboard que destaque essas funcionalidades.

### 5. Notificações Só no Modo Pessoal

- `NotificationBell` retorna `null` se `mode !== "personal"` (linha 14).
- Empresas não recebem notificações na UI, perdendo alertas importantes.

### 6. Mock Data Ainda em Uso

- `KPICard.tsx` importa `formatCurrency` de `src/lib/mock-data.ts`.
- O arquivo `mock-data.ts` contém transações hardcoded que não são mais usadas mas o utilitário `formatCurrency` sim.

### 7. Gráfico Pessoal com Meses em Inglês

- `usePersonalKPIs.ts` linha 127: `format(new Date(...), "MMM")` gera nomes de meses em inglês ("Jan", "Feb") em vez de português ("Jan", "Fev"), inconsistente com o resto da interface em PT-BR.

### 8. Console Warning: forwardRef no Simulator

- `Simulator.tsx` passa `ReactMarkdown` como children de um componente que tenta atribuir ref, gerando warning no console.

---

## Plano de Refatoração

### Tarefa 1: Corrigir Cálculo de Saldo PJ no Patrimônio Consolidado
- Usar soma dos `bank_accounts` (se existir um campo de saldo) ou deixar claro no label que é "Resultado Acumulado" e não "Saldo".
- Adicionar o saldo Asaas separadamente como "Conta Virtual Asaas".

### Tarefa 2: Esconder CFO Chat Widget no Modo Pessoal
- Em `AppLayout.tsx`, renderizar `<CFOChatWidget />` apenas quando `isBusiness` é true.
- Ou: criar versão pessoal do chat que não dependa de `company`.

### Tarefa 3: Remover WhatsApp do Menu Pessoal
- Retirar o item WhatsApp de `personalNav` no `AppSidebar.tsx`.
- Adicionar guarda `BusinessRoute` na rota `/whatsapp` em `App.tsx`.

### Tarefa 4: Destacar IA e Mensageria nos Dashboards
- Adicionar card de "CFO Digital" e "WhatsApp Agent" no dashboard PJ com status (mensagens recentes, última análise).
- No dashboard pessoal, adicionar card de acesso rápido ao resumo executivo com insight da IA mais proeminente.

### Tarefa 5: Extrair `formatCurrency` do Mock Data
- Mover `formatCurrency` para `src/lib/utils.ts`.
- Atualizar todos os imports.
- Remover `mock-data.ts` se nada mais o referenciar.

### Tarefa 6: Corrigir Meses em Português no Gráfico Pessoal
- Adicionar `{ locale: ptBR }` ao `format()` em `usePersonalKPIs.ts`.

### Tarefa 7: Ativar Notificações para Modo Empresarial
- Remover a condição `if (mode !== "personal") return null` do `NotificationBell`.
- Criar hook `useBusinessNotifications` ou adaptar o existente para funcionar com alertas PJ (ex: cobranças vencidas da empresa).

### Tarefa 8: Corrigir View v_personal_kpis
- Reformular a view para usar `LEFT JOIN` ou subconsulta que sempre retorne uma linha, mesmo sem transações no mês, garantindo que taxas e vencidas do Asaas sejam exibidas.

### Tarefa 9: Fix ReactMarkdown forwardRef Warning
- Envolver `ReactMarkdown` com `React.forwardRef` ou usar wrapper em `Simulator.tsx`.

