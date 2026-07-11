# Open Finance multi-banco — decisão build vs buy (2026-07-10)

Lacuna: hoje só Banco Inter direto (mTLS) + import OFX/CSV. Concorrente (Conta Azul) tem 10 bancos via Open Finance regulado. Três rotas avaliadas com pesquisa verificada (fontes no fim).

## As três rotas

### A) Melhor custo-benefício — AGREGADOR (recomendada)
Consumir o Open Finance via participante regulado (parceria Art. 36 da Res. Conjunta 1/2020). Sem exigência regulatória para nós.

| Fornecedor | Pricing | Cobertura PJ | Nota |
|---|---|---|---|
| **Pluggy** | piso ~R$ 2.500/mês (mínimo + excedente por chamada); sandbox grátis + trial produção 14d | 300+ conectores; PJ confirmado nos 12 maiores | ITP autorizada BCB; clientes: **Conta Azul, Nibo, TOTVS, Contabilizei, Granatum** — nosso segmento exato |
| Tecnospeed PlugBank | ~R$ 1.500 setup + R$ 540/mês (relato) | validar em POC | opção barata; mesma casa do PlugNotas (sinergia de contrato!) |
| Iniciador | comercial (claim: produção em ~1 semana) | 100+ instituições | forte em ITP/Pix |
| Belvo | US$ 1.000+/mês (relato real ~R$ 6k) | ~24 PJ (menor) | multi-país, sem vantagem p/ nós |
| Klavi | enterprise, foco crédito/risco | PF+PJ | fit fraco p/ conciliação ERP |

Economia unitária: piso Pluggy dilui a ~R$ 25/CNPJ com 100 CNPJs conectados — cabe no pricing de qualquer plano.

### B) State-of-the-art — PARTICIPAÇÃO DIRETA no OFB (descartada)
É o que a Conta Azul fez — mas ela é Instituição de Pagamento autorizada BC. Exige: licença BCB (IP/SCD, 1-2 anos, capital mínimo, PLD/compliance), certificação FAPI/DCR, certificados BRCAC/BRSEAL ICP-Brasil, custeio rateado da estrutura (IN BCB 485/2024). Prazo realista p/ não regulado: **2-3 anos e centenas de milhares de reais**. Só faz sentido se o produto virar fintech (conta própria, float, crédito) — decisão de empresa, não de feature.

### C) Codar na mão — banco a banco (descartada como rota principal)
BB (API Extratos), Sicoob (self-service, cert A1 do cooperado c/ rotação anual), Santander (Saldo/Extrato v6) são factíveis a ~2-4 sem/banco. **Mas Caixa não tem extrato PJ público, Bradesco é ambíguo, Itaú só via gerente** — cobertura trava em ~60-70% e o atrito de onboarding (certificado A1 + gerente por cliente) escala mal em multi-tenant. Mantemos o Inter existente (grátis, já pago) e nada mais nessa rota.

## Restrição de arquitetura que vale para QUALQUER rota
Limites operacionais da rede OFB por CNPJ/mês: **histórico 365d = 8 chamadas**, transações recentes = 240, saldos = 420. O sync deve: puxar histórico 1× no onboarding, depois só incrementais via webhook/agenda, com timestamp "última atualização" na UI (padrão Conta Azul).

## Decisão
**Rota A com POC dupla: Pluggy (sandbox grátis) × Tecnospeed PlugBank (sinergia PlugNotas).** Iniciador como carta na manga. Inter direto permanece (custo zero). Rota B reavaliada apenas se/quando houver tese de virar IP.

## Arquitetura de implementação (validada contra a API real da Pluggy via MCP)

Fluxo Pluggy: `POST /auth` (CLIENT_ID/SECRET → apiKey) → `POST /connect_token` → widget **Pluggy Connect** no frontend (usuário dá consentimento no banco) → cria `item` (conexão) → `GET /accounts` + `GET /v2/transactions` → webhooks `item/updated`, `transactions/created`.

Componentes no nosso stack (espelha o padrão inter-banking/asaas):

1. **Migration aditiva**: `bank_connections` (company_id, provider 'pluggy', item_id, institution, status, last_synced_at, RLS is_company_member) + `bank_accounts.connection_id/external_id` + `transactions.source='openfinance'` + staging `bank_transactions_raw` (dedupe por external_id).
2. **Edge `openfinance-connect`**: auth `_shared/auth.ts`; cria connect_token (secrets `PLUGGY_CLIENT_ID/SECRET`); registra item no callback.
3. **Edge `openfinance-webhook`**: valida assinatura; em `transactions/created` busca incrementais e insere no staging; agenda fallback pg_cron diário (respeitando limites OFB).
4. **Ingestão → conciliação**: staging → propõe `transactions` via `ai-classify` + match com lançamentos existentes reusando `reconcile-transactions`; divergências viram `agent_actions` (aprovação humana — nosso padrão).
5. **UI**: em `/settings/bank-accounts`, botão "Conectar banco (Open Finance)" abre o widget; card mostra instituição, status e "última atualização" (gerencia expectativa de atraso por transmissora).
6. **Custo-guarda**: contador de chamadas por CNPJ/mês em `bank_connections` para nunca estourar os limites da rede.

Estimativa: ~1-2 semanas de dev depois do contrato/sandbox aprovado. Bloqueio externo: criar conta Pluggy (dashboard.pluggy.ai) e/ou falar com Tecnospeed — precisa do usuário.

## ✅ Implementado (2026-07-11)

A integração Pluggy foi construída de ponta a ponta (provider-agnóstica, Belvo plugável depois):

**Produto** (commit ba54aa8):
- Migration `bank_connections` + `bank_transactions_raw` (staging c/ dedupe) + colunas em `bank_accounts` — **aplicada em produção**.
- Edges `openfinance-connect` (token do widget + register+sync inicial), `openfinance-sync` (incremental + import p/ `transactions`), `openfinance-webhook` (ingest por evento). Guard do limite OFB (8 chamadas de histórico/CNPJ/mês) embutido.
- UI: componente **"Conectar banco (Open Finance)"** em Configurações → Contas Bancárias, com o widget oficial `react-pluggy-connect`, cards de status por conexão, botão sincronizar e badge de "N transações para revisar". Graceful quando as credenciais ainda não estão configuradas.
- `src/lib/openfinance.ts` provider-agnóstico (Pluggy + Belvo) + 7 testes unitários.

**MCP servers** (commit 4f3886e): `mcp-servers/pluggy` e `mcp-servers/belvo`, 10 ferramentas cada, registrados no Claude Code como `pluggy-api` e `belvo-api` (✔ conectados). Sandbox-ready.

### Sandbox — SIM, existe e é grátis
- **Pluggy**: sandbox self-service em dashboard.pluggy.ai. Conector 2 ("Pluggy Bank"), credenciais `user-ok`/`password-ok` simulam conexão OK (o widget aceita `includeSandbox`). Trial de produção 14 dias.
- **Belvo**: `https://sandbox.belvo.com`, instituição de teste `erebor_br_retail`.

### Como ATIVAR (passos do usuário — bloqueio externo)
1. Criar app no dashboard.pluggy.ai → copiar CLIENT_ID e CLIENT_SECRET.
2. Adicionar como **secrets do projeto Supabase/Lovable**: `PLUGGY_CLIENT_ID`, `PLUGGY_CLIENT_SECRET`. A partir daí o botão "Conectar banco" acende sozinho.
3. (MCPs) preencher as mesmas credenciais em `~/.claude.json` nos servidores `pluggy-api`/`belvo-api`.

## Fontes
pluggy.ai/pricing · pluggy.ai/open-finance · docs.pluggy.ai (OpenAPI oficial) · belvo.com/plans-and-pricing · developers.belvo.com (instituições PJ, limites de retrieval) · openfinancebrasil.org.br/onboarding · Res. Conjunta 1/2020 (Art. 36) · IN BCB 485/2024 (custeio) · TabNews (relatos de pricing Pluggy/Belvo/Tecnospeed) · portais dev BB/Sicoob/Santander/Itaú · Finsiders (BC regulamentando parcerias).
