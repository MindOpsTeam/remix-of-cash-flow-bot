

# Corrigir registro de transações via WhatsApp (actions sempre vazio)

## Diagnóstico

Analisei os dados e identifiquei **dois problemas**:

1. **A IA não está gerando as tags `<ACTION>`**: Todas as mensagens no banco (`whatsapp_messages`) mostram `"actions": []`. Isso significa que o modelo `gemini-2.5-flash` está respondendo com texto natural mas sem incluir as tags `<ACTION>...</ACTION>` no formato esperado. O prompt é muito longo e o modelo perde a instrução de formato.

2. **Falta de logging**: Não há nenhum log do que a IA respondeu, tornando impossível debugar. Precisamos logar a resposta da IA para entender exatamente o que ela retorna.

## Mudanças

### 1. Adicionar logging da resposta da IA

No `runFinancialAgent`, logo após `const aiResponse = ...`, adicionar:
```typescript
console.log("AI response (first 1000 chars):", aiResponse.slice(0, 1000));
console.log("Actions found:", actions.length);
```

### 2. Reforçar o formato `<ACTION>` no prompt

O problema principal é que o modelo Gemini 2.5 Flash não segue o formato `<ACTION>` de forma confiável com prompts longos. Soluções:

- **Mover as instruções de formato para o FINAL do system prompt** (recency bias — modelos seguem melhor instruções no final)
- **Adicionar exemplos explícitos** mais curtos e diretos
- **Adicionar uma instrução "reminder" no user message**: concatenar ao texto do usuário uma linha como `\n\n[SYSTEM: Lembre-se: SEMPRE inclua tags <ACTION> para qualquer transação detectada]`
- **Simplificar o formato de ação**: em vez de JSON complexo dentro de `<ACTION>`, usar um formato mais robusto

### 3. Fallback: tentar extrair ação mesmo sem tags

Se `actions.length === 0` e a resposta da IA menciona um registro, tentar fazer um segundo parse via regex para valores como "R$ X" e tipos "Despesa/Receita", ou fazer uma segunda chamada curta à IA pedindo especificamente a classificação estruturada.

### 4. Trocar para modelo mais capaz

Considerar usar `google/gemini-2.5-pro` ou `openai/gpt-5-mini` que seguem instruções de formato com mais fidelidade, especialmente com prompts longos.

## Plano de implementação

Arquivo: `supabase/functions/whatsapp-webhook/index.ts`

1. **Adicionar console.log** da resposta da IA e quantidade de ações
2. **Reestruturar o system prompt**: mover as regras de formato `<ACTION>` para o final absoluto do prompt com repetição enfática
3. **Adicionar reminder no user message**: `ctx.text + "\n\n[Instrução: se houver transação, inclua obrigatoriamente a tag <ACTION>{...}</ACTION>]"`
4. **Implementar fallback de extração**: se actions=0 e a resposta contém indicadores de transação (R$, registr, despesa, receita), fazer segunda chamada curta com `google/gemini-2.5-flash` pedindo apenas o JSON estruturado
5. **Logar resposta outbound** na tabela `whatsapp_messages` para debug futuro

