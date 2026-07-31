# mcp-contaazul

MCP server (stdio) para a API v2 da Conta Azul. Mesmo padrão de `mcp-servers/pluggy`.

## Credenciais

A API v2 usa OAuth2 (Cognito). Você precisa de um app registrado no portal
[developers.contaazul.com](https://developers.contaazul.com) e de um
`refresh_token` obtido no fluxo de autorização (o scope é fixo:
`openid profile aws.cognito.signin.user.admin`).

Envs:

```sh
CONTAAZUL_CLIENT_ID=...
CONTAAZUL_CLIENT_SECRET=...
CONTAAZUL_REFRESH_TOKEN=...
```

O access_token é renovado sozinho. Se o refresh_token rotacionar, o servidor
avisa no stderr — atualize o secrets.

## Build e registro

```sh
cd mcp-servers/contaazul
npm install && npm run build
claude mcp add contaazul --scope user -e CONTAAZUL_CLIENT_ID=... -e CONTAAZUL_CLIENT_SECRET=... -e CONTAAZUL_REFRESH_TOKEN=... -- node $(pwd)/dist/index.js
```

## Tools (14)

`ca_status` · `ca_list_pessoas` · `ca_get_pessoa` · `ca_create_pessoa` ·
`ca_list_produtos` · `ca_list_servicos` · `ca_list_vendas` · `ca_get_venda` ·
`ca_list_contas_receber` · `ca_list_contas_pagar` · `ca_list_parcelas` ·
`ca_list_contas_financeiras` · `ca_list_categorias` · `ca_api` (escape hatch)

Os caminhos exatos de busca do financeiro podem variar conforme a doc oficial
evoluir; `ca_api` cobre qualquer endpoint sem esperar release deste servidor.
