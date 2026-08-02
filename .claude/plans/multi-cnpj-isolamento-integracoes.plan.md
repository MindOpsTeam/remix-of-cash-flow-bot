# Plano: multi-CNPJ com integrações isoladas por empresa

**Origem**: revisão pedida em 02/08/2026
**Complexidade**: Média (schema + cofre + webhook + UI; sem reescrita de domínio)
**Status**: EXECUTADO em 02/08/2026 — commit d5335a1. Fases 0 a 4 concluídas e provadas com rollback.

## Resumo

A arquitetura multi-CNPJ **já está certa no essencial**: cada empresa é um tenant com RLS
própria, toda escrita acontece numa empresa específica, e o consolidado já é só painel de
leitura. O que falta é plural em duas integrações: **Stripe** (hoje 1 por empresa, o pedido é
2 na A e 3 na B) e **WhatsApp** (o schema já permite N, mas o código quebra ao salvar).

---

## Parte 1 — Como é hoje (auditado, não presumido)

### O que já está correto

| Ponto | Evidência |
|---|---|
| **Isolamento por empresa** | As 13 tabelas de integração têm RLS ligada, com 4 a 10 policies cada. Smoke com rollback provou: membro da empresa A não enxerga config, repasse nem cobrança de empresa alheia, e não consegue gravar credencial nela. |
| **Consolidado é só leitura** | `scope` (`"all"` ou id) é lido em **um único lugar**: `src/pages/Index.tsx:65`. As 48 telas transacionais usam `company` (a empresa ativa). Nenhuma escrita acontece em escopo combinado — a separação que você descreveu já existe. |
| **N contas bancárias por CNPJ** | `bank_connections` é única por `(company_id, provider, external_id)` e `bank_accounts` não tem unique por empresa. "Bradesco x e y" na A e "dois BB + um Santander" na B **já funciona hoje**. |
| **Fiscal 1:1 é a modelagem certa** | `focus_config`, `plugnotas_config`, `nfse_config` são únicos por empresa — e devem continuar. Emissor fiscal está amarrado a CNPJ + certificado; permitir N aqui seria modelar errado, não mais flexível. |

### O que está errado

| # | Problema | Evidência | Impacto |
|---|---|---|---|
| **1** | **Stripe aceita só 1 conta por empresa** | `stripe_config_company_id_key -> (company_id)` | Bloqueia direto o pedido (2 canais na A, 3 na B) |
| **1a** | Segredo no cofre é nomeado por empresa | `'stripe_secret_key_' \|\| p_company_id` | Uma segunda chave sobrescreve a primeira |
| **1b** | Webhook identifica a conta pela empresa | `?company=<uuid>` em `stripe-webhook/index.ts:42` | Com N contas, não sabe qual assinou o evento |
| **1c** | Cobrança e repasse não sabem de qual conta vieram | `stripe_charges` / `stripe_payouts` sem coluna de config | Dois canais viram um caldo só; conciliação erra |
| **2** | **Salvar WhatsApp quebra hoje** | `integracoes-io.ts:96` faz `upsert(onConflict: "company_id")`, mas `whatsapp_configs` só tem unique em `id`. Reproduzido: Postgres 42P10 | A integração **não salva** pela central nem pelo wizard |
| **3** | Asaas, Inter e Conta Azul são 1 por empresa | `*_config_company_id_key` | Fora do pedido atual (você pediu 1 Asaas), mas é limite de schema, não decisão registrada |

**Achado que muda a prioridade**: o item 2 não é sobre plural — é um bug de produção. O
WhatsApp aparece na tela, o usuário preenche, clica em salvar e recebe erro. Vale corrigir
antes do resto.

---

## Parte 2 — O que muda

### Princípio

Trocar "uma config por empresa" por **"N canais por empresa, cada um com identidade própria"**,
sem tocar no que já está certo. A empresa continua sendo a fronteira de isolamento; o canal
passa a ser a unidade de configuração.

### Padrões a espelhar

| Categoria | Fonte | Padrão |
|---|---|---|
| Nomes | `supabase/migrations/20260801180000_stripe_gateway.sql` | `stripe_*` snake_case, comentário explicando *por que* a tabela existe |
| Cofre | `set_stripe_credentials` / `get_stripe_credentials` | SECURITY DEFINER; escrita checa `pode_escrever_na_empresa`; leitura só `service_role` |
| RLS | mesma migration | 4 permissivas + 3 RESTRICTIVE de viewer + 3 RESTRICTIVE de template = 10 policies |
| N por empresa | `bank_connections` | unique em `(company_id, provider, external_id)`, nunca em `company_id` sozinho |
| Erros | `src/lib/erros.ts` | `mensagemDeErro()` traduz; nunca vazar texto de Postgres |
| Testes | `src/test/*.test.ts` + `e2e/design-system.spec.ts` | regra pura em vitest; comportamento de tela em Playwright |

---

## Fases

### Fase 0 — Corrigir o WhatsApp quebrado (independente, entrega valor sozinha)

- Remover o `onConflict: "company_id"` de `integracoes-io.ts`; passar a inserir/atualizar por `id`.
- Migration: `UNIQUE (company_id, instance_name)` — dois canais na mesma empresa precisam de
  nomes distintos, e é isso que dá identidade a cada um.
- **Valida**: smoke SQL provando que dois canais coexistem e que nome repetido é recusado.

### Fase 1 — Stripe plural no banco

- `DROP CONSTRAINT stripe_config_company_id_key`; criar `UNIQUE (company_id, apelido)`.
- Coluna `apelido text NOT NULL` ("Loja SP", "Checkout site") — é como o operador distingue os
  canais na tela e nos relatórios.
- `stripe_charges` e `stripe_payouts` ganham `config_id uuid REFERENCES stripe_config(id)`.
- **Cofre**: renomear os segredos de `stripe_secret_key_<company_id>` para
  `stripe_secret_key_<config_id>`. Migration de dados move os existentes antes de trocar a régua.
- `set_stripe_credentials` / `get_stripe_credentials` passam a receber `p_config_id`.
- **Valida**: smoke com 3 canais na mesma empresa, cada um com chave própria no cofre, provando
  que ler o canal 1 não devolve a chave do canal 2.

### Fase 2 — Webhook e API por canal

- Webhook vira `?config=<config_id>`; a assinatura é conferida contra o segredo **daquele canal**.
- Compatibilidade: `?company=` continua aceito enquanto existir só um canal na empresa, para não
  derrubar webhooks já cadastrados no dashboard do Stripe.
- `stripe-api` passa a exigir `config_id` em cobrar/sincronizar/conciliar.
- `reconheceCobranca` e `componhoRepasse` gravam `config_id`.
- **Valida**: E2E de assinatura provando que evento assinado com o segredo do canal 1 é recusado
  quando endereçado ao canal 2 — é o mesmo teste de isolamento que já existe entre empresas.

### Fase 3 — UI de canais

- Card do Stripe no catálogo passa a listar canais, com "adicionar canal".
- `carregarConfiguradas` conta canal como configurado se **algum** existir.
- Tela de Repasses ganha filtro por canal e mostra o apelido em cada lote.
- Cobrar no cartão pergunta o canal quando houver mais de um (e não pergunta quando houver um só).
- **Valida**: E2E com dois canais, conferindo que o seletor aparece; com um, que não aparece.

### Fase 4 — Registrar o que ficou 1:1 de propósito

- Comentário em `focus_config`, `plugnotas_config`, `nfse_config` explicando que a unicidade é
  modelagem correta (CNPJ + certificado), não limitação a corrigir depois.
- Documentar Asaas/Inter/Conta Azul como "1 hoje, sem demanda para N" — para a próxima pessoa
  não achar que é esquecimento.

---

## Riscos

| Risco | Probabilidade | Mitigação |
|---|---|---|
| Migração do cofre perder chave existente | Média | Migration copia para o novo nome e só depois apaga o antigo, no mesmo statement; smoke com rollback antes de aplicar |
| Webhook cadastrado no Stripe parar de funcionar | **Alta se não tratada** | Manter `?company=` funcionando enquanto houver 1 canal; só exigir `?config=` a partir do segundo |
| `config_id` nulo em cobranças já gravadas | Alta | Backfill apontando para o canal único da empresa; coluna nullable até o backfill fechar |
| Conciliação misturar canais | Média | Régua N:1 passa a filtrar por `config_id`; o teste de composição ganha caso com dois canais no mesmo dia |
| Escopo crescer para "N Asaas, N Inter" | Média | Fora desta entrega por decisão explícita; o padrão fica pronto para repetir |

---

## Validação

```bash
npx tsc --noEmit -p tsconfig.app.json
npx vitest run
npx playwright test
npm run build
```

Mais os smokes SQL com rollback em produção, no padrão já usado nesta base:
`DO $$ ... RAISE EXCEPTION 'SMOKE >>> ...' $$;`

---

## Aceite

- [x] Salvar WhatsApp funciona, e dois canais coexistem na mesma empresa
- [x] N canais Stripe por empresa, cada um com chave própria no cofre (provado: canal 2 não lê a chave do canal 1)
- [x] Evento assinado pelo canal 1 é recusado quando endereçado ao canal 2 (teste unitário)
- [x] Repasse mostra de qual canal veio; cobrança e repasse são únicos por (canal, id do Stripe)
- [x] Webhook antigo (`?company=`) continua funcionando onde há um canal só — e recusa com instrução onde há vários (provado na função deployada)
- [x] Consolidado segue sendo só leitura — nenhuma escrita nova em escopo combinado
- [x] Fiscal continua 1:1, com o motivo registrado no schema
