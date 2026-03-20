

## Movimentações: Seletor Asaas / Banco Inter

**Objetivo**: Adicionar um seletor no topo da página de Movimentações para alternar entre dados do Asaas e do Banco Inter.

### Mudanças

**1. Página `src/pages/CompanyTransfers.tsx`**

- Adicionar estado `source` com valores `"asaas" | "inter"`
- No header, trocar titulo fixo "Movimentações Asaas" por "Movimentações" + seletor de fonte (tabs ou toggle com ícones Asaas / Inter)
- Quando `source === "asaas"`: mostrar o conteúdo atual (transferências, assinaturas, antecipações)
- Quando `source === "inter"`: mostrar dados do Banco Inter

**2. Conteúdo Inter**

- Criar hook `src/hooks/useCompanyInterTransactions.ts`:
  - Busca transações da tabela `transactions` com `source = 'inter'` e `company_id`
  - Busca config de `inter_config` para exibir saldo e última sincronização
  - Calcula sumário: total receitas, total despesas, saldo do período
- Na aba Inter, exibir:
  - Cards resumo: Saldo Inter (last_balance), Total Receitas, Total Despesas
  - Lista de transações agrupadas por data (mesmo padrão visual das transferências Asaas)
  - Cada item mostra: descrição, tipo (C/D com cores), valor, status, payment_method
  - Botão "Sincronizar" que chama a edge function `inter-banking` com action `sync`

**3. Detalhes visuais**

- Seletor no header: dois botões lado a lado (estilo segmented control) com logos/ícones
- Asaas: cor verde, ícone `DollarSign`
- Inter: cor laranja, ícone `Building2`
- Título e subtítulo mudam dinamicamente conforme a fonte selecionada

