# mcp-pluggy

Servidor MCP (stdio) para a API [Pluggy](https://pluggy.ai) — Open Finance Brasil.
Expõe conectores, connect tokens, items (conexões), contas, transações e webhooks
como ferramentas para o Claude/qualquer cliente MCP.

## Setup

```bash
cd mcp-servers/pluggy
npm install
npm run build
```

Credenciais (crie grátis em [dashboard.pluggy.ai](https://dashboard.pluggy.ai) → API Keys):

```bash
export PLUGGY_CLIENT_ID="..."
export PLUGGY_CLIENT_SECRET="..."
# opcional: export PLUGGY_API_URL="https://api.pluggy.ai"  (padrão)
```

## Registrar no Claude Code

`~/.claude/settings.json` (ou via `claude mcp add`):

```json
{
  "mcpServers": {
    "pluggy": {
      "command": "node",
      "args": ["/Users/barboza/remix-of-cash-flow-bot/mcp-servers/pluggy/dist/index.js"],
      "env": {
        "PLUGGY_CLIENT_ID": "seu_client_id",
        "PLUGGY_CLIENT_SECRET": "seu_client_secret"
      }
    }
  }
}
```

## Sandbox (sem custo, self-service)

O sandbox usa a mesma API. Simule uma conexão bem-sucedida:

1. `pluggy_create_item` com `connectorId: 2` (Pluggy Bank) e `parameters: {"user":"user-ok","password":"password-ok"}`.
   - `user-mfa` / `password-ok` simula MFA; `user-bad` simula erro de login.
2. `pluggy_list_accounts` com o `itemId` retornado.
3. `pluggy_list_transactions` com o `accountId`.

## Ferramentas

| Tool | Descrição |
|---|---|
| `pluggy_list_connectors` | Bancos disponíveis (filtra país/nome/Open Finance/sandbox) |
| `pluggy_create_connect_token` | Token do widget Pluggy Connect |
| `pluggy_create_item` | Cria conexão server-side (sandbox/credenciais diretas) |
| `pluggy_get_item` | Status/detalhe de uma conexão |
| `pluggy_delete_item` | Remove a conexão (revoga consentimento) |
| `pluggy_list_accounts` | Contas de um item |
| `pluggy_get_account_balance` | Saldo em tempo real |
| `pluggy_list_transactions` | Transações de uma conta (cursor `after`) |
| `pluggy_list_webhooks` / `pluggy_create_webhook` | Gerência de webhooks |

Referência de schemas: `../../docs/reference/openfinance-apis.md`.
