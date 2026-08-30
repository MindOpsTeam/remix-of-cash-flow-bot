# API pública v1 (read-only)

Base: `https://oxymhnddzamsjxwfglud.supabase.co/functions/v1/public-api/v1`
Auth: header `X-API-Key: cfk_...` (crie em **Configurações → API pública**; a chave é por CNPJ).
Envelope de resposta: `{ "success": boolean, "data": ..., "error": string | null }`.

| Rota | Escopo exigido | Parâmetros | Retorna |
|---|---|---|---|
| `GET /ping` | `read` | — | `{ pong, company_id }` — teste de conectividade |
| `GET /transactions` | `transactions:read` | `from`, `to` (YYYY-MM-DD), `limit` ≤ 500 | Lançamentos (data, descrição, valor, tipo, status, intercompany) |
| `GET /margin` | `margin:read` | `limit` | Série mensal consolidável: receita, custos (4.x), despesas — já sem intercompany |
| `GET /invoices` | `invoices:read` | `limit` | Notas fiscais (número, série, status, total, destaque CBS/IBS) |
| `GET /bills` | `bills:read` | `status` (`a_vencer`/`vencido`/`pago`), `limit` | Contas a pagar com estado de aprovação |

Exemplo:

```bash
curl -H "X-API-Key: cfk_SEU_TOKEN" \
  "https://oxymhnddzamsjxwfglud.supabase.co/functions/v1/public-api/v1/margin"
```

## Escopo da chave

Ao criar a chave você escolhe o que ela lê. `read` é o guarda-chuva e abre as
cinco rotas; os escopos finos abrem só a rota correspondente. Fora do escopo a
resposta é **403**, não 404 — a rota existe, a chave é que não alcança.

Chaves criadas antes de 29/08/2026 nasceram com `read` e continuam abrindo tudo:
para restringir, revogue e crie outra com o escopo certo.

## Teto de requisição

| Balde | Teto | Janela |
|---|---|---|
| Por chave reconhecida | 120 requisições | 60 s |
| Por origem, antes de reconhecer a chave | 30 requisições | 60 s |

Ao estourar, a resposta é **429** com `Retry-After` (segundos até a janela virar) e
`X-RateLimit-Limit`. Toda resposta bem-sucedida traz `X-RateLimit-Remaining`.

Notas:
- Somente leitura na v1; escrita virá em v2.
- A chave é armazenada como hash SHA-256 — se perder, revogue e crie outra.
- `last_used_at` registra o último uso (telemetria na tela de chaves).
- **Não chame do navegador.** Desde 29/08/2026 a função não devolve
  `Access-Control-Allow-Origin`: a chave `cfk_` é credencial de servidor, e
  liberar CORS fazia de qualquer página um caminho de uso para uma chave vazada.
  Use curl, backend, n8n, Power BI — nunca `fetch` de front.
- `from`/`to` só aceitam `YYYY-MM-DD` de um dia que existe; fora disso, **400**.
