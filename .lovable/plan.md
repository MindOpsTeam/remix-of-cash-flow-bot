

# Reconhecimento proativo de transações e confirmação detalhada

## Problema atual
O agente já detecta transações, mas o prompt atual pede confirmação em muitos casos (confiança média/baixa). O usuário quer que o agente seja mais agressivo: detectar qualquer atividade financeira imediatamente e finalizar a interação dizendo exatamente **para onde** (conta, categoria, módulo PF/PJ) e **como** a transação foi registrada.

## Mudanças

### 1. Ajustar o system prompt em `runFinancialAgent` (`whatsapp-webhook/index.ts`)

- **Baixar o limiar de auto-registro**: instruir a IA a registrar automaticamente sempre que detectar um valor + descrição, mesmo com confiança média. Só pedir confirmação quando realmente ambíguo (sem valor, sem contexto nenhum).
- **Finalização obrigatória**: após cada registro, a IA DEVE enviar uma mensagem de fechamento com:
  - Módulo destino (Pessoal ou Empresa)
  - Nome da conta (ex: "Carteira", "Conta Inter")
  - Nome da categoria (ex: "Alimentação", "Fornecedores")
  - Valor e data
  - Novo saldo estimado da conta (se PF e disponível)
- **Detectar transações em mensagens informais**: "gastei 50 no mercado", "recebi 200 do João", "paguei a conta de luz 180" — tudo deve gerar registro imediato.

### 2. Melhorar as mensagens de confirmação pós-ação

Atualmente, após `insertPfTransaction` e `insertPjTransaction` (ações HIGH), a confirmação vem do próprio texto da IA. Mas após `executePendingAction` (confirmações), a mensagem é genérica com IDs. Vamos:

- No `executePendingAction`: buscar o **nome** da conta e categoria no banco antes de montar a mensagem de confirmação, em vez de mostrar apenas "Registrado no módulo Pessoal (PF)".
- Formato da mensagem final:
  ```
  ✅ Transação registrada!
  💰 R$ 50,00 — Despesa
  📂 Categoria: Alimentação
  🏦 Conta: Carteira (saldo atual: R$ 950,00)
  📅 11/03/2026
  📍 Módulo: Pessoal (PF)
  ```

### 3. Incluir nomes de contas/categorias no contexto da IA

O prompt já inclui IDs e nomes. Reforçar que a IA deve usar os **nomes** na resposta e não os IDs. Adicionar instrução: "Sempre mencione o nome da conta e da categoria na confirmação, nunca o ID."

## Arquivos afetados
- **`supabase/functions/whatsapp-webhook/index.ts`**: prompt do agente, `executePendingAction`, mensagens de confirmação

