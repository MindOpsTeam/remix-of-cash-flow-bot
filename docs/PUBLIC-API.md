# API pública v1 (read-only)

Base: `https://oxymhnddzamsjxwfglud.supabase.co/functions/v1/public-api/v1`
Auth: header `X-API-Key: cfk_...` (crie em **Configurações → API pública**; a chave é por CNPJ).
Envelope de resposta: `{ "success": boolean, "data": ..., "error": string | null }`.

| Rota | Parâmetros | Retorna |
|---|---|---|
| `GET /ping` | — | `{ pong, company_id }` — teste de conectividade |
| `GET /transactions` | `from`, `to` (YYYY-MM-DD), `limit` ≤ 500 | Lançamentos (data, descrição, valor, tipo, status, intercompany) |
| `GET /margin` | `limit` | Série mensal consolidável: receita, custos (4.x), despesas — já sem intercompany |
| `GET /invoices` | `limit` | Notas fiscais (número, série, status, total, destaque CBS/IBS) |
| `GET /bills` | `status` (`a_vencer`/`vencido`/`pago`), `limit` | Contas a pagar com estado de aprovação |

Exemplo:

```bash
curl -H "X-API-Key: cfk_SEU_TOKEN" \
  "https://oxymhnddzamsjxwfglud.supabase.co/functions/v1/public-api/v1/margin"
```

Notas:
- Somente leitura na v1; escrita virá em v2 com escopos.
- A chave é armazenada como hash SHA-256 — se perder, revogue e crie outra.
- `last_used_at` registra o último uso (telemetria na tela de chaves).
