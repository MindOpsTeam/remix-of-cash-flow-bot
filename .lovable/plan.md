

# Trocar lógica "mensagem para si mesmo" por grupo dedicado

## Resumo

Atualmente o WhatsApp funciona com o modelo "fromMe toMe" — o usuário envia mensagens para si mesmo. Vamos trocar para um modelo onde o usuário cria um **grupo** com a instância do FinanceAI, e a IA responde apenas nesse grupo específico.

## Mudanças necessárias

### 1. Migration: adicionar `group_jid` na tabela `whatsapp_configs`

```sql
ALTER TABLE public.whatsapp_configs ADD COLUMN group_jid text;
```

Armazena o JID do grupo (ex: `120363xxx@g.us`) onde a IA deve operar.

### 2. Webhook (`supabase/functions/whatsapp-webhook/index.ts`)

- **Inverter o filtro de grupo**: em vez de ignorar `@g.us`, agora **só processar** mensagens de grupo que correspondam ao `group_jid` configurado. Mensagens privadas e de outros grupos são ignoradas.
- **Remover o filtro "fromMe toMe"**: qualquer mensagem no grupo configurado é processada (já que o grupo é privado entre o usuário e o bot).
- **Ajustar `remoteJid` nas respostas**: as respostas da IA vão para o `group_jid` em vez do número pessoal.
- O `phoneNumber` do remetente será extraído do `key.participant` (em grupos, quem enviou vem nesse campo, não no `remoteJid`).

### 3. Frontend (`src/pages/WhatsAppAgent.tsx`)

- **Remover `groupsIgnore: true`** do `configureInstanceSettings` e do `handleConnect` → trocar para `groupsIgnore: false` para que o webhook receba eventos de grupos.
- **Adicionar fluxo de detecção/configuração de grupo**:
  - Novo botão "Configurar Grupo" no card da instância.
  - Ao clicar, busca os grupos da instância via `GET /group/fetchAllGroups/{instanceName}` na Evolution API.
  - Exibe lista de grupos para o usuário selecionar.
  - Salva o `group_jid` selecionado em `whatsapp_configs`.
- **Atualizar UI do card**: em vez de "Envie mensagens para: +55...", mostrar "Grupo configurado: Nome do Grupo" ou "Clique para configurar o grupo".
- **Instruções no card**: orientar o usuário a criar um grupo com o número da instância e depois selecionar aqui.

### 4. Ajuste no webhook config

No `configureWebhook`, adicionar o evento `"GROUP_UPSERT"` ou garantir que `"MESSAGES_UPSERT"` inclua mensagens de grupo (já inclui por padrão quando `groupsIgnore` é `false`).

## Fluxo do usuário

1. Conecta a instância (como hoje, via QR Code)
2. Cria um grupo no WhatsApp adicionando o número da instância
3. No FinanceAI, clica em "Configurar Grupo" → seleciona o grupo da lista
4. A partir daí, todas as mensagens enviadas naquele grupo são processadas pela IA
5. A IA responde no próprio grupo

## Arquivos afetados

- **Migration SQL** — adicionar coluna `group_jid`
- **`supabase/functions/whatsapp-webhook/index.ts`** — inverter filtro de grupo, remover filtro fromMe, usar group_jid como destino das respostas
- **`src/pages/WhatsAppAgent.tsx`** — `groupsIgnore: false`, UI de seleção de grupo, atualizar card

