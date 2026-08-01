# FinanceAI whitelabel — como o template funciona

Este projeto é o **original**: serve de molde para outras pessoas remixarem. O banco de
origem fica vazio e somente leitura; o remix nasce livre, sem ninguém rodar nada.

## O mecanismo, em uma frase

A trava vale **se e somente se** o banco for este cluster Postgres. Como um remix
provisiona outro Supabase, a condição deixa de valer e tudo libera automaticamente.

```sql
-- identificador único do cluster (não muda no mesmo banco, muda em qualquer outro)
SELECT system_identifier FROM pg_control_system();
```

| Peça | Papel |
|---|---|
| `public.platform_lock` | guarda o identificador do cluster travado (uma linha) |
| `public.plataforma_bloqueada()` | `true` só no banco original; `false` em qualquer remix |
| Policies `Template nao aceita insert/update/delete` | RESTRICTIVE em todas as tabelas com RLS |
| Trigger `trg_bloqueia_cadastro_no_template` | barra `INSERT` em `auth.users` (mata o signup) |
| Guard em `create_company_for_user` | RPC `SECURITY DEFINER` bypassa RLS, então checa a trava também |

**Falha para o lado seguro**: sem a tabela, sem a linha, ou em outro cluster, o resultado
é "não bloqueado". Um remix jamais nasce travado — o pior caso é liberar, nunca travar.

## O que foi provado (smokes em produção, com rollback)

| Cenário | signup | escrita direta | RPC de criar empresa |
|---|---|---|---|
| Banco original | bloqueado | bloqueado | bloqueado |
| Outro cluster (remix simulado) | ok | ok | ok |

No cenário do remix o caminho real do cliente foi exercido de ponta a ponta: cadastrar,
criar a empresa pela RPC, lançar no DRE e definir meta. Tudo funcionou.

## Primeiro usuário = administrador

No banco remixado (vazio), o primeiro cadastro é gravado em `public.platform_owner` pelo
trigger `trg_consagra_primeiro_usuario`. Consequências no app:

- `sou_dono_da_plataforma()` responde `true` para ele;
- ele entra e cai direto no **assistente de instalação** (`onboarding_completed = false`),
  que reúne todas as chaves com teste de conexão, guia de "como obter" e custo;
- um segundo cadastro **não** toma o posto (a linha é única e imutável).

Enquanto a configuração não chega a 100%, aparece no topo o lembrete discreto
**"Concluir configuração N/8"**, que leva a `/settings/plataforma` e some sozinho quando
tudo estiver ligado. Não há modal nem banner: o lembrete não atrapalha quem só quer
trabalhar.

## Entregar o template

1. Confirme que o banco está vazio: `SELECT count(*) FROM auth.users;` deve ser `0`.
2. Confirme a trava: `SELECT public.plataforma_bloqueada();` deve ser `true`.
3. Publique o projeto no Lovable e compartilhe para remix.

Quem remixar recebe o schema completo (inclusive a trava), mas em outro cluster — então
abre a URL, cria a primeira conta e já é o administrador.

## Destravar o original (só o dono do template)

```sql
DELETE FROM public.platform_lock;                    -- destrava
```

Para travar de novo:

```sql
INSERT INTO public.platform_lock (id, locked_system_identifier, motivo)
VALUES (true, (SELECT system_identifier::text FROM pg_control_system()), 'template');
```

## Backup do que existia antes

A limpeza que precedeu a virada para template preservou os dados no schema
`backup_pre_whitelabel_20260801` (115 usuários, 136 empresas, 394 lançamentos e as
tabelas de apoio). Catálogos de produto continuam vivos em `public`: `plans` (3),
`municipalities` (5.571) e `tax_rates`.
