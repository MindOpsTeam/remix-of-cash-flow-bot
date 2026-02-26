

# Melhorar Visualizacao de Transacoes Pessoais

## Problema Atual
A pagina de transacoes mostra apenas: titulo, data, conta, valor e tipo. Faltam dados importantes que ja existem no banco: categoria, cartao de credito, pessoa, descricao, status, recorrencia, grupo kakeibo e origem.

## Melhorias Propostas

### 1. Layout com mais informacoes visiveis
Cada linha de transacao passa a mostrar:
- **Icone colorido** por categoria (usando `personal_categories.icon` e `personal_categories.color`)
- **Titulo** + **descricao** (se houver)
- **Data** formatada + **conta** ou **cartao de credito**
- **Pessoa** (quem pagou/recebeu)
- **Badge de categoria** com cor
- **Badge de status** (confirmado, pendente)
- **Indicador de recorrencia** (icone de loop se `is_recurring`)
- **Badge de origem**: Manual, Importado, Asaas (com icones distintos)
- **Billing type** para transacoes Asaas (PIX, Boleto, etc.)

### 2. Filtros adicionais
Adicionar filtros por:
- **Tipo** (receita/despesa) - botoes toggle
- **Origem** (manual, importado, asaas)
- **Conta** (dropdown com contas do usuario)

### 3. Agrupamento por data
Transacoes agrupadas por dia com separador visual mostrando a data e subtotal do dia.

### 4. Contagem de transacoes no summary
Adicionar o total de transacoes no periodo nos cards de resumo (ex: "42 transacoes").

## Detalhes Tecnicos

### Arquivo: `src/pages/personal/PersonalTransactions.tsx`

**Mudancas na lista de transacoes:**
- Substituir o layout flat por um agrupado por data (usando `Object.groupBy` ou reduce manual)
- Cada grupo tem um header com data formatada ("Hoje", "Ontem", "25 de fev") e subtotal
- Cada linha exibe:
  - Icone da categoria (circulo colorido com emoji/icone) ou icone de origem (Zap para Asaas, Upload para importado, Pencil para manual)
  - Titulo em negrito + descricao em texto menor
  - Badges: categoria, status, billing_type, recorrencia
  - Pessoa (se existir)
  - Conta ou cartao de credito
  - Valor com cor (verde receita, vermelho despesa)
  - Botao de excluir (apenas para manuais)

**Mudancas nos filtros:**
- Adicionar toggle buttons "Receita" / "Despesa" / "Todos"
- Adicionar filtro por origem (manual/importado/asaas) com badges clicaveis
- Manter filtro de periodo e busca existentes

**Mudancas nos cards de resumo:**
- Adicionar contagem de transacoes (`summary.count`) em cada card
- Mostrar quantidade de receitas vs despesas

### Arquivo: `src/hooks/usePersonalTransactions.ts`

- Adicionar campo `source` ao filtro (para filtrar por origem)
- O hook ja retorna `personal_categories`, `personal_accounts`, `personal_credit_cards` - apenas precisamos usar esses dados na UI

Nenhuma alteracao de banco de dados necessaria. Todos os dados ja existem nas tabelas e ja sao buscados pelo hook.

