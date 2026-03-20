

## Reformar WhatsApp Agent → Assistente CFO Digital

**Objetivo**: Transformar o agente WhatsApp de um registrador de transações financeiras em um assistente CFO estratégico — mesma funcionalidade da página CFO Digital, mas via WhatsApp.

### O que muda

| Antes | Depois |
|-------|--------|
| Registra transações (receita/despesa) | Responde perguntas estratégicas |
| Tools: `ask_confirmation`, `send_chart`, etc. | Sem tools — resposta direta como CFO |
| Fluxo de pending actions (confirmar/cancelar) | Resposta livre, sem confirmações |
| System prompt focado em lançamentos | System prompt idêntico ao CFO Digital |
| Parser de valores brasileiros | Removido (não necessário) |

### O que permanece igual
- Infraestrutura: Evolution API, grupo dedicado, dedup por `message_id`
- Transcrição de áudio (Gemini)
- Análise de imagem (documentos financeiros → interpretação CFO)
- Log de mensagens em `whatsapp_messages`
- Página de configuração (`WhatsAppAgent.tsx`) — sem alterações

### Plano de implementação

**1. Reescrever `supabase/functions/whatsapp-webhook/index.ts`**

- **Remover**: `parseBrazilianAmount`, `detectQuickTransaction`, `isRevenueIntent`, `normalizePjType`, `insertPjTransaction`, `executePendingAction`, `isConfirmationReply`, `buildActionFallbackMessage`
- **Remover**: toda lógica de `whatsapp_pending_actions` (lookup, serialização, confirmação)
- **Remover**: tools de `ask_confirmation`, `send_executive_summary`, `send_cashflow_forecast`, `send_chart`
- **Remover**: `generateFinancialChart`, `generateExecutiveSummary`, `generateCashFlowForecast`, `generateForecastChart`

- **Substituir `runFinancialAgent`** por `runCFOAssistant`:
  - Busca os mesmos dados que `cfo-digital/index.ts`: transações (limit 1000), chart_of_accounts, cost_centers, bank_accounts
  - Calcula: resumo mês atual, mês anterior, variação, breakdown por centro de custo, tendência 6 meses
  - Monta o `financialContext` idêntico ao da edge function `cfo-digital`
  - System prompt = mesmo do CFO Digital (consultor estratégico, score financeiro, alertas, etc.)
  - Chamada ao Gemini **sem tools, sem streaming** — resposta direta
  - Envia resposta via `sendWhatsAppMessage`, split em chunks de 3800 chars

- **Manter**: dedup, grupo dedicado, transcrição de áudio, análise de imagem, `sendWhatsAppMessage`, `sendWhatsAppImage`, `getMediaBase64`, `splitMessage`

- **Adaptar análise de imagem**: ao receber imagem, o texto extraído é passado ao CFO como contexto ("O usuário enviou este documento: [dados extraídos]. Analise e forneça insights financeiros.")

**2. Remover fluxo de pending actions do webhook**

As linhas 194-229 (lookup de pending, serialização) e 260-341 (executePendingAction, isConfirmationReply) são completamente removidas. O agente agora é stateless — cada mensagem é uma pergunta independente ao CFO.

**3. Sem alterações na página `WhatsAppAgent.tsx`**

A configuração de instâncias, grupos e webhook permanece idêntica. Apenas a descrição/subtítulo na página pode ser atualizado para refletir "Assistente CFO" em vez de "Agente Financeiro".

### Detalhes técnicos

- A função `runCFOAssistant` reutiliza exatamente a mesma lógica de construção de `financialContext` do `cfo-digital/index.ts` para garantir paridade
- Sem streaming no WhatsApp (não suportado) — chamada normal ao AI gateway
- Mensagens longas são divididas em chunks via `splitMessage(text, 3800)`
- System prompt adaptado para formato WhatsApp: usa `*negrito*`, `_itálico_`, emojis em vez de markdown headers

