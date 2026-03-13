

## Diagnóstico do Bug

Analisando o screenshot: o usuário enviou "Gastei 50 no Nubank" e depois "Recebi 1350 reais". O bot perguntou PF/PJ para o 1350. O usuário respondeu "2" (PJ). Mas a confirmação mostra **R$ 50,00 como PF** — completamente errado.

**Dois problemas raiz:**

1. **A IA ignora a regra de perguntar PF/PJ**: Apesar do prompt dizer "SEMPRE pergunte", a IA vê "Nubank" e chama `create_pf_transaction` diretamente, registrando o gasto de 50 sem perguntar. O prompt não é suficiente — a IA tem acesso às tools de criação direta e as usa.

2. **Race condition**: As duas mensagens são processadas em paralelo. As respostas se cruzam no chat, fazendo a confirmação do R$ 50 aparecer junto com a resposta do "2", confundindo o usuário.

## Plano de Correção

### 1. Forçar pergunta PF/PJ removendo tools de criação direta

Na primeira chamada ao LLM, **remover** `create_pf_transaction`, `create_pj_transaction` e `create_owner_transaction` das tools disponíveis. Deixar apenas:
- `ask_confirmation` (para perguntar PF/PJ)
- `send_executive_summary`, `send_cashflow_forecast`, `send_chart`

Assim, a IA **não tem como** criar transações diretamente — é obrigada a usar `ask_confirmation`.

A criação real acontece em `executePendingAction` quando o usuário responde "1" ou "2".

### 2. Serialização de mensagens por telefone

Adicionar um mecanismo simples de lock usando a tabela `whatsapp_pending_actions`:
- Antes de processar, verificar se já existe um pending action para o mesmo `phone_number` + `company_id`
- Se existir um pending (a IA já fez uma pergunta que está esperando resposta), **não processar** a nova mensagem com o agente IA. Em vez disso, enviar: "⏳ Responda a pergunta anterior primeiro."
- Isso evita que duas mensagens gerem respostas cruzadas

### 3. Ajustar `executePendingAction` para fluxo completo

Quando o usuário responde "1" (PF) para uma transação **confirmed**:
- Em vez de inserir direto, criar um **novo** pending action com `side: "pf"` e `step: "payment_method"`, e enviar a pergunta de forma de pagamento
- Quando o usuário responder "1/2/3", aí sim inserir a transação

Quando responde "2" (PJ) ou qualquer **pending** (conta a pagar):
- Inserir direto (como já faz)

### Arquivo a editar
`supabase/functions/whatsapp-webhook/index.ts`

### Resumo das mudanças
- Remover tools `create_pf_transaction`, `create_pj_transaction`, `create_owner_transaction` da chamada ao LLM
- Bloquear processamento se já existe pending para o telefone
- Adicionar step "payment_method" no fluxo PF confirmed dentro de `executePendingAction`

