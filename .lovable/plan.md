

# Corrigir phone_number null no banco

## Problema

O código busca o número via `fetchInstances` apenas no momento da conexão inicial (QR Code). Se a instância já existia antes dessa feature, ou se o fetch falhou silenciosamente, o `phone_number` fica `null`. Além disso, o botão ⚙️ (configurar webhook) não atualiza o número.

## Causa raiz

1. `handleConfigureWebhook` chama `configureWebhook` mas **não busca nem salva o phone_number**
2. Não há mecanismo de retry/update para instâncias existentes com `phone_number = null`

## Solução

### 1. Criar função `fetchInstancePhone` reutilizável

Extrair a lógica de buscar o número conectado (que hoje está duplicada em `startPolling` e `handleConnect`) para uma função única:

```typescript
const fetchInstancePhone = async (url: string, headers: Record<string,string>, instanceName: string): Promise<string> => {
  const infoRes = await fetch(`${url}/instance/fetchInstances`, { headers });
  if (!infoRes.ok) return "";
  const instances = await infoRes.json();
  const inst = Array.isArray(instances)
    ? instances.find((i: any) => i.instance?.instanceName === instanceName || i.instanceName === instanceName)
    : instances;
  let phone = inst?.instance?.owner || inst?.owner || "";
  return phone.replace("@s.whatsapp.net", "").replace(/\D/g, "");
};
```

### 2. Atualizar `handleConfigureWebhook` para buscar e salvar o número

Após configurar o webhook, chamar `fetchInstancePhone` e fazer `UPDATE` no banco:

```typescript
const phone = await fetchInstancePhone(url, headers, c.instance_name);
if (phone) {
  await supabase.from("whatsapp_configs").update({ phone_number: phone } as any).eq("id", c.id);
  loadConfigs();
}
```

### 3. Auto-fix no `loadConfigs`

Após carregar os configs, para cada config com `phone_number = null` e que tenha `evolution_api_url` e `evolution_api_key`, tentar buscar e salvar o número automaticamente.

### Arquivos afetados
- `src/pages/WhatsAppAgent.tsx` — extrair função, atualizar `handleConfigureWebhook`, adicionar auto-fix

