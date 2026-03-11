

# Habilitar recebimento de mensagens "para si mesmo" na Evolution API

## Problema

A Evolution API, por padrão, **não envia via webhook mensagens do tipo "fromMe"** (mensagens que você envia para si mesmo). O código no `whatsapp-webhook` já filtra corretamente por `fromMe + toMe`, mas o webhook nunca recebe esses eventos porque a instância não está configurada para encaminhá-los.

## Solução

Duas mudanças são necessárias:

### 1. Na criação da instância — adicionar settings

No `handleConnect`, ao chamar `POST /instance/create`, incluir o campo `settings` com `rejectCall: false` e, mais importante, garantir que o webhook receba mensagens "fromMe".

### 2. No `configureWebhook` — configurar settings da instância

Após configurar o webhook, chamar `POST /settings/set/{instanceName}` na Evolution API com:

```json
{
  "rejectCall": false,
  "groupsIgnore": true,
  "alwaysOnline": false,
  "readMessages": false,
  "readStatus": false,
  "syncFullHistory": false
}
```

E no webhook config, adicionar `"webhook_base64": true` (para mídia) e crucialmente incluir o header ou flag para receber mensagens próprias. Na Evolution API v2, isso é controlado pelo campo `"events"` no webhook — precisamos garantir que `"MESSAGES_UPSERT"` inclua mensagens "fromMe" adicionando a flag no settings.

### 3. Atualizar o `handleConfigureWebhook` (botão ⚙️)

Quando o usuário clica no ⚙️, além de configurar o webhook e buscar o phone, também chamar o endpoint de settings para garantir que a instância aceita mensagens próprias.

### Arquivos afetados

- `src/pages/WhatsAppAgent.tsx` — adicionar chamada ao endpoint `/settings/set` na criação e no botão ⚙️

