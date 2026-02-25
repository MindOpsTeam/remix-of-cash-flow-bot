

# Correcoes de Build + Finalizacao do Design System

## Parte 1 - Corrigir erros de build no TransactionForm.tsx

Quatro erros de sintaxe em `useState` com generics malformados:

- Linha 39: `setAccounts<{...}[]>` deve ser `setAccounts] = useState<{...}[]>`
- Linha 40: `setCostCenters<{...}[]>` deve ser `setCostCenters] = useState<{...}[]>`
- Linha 41: `setBankAccounts<{...}[]>` deve ser `setBankAccounts] = useState<{...}[]>`
- Linha 55: `setAiSuggested(false)` deve ser `setAiSuggested] = useState(false)`

## Parte 2 - Remover `glass-card` das paginas restantes

Substituir todas as ocorrencias de `glass-card` por estilos flat do novo design system em:

1. **DRE.tsx** - 2 ocorrencias (containers de tabela e grafico)
2. **CashFlowForecast.tsx** - 7 ocorrencias (KPI cards, chart, forecast details)
3. **Reports.tsx** - ocorrencias nos containers de graficos
4. **Settings.tsx** - cards de navegacao
5. **CostCenters.tsx** - container principal
6. **ChartOfAccounts.tsx** - container principal
7. **PersonalDashboard.tsx** - cards de dashboard
8. **PersonalTransactions.tsx** - summary cards e lista
9. **PersonalAccounts.tsx** - cards de contas
10. **CFODashboard.tsx** - 3 ocorrencias (chart, cost centers, tip)
11. **CFODigital.tsx** - containers de chat
12. **Simulator.tsx** - cards de resultado
13. **ExecutiveSummary.tsx** - cards de secoes
14. **WhatsAppAgent.tsx** - containers de configuracao
15. **Integrations.tsx** - cards de integracoes

Em todos os casos, `glass-card` sera substituido por classes flat como `bg-card border border-border rounded-lg` ou simplesmente removido onde o componente Card ja aplica os estilos corretos.

## Parte 3 - Aplicar tipografia serif nos titulos

Adicionar `font-headline` (Playfair Display) nos titulos H1 de todas as paginas restantes que ainda nao foram atualizadas.

## Parte 4 - Remover definicao de `glass-card` do CSS

Garantir que nenhuma definicao de `.glass-card` permaneca em `src/index.css` (ja foi limpo, mas confirmar).

## Detalhes tecnicos

**Arquivos a editar:**
- `src/components/TransactionForm.tsx` (fix build errors)
- `src/pages/DRE.tsx`
- `src/pages/Reports.tsx`
- `src/pages/CashFlowForecast.tsx`
- `src/pages/ExecutiveSummary.tsx`
- `src/pages/Simulator.tsx`
- `src/pages/CFODigital.tsx`
- `src/pages/WhatsAppAgent.tsx`
- `src/pages/Settings.tsx`
- `src/pages/settings/CostCenters.tsx`
- `src/pages/settings/ChartOfAccounts.tsx`
- `src/pages/settings/Integrations.tsx`
- `src/pages/personal/PersonalDashboard.tsx`
- `src/pages/personal/PersonalTransactions.tsx`
- `src/pages/personal/PersonalAccounts.tsx`
- `src/components/cfo/CFODashboard.tsx`

Nenhuma alteracao de logica - apenas correcao de sintaxe e substituicao de classes CSS.

