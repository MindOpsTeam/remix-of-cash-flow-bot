

# Conexão WhatsApp com QR Code direto no modal

## O que muda

O modal atual pede URL + API Key + nome da instância e espera que o usuário configure o webhook manualmente na Evolution API. O novo fluxo faz tudo automaticamente:

**Fluxo em 2 etapas no modal:**

1. **Etapa 1 — Credenciais**: Usuário informa URL do servidor Evolution, API Key e nome da instância desejada. Clica em "Conectar".
2. **Etapa 2 — QR Code**: O sistema chama `POST /instance/create` na Evolution API com `qrcode: true` e `webhook` já configurado automaticamente. Exibe o QR Code (base64 retornado pela API) para o usuário escanear. Polling a cada 5s em `GET /instance/connectionState/{instance}` para detectar quando o WhatsApp conectou. Quando conecta, salva no banco e fecha o modal.

**O webhook é configurado automaticamente** no payload do `POST /instance/create` (campo `webhook`), sem o usuário precisar copiar URL nenhuma.

Se a instância já existir no servidor, em vez de criar, chama `GET /instance/connect/{instance}` para obter o QR code.

## Detalhes técnicos

### `WhatsAppAgent.tsx` — Reescrever o modal

- Estado `step`: `"credentials"` | `"qrcode"`
- Estado `qrCodeBase64`: string com a imagem do QR
- Estado `connectionStatus`: `"waiting"` | `"connected"` | `"error"`

**Etapa 1** (credenciais): campos URL, API Key, Nome da Instância + botão "Conectar"

**Ao clicar "Conectar":**
1. Tenta `POST {url}/instance/create` com body:
   ```json
   {
     "instanceName": "nome",
     "integration": "WHATSAPP-BAILEYS",
     "qrcode": true,
     "webhook": {
       "url": "{supabaseUrl}/functions/v1/whatsapp-webhook",
       "webhook_by_events": false,
       "events": ["MESSAGES_UPSERT"]
     }
   }
   ```
2. Se retornar 409 (instância já existe), chama `GET {url}/instance/connect/{nome}` para obter QR
3. Extrai `base64` do response (campo `qrcode.base64` ou `base64`)
4. Avança para etapa 2

**Etapa 2** (QR Code):
- Exibe a imagem QR com `<img src={qrCodeBase64} />`
- Inicia polling: `GET {url}/instance/connectionState/{nome}` a cada 5 segundos
- Quando `state === "open"`: salva config no banco, mostra sucesso, fecha modal
- Botão "Gerar novo QR" chama `GET /instance/connect/{nome}` novamente
- Timeout de 60s com mensagem de retry

**Remover:** card de webhook URL da página principal e seção de webhook do modal (tudo é automático agora).

### Arquivos afetados

- `src/pages/WhatsAppAgent.tsx` — reescrever modal + remover webhook card

