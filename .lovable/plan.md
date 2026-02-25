
# Disponibilizar Integracao Asaas no Modo Pessoal (PF)

## Contexto
A integracao Asaas ja usa `user_id` no backend (tabelas, edge functions, RLS), entao funciona independente do modo. O problema e que o menu "Configuracoes" so aparece na sidebar do modo empresarial, e a pagina Settings.tsx mostra itens exclusivamente empresariais.

## Mudancas

### 1. Sidebar: Adicionar "Configuracoes" no modo pessoal
**Arquivo:** `src/components/AppSidebar.tsx`

Adicionar item ao array `personalItems`:
```
{ to: "/personal/settings", label: "Configurações", icon: Settings }
```

### 2. Criar pagina de configuracoes pessoal
**Arquivo:** `src/pages/personal/PersonalSettings.tsx` (novo)

Pagina simplificada com apenas os cards relevantes para PF:
- **Integracoes** -- link para `/personal/settings/integrations`

Sem os itens empresariais (Empresa, Usuarios, Plano de Contas, Centros de Custo).

### 3. Criar pagina de integracoes pessoal
**Arquivo:** `src/pages/personal/PersonalIntegrations.tsx` (novo)

Similar a `Integrations.tsx` mas sem a secao de webhooks genericos (que depende de `company_id`). Mostra apenas o card do Asaas com link para `/personal/settings/integrations/asaas`.

### 4. Adaptar AsaasIntegration.tsx para ambos os modos
**Arquivo:** `src/pages/settings/AsaasIntegration.tsx`

- Detectar o modo atual via `useAppMode()` ou pela rota (se comeca com `/personal`)
- Ajustar o link "Voltar" para apontar para a rota correta (`/personal/settings/integrations` ou `/settings/integrations`)
- O restante da logica nao muda (ja usa `user_id`)

### 5. Adicionar rotas no App.tsx
**Arquivo:** `src/App.tsx`

Novas rotas protegidas:
- `/personal/settings` -> `PersonalSettings`
- `/personal/settings/integrations` -> `PersonalIntegrations`
- `/personal/settings/integrations/asaas` -> `AsaasIntegrationPage` (reutiliza o mesmo componente)

### Resumo de arquivos

| Arquivo | Acao |
|---|---|
| `src/components/AppSidebar.tsx` | Adicionar item "Configuracoes" no personalItems |
| `src/pages/personal/PersonalSettings.tsx` | Criar (pagina simples com card Integracoes) |
| `src/pages/personal/PersonalIntegrations.tsx` | Criar (card Asaas sem webhooks genericos) |
| `src/pages/settings/AsaasIntegration.tsx` | Ajustar link "Voltar" baseado na rota atual |
| `src/App.tsx` | Adicionar 3 rotas pessoais |

Nenhuma migracao de banco necessaria -- o backend ja suporta ambos os modos via `user_id`.
