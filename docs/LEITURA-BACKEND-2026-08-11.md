# Leitura de Backend, 2026-08-11

Auditoria de leitura feita de fora (Claude Code via MCP oficial do Lovable), sem alterar código de produto. Referência de estado: commit `801f735a` (HEAD, revert de 2026-08-05).

## Identidade

- Projeto Lovable: `biz-whisper-fin` (`c5ba5dcd-8f5b-46fe-a1fc-fd596c11b334`), publicado em https://biz-whisper-fin.lovable.app
- Supabase: `oxymhnddzamsjxwfglud` (Lovable Cloud)
- Stack: Vite + React + shadcn no front; Supabase (Postgres, Auth, Edge Functions Deno) no backend; workers externos (nfse-worker no Railway) e MCP servers auxiliares (Belvo, ContaAzul, Pluggy, NFS-e Nacional).

## Superfície do backend

### Edge functions (41, todas com `verify_jwt = false` no config.toml)

Grupos funcionais:

- IA e agentes: `ai-classify`, `ai-forecast`, `ai-summary`, `cfo-digital`, `classificar-lote`, `sugerir-fiscal`, `agent-runner`, `agent-collections`, `agent-anomalies`, `smart-alerts`
- WhatsApp (Evolution API): `whatsapp-webhook`, `evolution-proxy`, `list-whatsapp-groups`
- Fiscal: `focus-nfe`, `nfse-operations`, `nfse-proxy`, `plugnotas-*` (7 funções), `tax-rates-sync`, `indices-sync`
- Bancos e pagamentos: `inter-banking`, `openfinance-connect/sync/webhook`, `stripe-api`, `stripe-webhook`, `company-asaas-api`, `company-asaas-webhook`, `reconcile-transactions`, `contaazul-import`
- Núcleo: `public-api`, `mcp`, `webhook-receiver`, `ocr-document`, `owner-transactions`, `contracts-billing`

### Padrão de autenticação

`verify_jwt = false` global é compensado por validação interna centralizada em `_shared/auth.ts`:

- `authenticate()` valida o JWT com client anon e só depois abre client service_role
- `assertMembership()` checa vínculo em `company_members`
- `assertCanWrite()` barra papel `viewer` explicitamente (necessário porque service_role bypassa RLS; sem esse check o "somente leitura" da conta demo não valeria em caminhos de edge)

Verificado por amostragem:

- `public-api`: read-only, autentica por `X-API-Key` (`cfk_` + 64 hex), compara SHA-256 contra `api_keys.key_hash`, respeita revogação, escopo por `company_id` da chave, limite máximo 500, envelope `{ success, data, error }`
- `whatsapp-webhook`: exige `webhook_secret` por instância (header `X-Webhook-Secret` ou `?token=`), filtra grupo dedicado (`group_jid`), deduplica por `message_id`, não loga payload completo (PII). Pipeline: texto/áudio (transcrição Gemini)/imagem (OCR Gemini) -> assistente CFO via Lovable AI Gateway -> resposta em chunks de 3800 chars -> log em `whatsapp_messages`. Comandos `ações` / `aprovar N` / `recusar N` decidem `agent_actions` pendentes

Ponto de atenção (não corrigido nesta leitura): a validação do secret no `whatsapp-webhook` acontece DEPOIS do lookup de `whatsapp_configs`, o que é correto, mas o retorno `skipped: no-config` antes do check de secret permite enumerar nomes de instância ativos sem secret. Baixa severidade, registro para próxima rodada.

## Banco (75 tabelas em `public`)

- RLS: 100% das tabelas com RLS habilitado e pelo menos 1 policy (0 tabelas sem policy). Núcleo multi-tenant via `companies` / `company_members` (papéis admin, member, viewer)
- Domínios: financeiro (transactions, bills_payable, receivables, invoices, chart_of_accounts, cost_centers), integrações por empresa (asaas_*, stripe_*, inter_config, focus_config, plugnotas_*, nfse_config, contaazul_config, openfinance_config), agentes (agent_instances, agent_rules, agent_actions), WhatsApp (whatsapp_configs, whatsapp_messages), plataforma whitelabel (platform_owner, platform_lock, platform_settings, plans)

## Estado do template whitelabel (série de commits de 2026-08-02)

O projeto foi endurecido para sobreviver a remix (o Lovable copia estrutura de `public`, mas NÃO copia triggers de `auth.users`, NÃO executa migrations, NÃO copia dados e NÃO copia jobs do schema `cron`):

- `consagrar_dono_se_primeiro()`: RPC idempotente no login; primeiro usuário vira dono da plataforma
- `create_company_for_user`: portão de criação de empresa (primeiro, dono ou admin); conta avulsa fica inerte
- `garantir_planos()`: semeia `plans` por função (função sobrevive ao remix, INSERT em migration não)
- `garantir_agendamentos()`: recria os 5 jobs do pg_cron de forma idempotente, só quando há `CRON_SECRET` e `platform_settings.functions_url` registrados via `registrar_ambiente()` (evita instalação nova chamando as edge functions do projeto de origem)
- Última ação no histórico: revert em 2026-08-05 (`801f735a`) sobre o congelamento do template

## Fora do runtime Lovable

- `nfse-worker/`: worker Node no Railway para emissão NFS-e nacional com certificado (Deno edge não cobre); rotas emit/cancel/status
- `mcp-servers/` e `nfse-nacional-mcp/`: servidores MCP de desenvolvimento, não são deploy do app
- `src/lib/mcp/` + `supabase/functions/mcp`: MCP próprio do produto (tools de cash-summary, transactions, bills, receivables, companies)

## Verificações desta leitura

- `information_schema` + `pg_policies` consultados ao vivo via MCP (RLS confirmado no banco, não só no repo)
- Arquivos lidos no HEAD do repo via MCP oficial: `supabase/config.toml`, `_shared/auth.ts`, `public-api/index.ts`, `whatsapp-webhook/index.ts`, árvore completa de arquivos
