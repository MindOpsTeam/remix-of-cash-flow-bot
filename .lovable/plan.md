

# Filtrar apenas mensagens "para si mesmo" no WhatsApp

## Problema atual

Após remover o filtro `fromMe`, o webhook processa **qualquer** mensagem — de outros contatos, grupos, etc. O comportamento desejado é processar **apenas** mensagens que o usuário envia para si mesmo (conversa "Você" do WhatsApp).

## Lógica

Quando o usuário envia uma mensagem para si mesmo no WhatsApp:
- `key.fromMe = true` (ele enviou)
- `key.remoteJid = seuNumero@s.whatsapp.net` (destino é o próprio número)

Quando outra pessoa manda mensagem: `fromMe = false` → ignorar.
Quando o usuário manda para outra pessoa: `fromMe = true` mas `remoteJid` é outro número → ignorar.

Para saber qual é o número da instância, precisamos armazená-lo. Após a conexão do QR Code (quando `connectionState === "open"`), chamamos `GET /instance/fetchInstances` na Evolution API para obter o número conectado e salvamos na tabela.

## Alterações

### 1. Migração SQL — adicionar coluna `phone_number` em `whatsapp_configs`

```sql
ALTER TABLE public.whatsapp_configs ADD COLUMN IF NOT EXISTS phone_number text;
```

### 2. `WhatsAppAgent.tsx` — salvar número ao conectar

Quando o polling detecta `state === "open"`, antes de salvar no banco, chamar `GET {url}/instance/fetchInstances/{instanceName}` para obter o número conectado (campo `instance.owner` ou similar) e incluir na inserção.

### 3. `whatsapp-webhook/index.ts` — filtro "fromMe toMe"

Após carregar o `whatsappConfig`, adicionar:

```typescript
const isFromMe = key?.fromMe === true;
const configPhone = whatsappConfig.phone_number;

// Só processar se: fromMe=true E remoteJid = número da instância
if (!isFromMe || !configPhone || phoneNumber !== configPhone) {
  return skip("not-self-message");
}
```

Isso garante que apenas mensagens enviadas pelo próprio usuário, para o próprio número, sejam processadas como movimentações financeiras.

### Arquivos afetados
- **Migração SQL**: adicionar coluna `phone_number`
- **`src/pages/WhatsAppAgent.tsx`**: buscar e salvar o número após conexão
- **`supabase/functions/whatsapp-webhook/index.ts`**: adicionar filtro fromMe+toMe

