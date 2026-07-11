# mcp-belvo

Servidor MCP (stdio) para a API [Belvo](https://belvo.com) — Open Finance LATAM/Brasil.
Expõe instituições, widget token, links (conexões), contas, transações e webhooks.

## Setup

```bash
cd mcp-servers/belvo
npm install
npm run build
```

Credenciais (crie em [dashboard.belvo.com](https://dashboard.belvo.com)):

```bash
export BELVO_SECRET_ID="..."
export BELVO_SECRET_PASSWORD="..."
export BELVO_ENV="sandbox"   # ou "production"
```

## Registrar no Claude Code

```json
{
  "mcpServers": {
    "belvo": {
      "command": "node",
      "args": ["/Users/barboza/remix-of-cash-flow-bot/mcp-servers/belvo/dist/index.js"],
      "env": {
        "BELVO_SECRET_ID": "seu_secret_id",
        "BELVO_SECRET_PASSWORD": "seu_secret_password",
        "BELVO_ENV": "sandbox"
      }
    }
  }
}
```

## Sandbox

`https://sandbox.belvo.com` (padrão). Instituições de teste (ex.: `erebor_br_retail`)
com credenciais fictícias documentadas em developers.belvo.com. Fluxo:

1. `belvo_create_widget_token` → `{access}` para o widget, **ou** crie o link direto no dashboard.
2. `belvo_retrieve_accounts` / `belvo_retrieve_transactions` com o `link`.

## Ferramentas

| Tool | Descrição |
|---|---|
| `belvo_list_institutions` | Instituições (filtra país/tipo) |
| `belvo_create_widget_token` | Token do Connect Widget |
| `belvo_list_links` / `belvo_delete_link` | Conexões |
| `belvo_list_accounts` / `belvo_retrieve_accounts` | Contas (GET/força coleta) |
| `belvo_list_transactions` / `belvo_retrieve_transactions` | Transações (GET/coleta por período) |
| `belvo_list_webhooks` / `belvo_create_webhook` | Webhooks |

> Os shapes seguem a documentação estável da Belvo; valide contra o sandbox antes de produção.
