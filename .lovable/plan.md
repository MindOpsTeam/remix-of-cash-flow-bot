

# Copiar UI de seleção/monitoramento de grupos do Group Lens

## Contexto

O projeto Group Lens tem uma UI polida para seleção de grupos: busca com search, avatares com fotos, refresh, fallback manual, estados de loading/erro. O FinanceAI atual tem uma versão simplificada que faz fetch client-side sem search, sem fotos, sem manual add.

## Mudanças

### 1. Criar edge function `list-whatsapp-groups`

Adaptação do `list-evolution-groups` do Group Lens, mas lendo credenciais de `whatsapp_configs` em vez de `evolution_api_configs` + `whatsapp_instances`:

- Recebe `{ config_id, include_pictures }` no body
- Busca `evolution_api_url`, `evolution_api_key`, `instance_name` de `whatsapp_configs` pelo `config_id`
- Chama `GET /group/fetchAllGroups/{instanceName}` na Evolution API
- Se `include_pictures`, busca fotos em batches via `POST /chat/fetchProfilePictureUrl/{instanceName}` (mesmo padrão do Group Lens com batches de 10 e delay de 300ms)
- Retorna `{ success: true, groups: [{ id, subject, size, pictureUrl }] }`

### 2. Revampar a aba "Grupo" em `WhatsAppAgent.tsx`

Adaptar a UI do `SelectGroups.tsx` do Group Lens para dentro da tab "Grupo":

- **Search bar** com ícone de busca + botão de refresh
- **Avatar** para cada grupo (com `AvatarImage` + `AvatarFallback` de iniciais)
- **Indicador visual** de grupo já selecionado (borda primary, badge "Selecionado")
- **Loading states**: spinner ao buscar grupos, spinner secundário ao carregar fotos
- **Error state**: card com ícone `AlertCircle` e mensagem de erro
- **Manual add fallback**: seção expansível para adicionar grupo por JID manualmente
- **Contador**: "X grupo(s) encontrados"
- Substituir o fetch client-side direto por invocação da edge function `list-whatsapp-groups`
- Fotos carregam em background (primeiro fetch sem fotos, depois com `include_pictures: true`)

### 3. Adicionar `group_name` ao `whatsapp_configs`

Migration para salvar o nome do grupo junto com o JID, para exibir no card da instância sem precisar re-fetchar:

```sql
ALTER TABLE public.whatsapp_configs ADD COLUMN group_name text;
```

Atualizar `handleSaveGroup` para salvar `group_name` junto com `group_jid`.
Atualizar a UI do card na aba Instâncias para mostrar o nome do grupo em vez do JID.

### Arquivos afetados
- **Novo**: `supabase/functions/list-whatsapp-groups/index.ts`
- **Editar**: `src/pages/WhatsAppAgent.tsx` — revampar tab Grupo
- **Migration SQL**: adicionar `group_name` a `whatsapp_configs`

