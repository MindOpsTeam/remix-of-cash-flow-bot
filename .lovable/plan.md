

# Tornar o parser de valores mais inteligente

## Problema
O `parseBrazilianAmount` usa apenas regex numérico. Entradas como "5 mil", "2k", "1 milhão", "5.000" são comuns no Brasil mas "5 mil" retorna apenas 5.

## Solução

### 1. Expandir `parseBrazilianAmount` para interpretar expressões textuais

Adicionar pré-processamento antes do regex numérico para converter expressões como:
- "mil" / "k" → ×1000
- "milhão" / "mi" → ×1000000
- "conto" → ×1000
- "5 mil" → 5000, "meio mil" → 500
- "1,5 mil" → 1500, "2k" → 2000

Lógica: regex dedicado que captura `(\d+[.,]?\d*)\s*(mil|k|conto|milhão|mi|milhões)` e aplica o multiplicador antes de retornar o valor.

### 2. Mover classificação de descrição para a IA (fallback inteligente)

O quick path funciona bem para mensagens claras com valores numéricos explícitos. Mas para mensagens mais ambíguas ou com linguagem natural complexa, delegar ao agente IA que já tem tool calling configurado. A IA lida melhor com contexto e variações linguísticas.

## Arquivo afetado
- `supabase/functions/whatsapp-webhook/index.ts` — função `parseBrazilianAmount`

