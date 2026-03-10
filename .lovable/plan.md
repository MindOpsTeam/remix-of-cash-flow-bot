

# Corrigir Integração Evolution API — Campos Necessários

## Problema Atual

A tabela `whatsapp_configs` só armazena `instance_name`, `company_id` e `active`. Porém, a Evolution API precisa de **3 dados** para funcionar:

1. **URL do servidor Evolution** (ex: `https://evolution.suaempresa.com`)
2. **API Key global** do servidor Evolution
3. **Nome da instância** (já existe)

Hoje esses valores estão hardcoded como secrets globais (`EVOLUTION_API_URL`, `EVOLUTION_API_KEY`), significando que **todas as empresas compartilham o mesmo servidor Evolution**. Se uma empresa usa um servidor diferente, não funciona. Além disso, o formulário de configuração no frontend só pede o nome da instância — o usuário não tem como informar URL e chave.

## Plano

### 1. Adicionar colunas à tabela `whatsapp_configs`

Migração SQL para adicionar:
- `evolution_api_url` (text, nullable) — URL do servidor Evolution
- `evolution_api_key` (text, nullable) — API Key do servidor

Quando preenchidos, esses campos têm **prioridade** sobre os secrets globais (fallback).

### 2. Atualizar formulário no frontend (`WhatsAppAgent.tsx`)

O dialog "Conectar Instância" passa a ter 3 campos:
- **URL do Servidor Evolution** (obrigatório) — placeholder: `https://evolution.suaempresa.com`
- **API Key** (obrigatório) — campo password
- **Nome da Instância** (obrigatório) — como já existe

Adicionar também um botão "Testar Conexão" que faz um fetch à `/instance/fetchInstances` da Evolution para validar URL + key + instância.

### 3. Atualizar Edge Function (`whatsapp-webhook/index.ts`)

Nas funções `sendWhatsAppMessage`, `sendWhatsAppImage` e `getMediaBase64`:
- Receber `evolutionUrl` e `evolutionKey` como parâmetros (vindos do `whatsappConfig` do banco)
- Fallback para `Deno.env.get("EVOLUTION_API_URL")` e `EVOLUTION_API_KEY` se não existirem no registro

Isso requer propagar os valores do config ao longo de todo o fluxo da edge function.

### Arquivos Afetados

- **Migração SQL**: adicionar `evolution_api_url` e `evolution_api_key` à `whatsapp_configs`
- **`src/pages/WhatsAppAgent.tsx`**: formulário expandido com 3 campos + teste de conexão
- **`supabase/functions/whatsapp-webhook/index.ts`**: usar URL/key do registro do banco com fallback para env vars

