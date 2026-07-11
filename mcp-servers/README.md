# MCP servers — Open Finance

Servidores MCP (stdio) para operar as APIs dos agregadores Open Finance direto do
Claude Code / qualquer cliente MCP. Úteis para POC de sandbox, debug de conexões e
automação da integração descrita em `../docs/OPEN-FINANCE-DECISAO.md`.

| Servidor | Provedor | Auth | Setup |
|---|---|---|---|
| [`pluggy/`](pluggy/README.md) | Pluggy (BR) | `PLUGGY_CLIENT_ID/SECRET` | sandbox grátis self-service |
| [`belvo/`](belvo/README.md) | Belvo (LATAM) | `BELVO_SECRET_ID/PASSWORD` | sandbox grátis |

Cada um: `npm install && npm run build`, depois registre no Claude Code (ver README de cada).
10 ferramentas cada, cobrindo conectores/instituições, connect token, conexões, contas,
transações e webhooks. Schemas em `../docs/reference/openfinance-apis.md`.
