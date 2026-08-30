# Hardening — 29/08/2026

Segunda passada de endurecimento, depois da de 21/08 (que criou `_shared/auth.ts`,
`assertCanWrite` e tirou o `SELECT` do `anon` nas tabelas de configuração de
integração). Esta olhou para o que aquela não cobriu: **views**, **escopo de
chave** e **teto de requisição**.

Ambiente: Lovable `c5ba5dcd-8f5b-46fe-a1fc-fd596c11b334` (`biz-whisper-fin`),
Supabase `oxymhnddzamsjxwfglud`.

---

## 1. CRÍTICO — a view devolvia o financeiro de todo mundo, sem login

`v_group_account_totals` foi criada em `20260709030000_group_coa_intercompany.sql`
e recriada em `20260812145038_review_fixes_fiscal.sql` **sem `security_invoker`**.

Uma view sem `security_invoker` roda com os poderes de quem a criou (`postgres`),
e `postgres` ignora RLS. A tabela `transactions` estava trancada e a janela ao
lado, escancarada.

**Prova antes da correção** (só com a chave anônima, que está no `.env` e no
bundle do front, isto é: disponível para qualquer pessoa que abra o site):

```
GET /rest/v1/v_group_account_totals?select=*   →  200, 111 linhas
    company_id | month | group_name              | type    | total
    6e60116e…  | 2025-09-01 | Receita de Serviços | revenue | 171397.00
    6e60116e…  | 2025-09-01 | Custo de Mercadoria | expense |  75131.00

GET /rest/v1/transactions?select=id,amount      →  200, []   ← a RLS da tabela funciona
```

Ou seja: receita mensal, custo, marketing e margem de cada CNPJ do banco, para
qualquer um.

**Correção.** `ALTER VIEW … SET (security_invoker = on)` em todas as views, via
`travar_views_na_rls()` — função, não comando solto, porque a próxima view que o
editor criar nasce com o mesmo defeito e alguém precisa poder rodar de novo.
Somado a isso, `REVOKE ALL … FROM anon` em toda view do schema `public`: nenhuma
tela pré-login lê `v_*` (o que a entrada precisa vem de `platform_settings`,
`platform_lock` e `demo_dataset`).

**Prova depois:**

| Quem | Antes | Depois |
|---|---|---|
| `anon` (sem login) | 111 linhas | **0 linhas** |
| Membro de 3 empresas | 111 linhas | 111 linhas, **3 empresas, 0 fora das dele** |

A DRE consolidada do grupo (`/consolidado`, `/contador`) continua inteira: as duas
telas já filtravam por `.in("company_id", <empresas do usuário>)`, exatamente o
conjunto que a RLS agora aplica sozinha.

---

## 2. ALTO — `scopes` da chave de API existia e mentia

`api_keys.scopes` é lido em `public-api` desde sempre… e nunca comparado com
nada. Toda chave válida abria as cinco rotas. Quem entregasse a chave "do
faturamento" ao contador entregava junto a lista de contas a pagar.

Um campo que existe e não vale é pior que um campo ausente: quem cria a chave
acredita nele.

**Correção.** Escopo por rota (`ESCOPO_DA_ROTA` em `_shared/api-publica.ts`),
verificado antes de qualquer consulta; fora do escopo, **403**. `read` continua
sendo o guarda-chuva — é o default da coluna desde
`20260709050000_api_keys.sql`, então **nenhuma chave já emitida perdeu acesso**.
A tela de chaves ganhou o seletor: sem ele a trava não teria chave.

---

## 3. ALTO — nenhum endpoint público tinha teto

Varredura no repositório: as únicas menções a `429` eram para tratar 429 **de
terceiro**. Nada nosso contava requisição. Isso vale para `public-api`,
`webhook-receiver`, `company-asaas-webhook` e `openfinance-webhook` — todos com
`verify_jwt = false`.

O caso mais caro era `company-asaas-webhook`: cada POST anônimo obrigava uma
leitura de **Vault por empresa** com Asaas ligado, para comparar o token. Repetir
a requisição multiplicava trabalho no cofre, de graça.

**Correção.** `consumir_limite(bucket, teto, janela)` no Postgres — janela fixa,
`INSERT … ON CONFLICT DO UPDATE` atômico — e `_shared/limite.ts` nas functions.
O contador mora no banco porque edge function não guarda estado entre invocações:
um contador em memória zeraria a cada isolate novo e daria a impressão de existir
um limite onde não existe nenhum.

| Endpoint | Balde | Teto/min |
|---|---|---|
| `public-api` | por chave | 120 |
| `public-api` | por origem, antes de reconhecer a chave | 30 |
| `webhook-receiver` | por webhook + origem | 60 |
| `company-asaas-webhook` | por origem | 60 |
| `openfinance-webhook` | por item de conexão | 30 |

**Falha ABERTO de propósito.** Se o banco não responder, a chamada passa. Derrubar
o webhook de um banco ou de um emissor por indisponibilidade *nossa* é pior que
deixar passar: o teto existe contra abuso, não contra o parceiro. A falha vai
para o log com o nome do balde.

Limpeza: janelas velhas do mesmo balde somem a cada chamada (determinístico), e o
cron `rate-limit-limpeza` (04:17, SQL puro, sem segredo) varre baldes abandonados.

---

## 4. MÉDIO — `webhook-receiver`

Quatro coisas no mesmo arquivo:

- **Token na query string.** `?token=` entra em log de proxy, em histórico de
  navegador e no `Referer`. Um segredo que anda na URL vaza sozinho. Agora só
  header `x-webhook-token` — que é, aliás, o único jeito que a tela de
  Integrações já documentava.
- **`token !== webhook.secret_token`.** Sai no primeiro byte diferente. Num
  endpoint aberto essa diferença é medível em volume e troca "adivinhar um token
  de 32 bytes" por "adivinhar 32 vezes um byte". Virou `segredosBatem()`, que
  compara todos os bytes.
- **Oráculo de existência.** 404 "Webhook not found" confirmava *este id não
  existe*; 401 "Invalid token" confirmava *este id existe, erraste o segredo*.
  Quem varria ids ganhava metade do trabalho. As duas viraram a mesma resposta.
- **Corpo sem teto.** `req.json()` aceitava o que mandassem. Agora 256 KB, contados
  em bytes do que chegou — não no `content-length`, que é do cliente e quem quer
  abusar simplesmente não manda.

---

## 5. MÉDIO — privilégio de `anon` além do necessário

`anon` tinha `EXECUTE` em RPC de escrita (`baixar_titulo`, `estornar_baixa`,
`desfazer_importacao`) e de leitura de pessoas (`autores_da_empresa`, que devolve
e-mail de `auth.users`). **Não era explorável** — todas checam
`is_company_member` / `pode_escrever_na_empresa` por dentro, e essas dependem de
`auth.uid()`, nulo sem sessão. Mas é a segunda tranca que faltava, então foi
revogado.

Ficou de fora, de propósito: `limpar_demonstracao_se_remixado()`. Ela **é**
chamada sem sessão, num remix recém-criado, antes de existir a primeira pessoa
(ver `src/lib/rpc-plataforma.ts`). Revogar teria quebrado a higiene do remix — o
tipo de estrago que uma passada de hardening cega faz.

### A armadilha do `REVOKE ... FROM anon`

A primeira tentativa **não mudou nada e não reclamou**. O default do Postgres
para função é `EXECUTE` para `PUBLIC`, e `anon` herda por ali. A ACL era:

```
=X/postgres | postgres=X/postgres | authenticated=X/postgres | service_role=X/postgres
^^ este grantee vazio é PUBLIC
```

`REVOKE ... FROM anon` tirava um grant explícito que nem sempre existia, e
`has_function_privilege('anon', …)` continuava `true`. O comando roda, devolve
sucesso, e a migration parece aplicada.

O certo é `REVOKE ... FROM PUBLIC` e depois `GRANT ... TO authenticated,
service_role` — nomeando quem deve ter. A migration termina com um `DO` que
levanta exceção se sobrar RPC executável por `anon`: sem essa prova, a próxima
migration acreditaria num estado que não existe.

---

## 6. MÉDIO — 12 tabelas fora da trava de whitelabel

`20260801100000_whitelabel_lock.sql` rodou **uma vez**, sobre as tabelas que
tinham RLS naquele dia. Tudo criado depois ficou de fora: `title_payments` (o
livro de baixas, de 21/08) e as sete `stay_*` (hospedagem, de 27/08), entre
outras. Num template bloqueado dava para lançar baixa e reserva.

Virou `aplicar_trava_de_template()`, repetível e idempotente, pulando só
`platform_lock` (o interruptor), `platform_settings` (a configuração do dono, que
precisa funcionar justamente com a trava ligada), `demo_dataset` e
`rate_limit_counters`.

---

## O que foi olhado e estava certo

Vale registrar para a próxima passada não gastar o tempo de novo:

- **RLS ligada em 100% das tabelas**, todas com pelo menos uma policy.
- As únicas policies `using (true)` são de dado de referência
  (`municipalities`, `tax_rates`, `plans`, `cclasstrib_codigos`,
  `indices_economicos`) e do estado pré-login. `anon` lê 0 linha das primeiras.
- **`reconciliation_log`** tem uma policy `ALL/true`, mas escopada a
  `service_role` — que ignora RLS de qualquer jeito. Não é buraco.
- **Módulo `stay_*`**: RLS correta e bem escopada
  (`is_company_member` na leitura, `pode_escrever_na_empresa` na escrita, com
  `WITH CHECK` no insert). Só faltava a trava de template, item 6.
- **Toda função `SECURITY DEFINER` tem `search_path`** — nenhuma vulnerável a
  sequestro de schema.
- **`api_keys` guarda hash** (`key_hash`), nunca a chave.
- **Bucket `documents` privado**, policies por pasta = `company_id` ou `auth.uid()`.
- **`stripe-webhook` valida assinatura**; `_shared/auth.ts` é usado por todas as
  functions de tela.
- Nenhuma função lê `request.jwt.claim.role` no singular (o defeito que liberava
  todo mundo no projeto irmão).
- `.env` versionado contém só a chave **publicável** — é assim que o Lovable
  funciona e ela é pública por natureza.

## O que ficou de fora, e por quê

- **CORS `*` nas demais functions.** Elas exigem `Authorization: Bearer`, não
  cookie, então `*` não é caminho de ataque por si. Restringir origem quebraria
  preview do Lovable e domínio publicado sem ganho proporcional. `public-api` foi
  a exceção, porque ali a credencial é a chave `cfk_`, de servidor.
- **Proteção de senha vazada / expiração de OTP** no Auth: é chave de tela do
  painel Supabase, não migration. Fica como recomendação ao dono da instalação.
