

# Exibir o número do WhatsApp na UI

## Problema
O `phone_number` já é capturado e salvo em `whatsapp_configs` (via auto-fix no `loadConfigs` e no `handleConnect`/`handleConfigureWebhook`), mas **não é exibido na UI**. O usuário não sabe para qual número enviar mensagens.

## Solução

Alterar o card de cada instância em `WhatsAppAgent.tsx` para mostrar o número de telefone de forma clara, com uma dica visual de que o usuário deve enviar mensagens **para si mesmo** naquele número.

### Mudanças em `src/pages/WhatsAppAgent.tsx`

1. Adicionar `phone_number` à interface `WhatsAppConfig`
2. No card da instância (linhas ~546-556), exibir o número formatado logo abaixo do nome da instância, com um texto explicativo tipo: `"Envie mensagens para: +55 11 99999-9999"`
3. Se `phone_number` não estiver disponível, mostrar um aviso pequeno: `"Clique em ⚙️ para detectar o número"`

