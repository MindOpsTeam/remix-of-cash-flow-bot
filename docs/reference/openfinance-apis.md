# Referência de API — provedores Open Finance

Fontes: **Pluggy** = OpenAPI oficial (MCP `docs.pluggy.ai`, schemas exatos). **Belvo** = API estável documentada (developers.belvo.com) — validar shapes contra sandbox antes de produção.

---

## Pluggy — `https://api.pluggy.ai`

Auth por **API Key** de curta duração gerada a partir do par CLIENT_ID/CLIENT_SECRET. Header em todas as chamadas de dados: `X-API-KEY: <apiKey>`.

### Fluxo de conexão
1. `POST /auth` `{ clientId, clientSecret }` → `{ apiKey }` (validade ~2h).
2. `POST /connect_token` (header `X-API-KEY`) body `{ options: { clientUserId, webhookUrl, oauthRedirectUri, avoidDuplicates } }` → `{ accessToken }`. Esse `accessToken` inicializa o **widget Pluggy Connect** no frontend.
3. Usuário conecta o banco no widget → cria um **item** (uma conexão banco↔cliente). O widget devolve o `itemId` no callback (evento `onSuccess`).
4. `GET /accounts?itemId=<uuid>` → `{ results: [Account] }`.
5. `GET /v2/transactions?accountId=<uuid>&dateFrom=YYYY-MM-DD&after=<cursor>` → cursor pagination `{ results: [Transaction], next }`.

### Endpoints usados
| Método | Path | Uso |
|---|---|---|
| POST | `/auth` | gera apiKey |
| POST | `/connect_token` | token do widget |
| POST | `/items` | cria item server-side (credenciais diretas — não usamos; usamos o widget) |
| GET | `/items/{id}` | status da conexão (UPDATED / UPDATING / LOGIN_ERROR / OUTDATED) |
| DELETE | `/items/{id}` | remove a conexão (revoga consentimento) |
| GET | `/accounts?itemId=` | contas da conexão |
| GET | `/v2/transactions?accountId=` | transações (cursor) |
| GET | `/connectors?countries=BR` | catálogo de bancos |
| POST/GET/DELETE | `/webhooks` | registra endpoint de eventos |

### Account (resumo)
`{ id, type: BANK|CREDIT, subtype: CHECKING_ACCOUNT|SAVINGS_ACCOUNT|CREDIT_CARD, number, name, marketingName, balance, itemId, taxNumber, owner, currencyCode, bankData{ transferNumber, closingBalance, ... }, creditData{...} }`

### Transaction (resumo)
`{ id, description, descriptionRaw, currencyCode, amount, date, type: DEBIT|CREDIT, balance, status: POSTED|PENDING, category, categoryId, accountId, paymentData{ paymentMethod: PIX|TED|DOC|BOLETO, payer, receiver }, createdAt, updatedAt }`
> Convenção normalizada: `DEBIT` = saiu dinheiro (→ despesa), `CREDIT` = entrou (→ receita). Cartão já vem normalizado.

### Webhook events relevantes
`item/created`, `item/updated`, `item/error`, `transactions/created`, `transactions/updated`, `connector/status_updated`. Payload: `{ event, itemId, ... }`. Sem assinatura HMAC nativa — validar por `itemId` conhecido + secret opcional na URL.

### Sandbox
Conector sandbox **"Pluggy Bank" (connectorId 2)** e **MeuPluggy (200)** com credenciais `user-ok` / `password-ok` para simular conexão bem-sucedida (e `user-mfa`, `user-bad` para MFA/erro). Sandbox é **gratuito e self-service** em `dashboard.pluggy.ai` → API Keys. Trial de produção de 14 dias.

---

## Belvo — `https://sandbox.belvo.com` (prod: `https://api.belvo.com`)

Auth por **HTTP Basic** com `secretId:secretPassword` em toda chamada (não há token de sessão para a API REST; o widget usa um access token próprio).

### Fluxo de conexão
1. `POST /api/token/` `{ id: <secretId>, password: <secretPassword>, scopes: "read_institutions,write_links,read_links" }` → `{ access, refresh }` para o **Connect Widget**.
2. Widget conecta o banco → cria um **link** (equivalente ao item da Pluggy). Callback devolve `link` id.
3. `GET /api/accounts/?link=<id>` (ou `POST /api/accounts/` `{ link }` para forçar coleta).
4. `GET /api/transactions/?link=<id>&page_size=100` (paginado por `next`/`previous`).

### Endpoints usados
| Método | Path | Uso |
|---|---|---|
| POST | `/api/token/` | access token do widget |
| GET | `/api/institutions/` | catálogo (filtra por `country_code=BR`) |
| GET/DELETE | `/api/links/` `/api/links/{id}/` | conexões |
| GET/POST | `/api/accounts/` | contas (POST força coleta) |
| GET/POST | `/api/transactions/` | transações |
| GET/POST/DELETE | `/api/webhooks/` | eventos |

### Transaction (resumo Belvo)
`{ id, account{...}, amount, currency, description, value_date, accounting_date, type: INFLOW|OUTFLOW, status: PROCESSED|PENDING|UNCATEGORIZED, category, merchant{...}, collected_at }`
> `OUTFLOW` = despesa, `INFLOW` = receita.

### Webhook
`POST /api/webhooks/` `{ url, auth_token, events: ["ACCOUNTS", "TRANSACTIONS", ...] }`. Belvo assina os webhooks; validar o `auth_token` no header.

### Sandbox
`https://sandbox.belvo.com`, gratuito. Instituições de teste (ex.: `erebor_br_retail`) com credenciais fictícias documentadas. Registro em `dashboard.belvo.com`.

---

## Mapeamento comum → nosso domínio (`transactions`)

| Nosso campo | Pluggy | Belvo |
|---|---|---|
| `date` | `date` | `value_date` |
| `description` | `description` | `description` |
| `amount` | `abs(amount)` | `amount` |
| `type` (revenue/expense) | `CREDIT`→revenue, `DEBIT`→expense | `INFLOW`→revenue, `OUTFLOW`→expense |
| `external_id` | `id` | `id` |
| `source` | `'openfinance'` | `'openfinance'` |

### Limites da rede OFB (ver docs/OPEN-FINANCE-DECISAO.md)
Histórico 365d: **8 chamadas/CNPJ/mês** → puxar 1× no onboarding. Transações recentes: 240/mês → incremental por webhook. Contar chamadas por conexão.
