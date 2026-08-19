# Integrações e credenciais

Inventário do que este sistema conecta e de tudo que exige chave. Levantado no
código e no banco em 19/08/2026, não de memória.

**Regra da Solução:** nenhum secret viaja no remix. Toda credencial é pedida na
UI (Configurações → Integrações, ou o assistente no primeiro acesso) e guardada
no Vault do Postgres, com nome `integracao:<provider>:<company_id>:<campo>`.

## As 11 integrações do catálogo

| # | Integração | Categoria | Pede chave? | Testar de graça |
|---|---|---|---|---|
| 1 | Open Finance (Pluggy) | banco | Client ID + Secret | Sim, com conector sandbox. Banco real exige app de produção |
| 2 | Asaas | cobrança | API Key | Sim, sandbox gratuito e permanente |
| 3 | Stripe | cobrança | Secret Key + Webhook Secret | Sim, modo de teste permanente |
| 4 | Banco Inter | banco | Client ID/Secret + certificado mTLS | **Não.** Trabalha direto na conta real |
| 5 | WhatsApp (Evolution) | comunicação | URL + chave global | Sim, software open source e gratuito |
| 6 | Conta Azul | dados | Client ID + Secret (OAuth) | Sim, app de Desenvolvimento. Exige plano Pro |
| 7 | PlugNotas | fiscal | API Key | Sim, sandbox |
| 8 | Focus NFe | fiscal | Token homologação + produção | Sim, homologação ilimitada |
| 9 | NFS-e (worker próprio) | fiscal | URL + chave do worker | Sem licença; custo é o servidor |
| 10 | **Motor de previsão (Google Cloud / TimesFM)** | dados | JSON da conta de serviço | Franquia gratuita do BigQuery, mas exige cartão |
| 11 | **Certificado digital A1** | fiscal | Arquivo .pfx + senha | **Não.** Documento pago, ~R$ 200 a 400/ano |

As duas últimas entraram em 19/08. As nove primeiras já existiam.

## O que NÃO pede nada do cliente

| Peça | Por quê |
|---|---|
| Inteligência artificial (Gemini) | Vem pelo Lovable AI Gateway com a `LOVABLE_API_KEY`, provisionada automaticamente no remix |
| Segredo do cron | Interno. `ensure_cron_secret()` gera 32 bytes aleatórios na primeira leitura |
| Banco de dados e autenticação | `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` são provisionadas pelo Lovable Cloud |

## Onde cada credencial mora

Todas no Vault. Nenhuma coluna de tabela guarda segredo: as que guardavam foram
esvaziadas e tiveram o `SELECT` revogado do cliente (migration
`20260819180000_credenciais_no_vault.sql`).

```
integracao:asaas:<company_id>:api_key_production
integracao:asaas:<company_id>:api_key_sandbox
integracao:asaas:<company_id>:webhook_auth_token
integracao:inter:<company_id>:client_secret
integracao:inter:<company_id>:key_pem
integracao:plugnotas:<company_id>:api_key
integracao:evolution:<company_id>:api_key
integracao:evolution:<company_id>:webhook_secret
integracao:nfse:<company_id>:cert_password
integracao:nfse:<company_id>:worker_api_key
integracao:gcp:<company_id>:service_account
integracao:gcp:<company_id>:project_id
stripe_secret_key_<config_id>          (padrão anterior, mantido)
stripe_webhook_secret_<config_id>
CRON_SECRET                            (interno, auto-provisionado)
```

Leitura só por `service_role`, com checagem dentro da função (`papel_do_chamador`),
para a proteção sobreviver ao remix, que copia estrutura mas não privilégios.

## Motor de previsão: como funciona a escolha

O forecast tem dois motores e nunca depende do melhor para existir:

1. **TimesFM** (Google, dentro do BigQuery), quando a empresa configurou a
   credencial e há pelo menos 6 meses de histórico. Reconhece sazonalidade que a
   média achata: dezembro, décimo terceiro, imposto que segue o faturamento.
2. **Projeção estatística** (média ponderada do histórico), em qualquer outro
   caso. É o padrão e funciona sozinho.

A resposta do `ai-forecast` traz o campo `motor` (`timesfm` ou `estatistico`),
para a tela poder dizer ao usuário em cima do que a projeção foi feita.

O modelo de linguagem **não calcula** em nenhum dos dois casos: ele recebe os
números prontos e escreve a explicação em volta. Se ele cair, a projeção
continua de pé.

## Como adicionar uma integração nova

1. Entrada em `CATALOGO_INTEGRACOES` (`src/lib/integracoes-catalogo.ts`), com o
   guia completo: passos, pré-requisitos, armadilhas, trial e custo.
2. `case` de gravação em `salvarIntegracao` (`src/lib/integracoes-io.ts`),
   chamando `gravarSegredo` para cada campo secreto.
3. Checagem em `IDS_COM_DETECCAO` e na lista de status do mesmo arquivo, senão
   ela fica "não configurado" para sempre.
4. Leitura no backend por `segredoDaIntegracao` (`_shared/segredos.ts`). Nunca
   por `Deno.env`: toda leitura de env vira um campo obrigatório na tela de
   secrets do remix.

Os testes em `src/lib/integracoes-catalogo.test.ts` e
`src/test/guias-integracao.test.tsx` falham se qualquer um desses passos ficar
para trás.
