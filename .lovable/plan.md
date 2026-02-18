

## Dashboard Inteligente no CFO Digital

### Visao Geral

Vou transformar a pagina do CFO Digital para incluir um **dashboard em tempo real** acima do chat, com KPIs, graficos e insights automaticos gerados pela IA -- tudo baseado nos dados reais do banco de dados.

### Layout da Pagina

A pagina tera duas secoes principais:

1. **Dashboard com dados em tempo real** (topo)
2. **Chat interativo com o CFO Digital** (abaixo)

---

### 1. Dashboard em Tempo Real

O dashboard vai buscar os dados diretamente do banco (`transactions`, `chart_of_accounts`, `cost_centers`) e exibir:

**KPIs (4 cards no topo):**
- Receita do mes atual
- Despesas do mes atual
- Resultado (lucro/prejuizo)
- Margem liquida (%)

Cada KPI mostra a variacao percentual em relacao ao mes anterior.

**Grafico de Receitas vs Despesas** (ultimos 6 meses):
- Grafico de barras usando Recharts, com dados reais das transacoes agrupadas por mes.

**Breakdown por Centro de Custo:**
- Lista dos centros de custo com valores e porcentagem da receita total do mes.

**Dica Rapida do CFO:**
- Um card que chama a edge function automaticamente ao carregar a pagina, pedindo uma dica curta e acionavel baseada nos dados atuais. Algo como "3 insights rapidos sobre sua saude financeira".

---

### 2. Chat (mantido como esta)

O chat interativo, botoes de perguntas rapidas e o input de texto permanecem exatamente como estao hoje, logo abaixo do dashboard.

---

### Detalhes Tecnicos

**Novo hook `useCFODashboard`:**
- Busca transacoes, contas e centros de custo do banco via Supabase client
- Calcula KPIs (receita, despesa, resultado, margem) para o mes atual e anterior
- Agrupa transacoes por mes para o grafico de 6 meses
- Agrupa despesas por centro de custo
- Retorna tudo pronto para renderizacao

**Alteracoes em `src/pages/CFODigital.tsx`:**
- Importar e usar o novo hook `useCFODashboard`
- Adicionar secao de KPIs com o componente `KPICard` ja existente
- Adicionar grafico Recharts (BarChart) com dados reais
- Adicionar card de centros de custo
- Adicionar card de "Dica do CFO" que faz uma chamada automatica a edge function pedindo um insight curto
- Manter todo o chat existente abaixo

**Novo arquivo: `src/hooks/useCFODashboard.ts`**

**Nenhuma alteracao no banco de dados ou edge function** -- tudo usa os dados e endpoints existentes.

---

### Resultado Final

Ao abrir o CFO Digital, voce vera:
- 4 KPIs com dados reais e variacao mensal
- Grafico de barras com tendencia de 6 meses
- Breakdown dos centros de custo
- Uma dica automatica da IA
- O chat completo para perguntas livres
