

## Plano: WhatsApp sempre pergunta PF ou PJ antes de registrar

### Problema
Atualmente, o agente WhatsApp tenta classificar automaticamente se uma transação é PF ou PJ com base em palavras-chave (ex: "supermercado" → PF, "fornecedor" → PJ). O usuário quer que **sempre** pergunte em qual módulo registrar.

### Alterações

#### 1. Atualizar o System Prompt do agente (`whatsapp-webhook/index.ts`)

Modificar a regra de classificação PF/PJ:
- **Remover** a classificação automática baseada em palavras-chave (linhas 749-751)
- **Adicionar regra obrigatória**: Antes de qualquer registro, sempre perguntar:
  ```
  "📍 Lançar em qual módulo?
   1️⃣ Pessoal (PF)
   2️⃣ Empresa (PJ)"
  ```
- Usar a tool `ask_confirmation` com `side` indefinido para forçar a pergunta
- Exceção: se o usuário já disser explicitamente "PF", "pessoal", "PJ" ou "empresa" na mensagem, pular a pergunta

#### 2. Ajustar o fluxo de `ask_confirmation`

Atualmente `ask_confirmation` é usado quando há dúvida. Precisamos garantir que:
- O `pending_action` salvo contenha todos os dados necessários para ambos PF e PJ (já está assim)
- A resposta "1" (PF) ou "2" (PJ) no `executePendingAction` já funciona corretamente (já está implementado nas linhas 276-380)

#### 3. Ajustar prompt para contas a pagar (pending)

Mesmo para contas a pagar (status=pending), perguntar PF ou PJ antes de registrar. A regra atual diz "registre IMEDIATAMENTE" — alterar para "registre IMEDIATAMENTE **após confirmar o módulo**".

### Resumo técnico

Arquivo único a editar: `supabase/functions/whatsapp-webhook/index.ts`

Mudanças no `systemPrompt`:
- Substituir bloco de classificação PF/PJ (linhas 749-751) por regra obrigatória de perguntar
- Adicionar instrução: "SEMPRE use ask_confirmation para perguntar PF ou PJ, exceto se o usuário já especificou na mensagem"
- Remover "na dúvida, use PF"
- Manter todo o fluxo conversacional existente (forma de pagamento para PF confirmed, etc.)

O fluxo ficará:
1. Usuário envia mensagem com valor
2. IA detecta valor, tipo (despesa/receita), status (confirmed/pending)
3. **Sempre pergunta**: PF ou PJ?
4. Usuário responde "1" ou "2"
5. Se PF + confirmed → pergunta forma de pagamento
6. Se PJ ou pending → registra direto

