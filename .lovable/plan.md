

## CFO Digital — Conversa humana e responsiva

### Problema atual
- O widget envia apenas a pergunta atual, sem historico de conversa — a IA nao tem contexto de mensagens anteriores
- O prompt do sistema e muito "consultor estrategico", nao responde perguntas diretas como "qual meu saldo?" ou "me mostra as ultimas transacoes"
- Faltam dados de extrato detalhado (ultimas N transacoes com descricao, valor, data) no contexto

### Mudancas

**1. Frontend `src/components/CFOChatWidget.tsx`**
- Enviar array `messages` completo (historico da conversa) em vez de apenas `question`
- Atualizar sugestoes rapidas para: "Qual meu saldo?", "Extrato do mes", "Ultimas transacoes"
- Responsivo: no mobile, widget ocupa tela cheia (w-full, h-full, bottom-0 right-0)

**2. Edge function `supabase/functions/cfo-digital/index.ts`**
- Aceitar campo `messages` (array de {role, content}) alem de `question` (retrocompativel)
- Incluir no contexto financeiro as **ultimas 30 transacoes detalhadas** (data, descricao, tipo, valor, conta, centro de custo) para responder perguntas de extrato
- Incluir **saldo por conta bancaria** se disponivel
- Passar historico completo de mensagens para a IA (system + messages do usuario)
- Reescrever system prompt: tom conversacional, direto, responde saldo/extrato/transacoes com dados reais. So faz resumo estrategico se pedido

**3. System prompt novo**
- Foco: assistente financeiro conversacional que responde perguntas objetivas
- Quando perguntam saldo: responder valor direto
- Quando perguntam extrato/transacoes: listar as mais recentes
- Quando pedem resumo: ai sim gerar analise completa
- Respostas curtas e diretas por padrao

### Arquivos

| Acao | Arquivo |
|------|---------|
| Editar | `src/components/CFOChatWidget.tsx` — enviar historico, responsivo mobile |
| Editar | `supabase/functions/cfo-digital/index.ts` — aceitar messages, extrato detalhado, novo prompt |

