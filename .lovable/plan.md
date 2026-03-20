

## Onboarding Wizard — Modal de configuracao inicial

### Conceito
Modal wizard exibido uma unica vez apos o primeiro login do usuario. Controlado por um campo `onboarding_completed` na tabela `company_members`. O wizard coleta informacoes da empresa e integrações opcionais em etapas.

### Etapas do wizard

1. **Bem-vindo** — Boas-vindas, explicacao rapida do sistema
2. **Dados da Empresa** — Nome da empresa, CNPJ (opcional). Salva em `companies`
3. **Integrações (opcional)** — Campos para API keys: Asaas (sandbox/production), Evolution API (WhatsApp URL + key). Todas opcionais, pode pular
4. **Concluido** — Confirmacao, redireciona ao dashboard

### Mudancas no banco

**Migração**: Adicionar coluna `onboarding_completed` (boolean default false) na tabela `company_members`.

```sql
ALTER TABLE public.company_members 
ADD COLUMN onboarding_completed boolean NOT NULL DEFAULT false;
```

### Arquivos

| Ação | Arquivo |
|------|---------|
| Migração | Adicionar `onboarding_completed` a `company_members` |
| Criar | `src/components/OnboardingWizard.tsx` — modal com 4 etapas usando Dialog, Progress, steps state |
| Editar | `src/pages/Index.tsx` — verificar `onboarding_completed` e exibir wizard se false |

### Detalhes tecnicos

- `OnboardingWizard.tsx`: Dialog modal fullscreen-ish, steps controlados por useState. Cada step eh um componente inline. Botoes "Proximo" / "Pular" / "Concluir". Na etapa de empresa, salva via `supabase.from('companies').update(...)`. Na etapa de integrações, salva API keys nas tabelas de config existentes (`company_asaas_config`, `whatsapp_configs`). No final, marca `onboarding_completed = true` em `company_members`.
- `Index.tsx`: Query `company_members` para checar `onboarding_completed`. Se false, abre o wizard. Ao concluir, refetch.
- Design: usa componentes existentes (Dialog, Input, Label, Button, Progress, Badge). Tema escuro consistente.

