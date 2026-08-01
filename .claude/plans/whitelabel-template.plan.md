# Plan: FinanceAI como template whitelabel travado (com auto-liberação no remix)

**Complexidade**: Large
**Estado do banco hoje (medido)**: 115 usuários, 136 empresas, 133 membros, 394 lançamentos, 67 tabelas, 219 policies.

## Resumo

Transformar este projeto no **template original whitelabel**: banco zerado, escrita e
cadastro bloqueados no banco de origem, e **liberação automática quando alguém remixa**.
Mais: o primeiro usuário que se cadastrar no remix vira o administrador da plataforma e
cai direto no wizard de configuração, com um botão discreto para retomar a configuração
enquanto ela não estiver 100%.

## A descoberta que sustenta o plano

O pivô é o **`system_identifier` do cluster Postgres**, já validado em produção:

```sql
SELECT system_identifier FROM pg_control_system();  -- 7581440907192989109 (este banco)
```

- É único por cluster. Um remix do Lovable provisiona **outro** Supabase → outro identificador.
- Validado: a role `authenticated` consegue lê-lo (testado com `SET LOCAL ROLE`).

Então a trava fica: "bloqueado **se e somente se** eu for o cluster `7581440907192989109`".
No remix a condição é falsa e **tudo libera sozinho, sem ninguém mexer em nada**.

## Patterns to Mirror

| Categoria | Fonte | Padrão |
|---|---|---|
| Trava por RLS | `20260731110000_rbac_viewer_readonly.sql` | policies RESTRICTIVE + função `STABLE SECURITY DEFINER` |
| Guard em RPC | `20260731140000_demo_readonly_rbac.sql` | `IF NOT ... THEN RAISE EXCEPTION ... ERRCODE='42501'` |
| Trigger em auth.users | `protege_conta_demo` (mesma migration) | `BEFORE ... ON auth.users FOR EACH ROW` |
| Backup antes de apagar | `backup_20260727` (varredura lógica) | copiar para schema `backup_*` e conferir contagem |
| Catálogo puro + testes | `src/lib/integracoes-catalogo.ts` | dados declarativos testáveis fora do React |

## Files to Change

| File | Action | Why |
|---|---|---|
| `supabase/migrations/20260801100000_whitelabel_lock.sql` | CREATE | `platform_lock`, `plataforma_bloqueada()`, RESTRICTIVE em todas as tabelas, guards nas RPCs, trigger anti-signup |
| `supabase/migrations/20260801110000_primeiro_usuario_admin.sql` | CREATE | `platform_owner` + trigger que consagra o 1º usuário como administrador |
| `src/hooks/usePlataformaStatus.ts` | CREATE | lê trava + progresso de configuração + se sou o dono |
| `src/components/integracoes/BotaoConcluirConfiguracao.tsx` | CREATE | botão discreto no topbar enquanto a configuração < 100% |
| `src/components/AppLayout.tsx` | UPDATE | montar o botão discreto |
| `src/pages/Index.tsx` | UPDATE | abrir o wizard direto para o dono no primeiro login |
| `src/lib/integracoes-catalogo.ts` | UPDATE | expor `configuracaoCompleta()` para o botão |
| `e2e/design-system.spec.ts` | UPDATE | cobrir botão discreto + wizard automático |
| Base de conhecimento do Lovable | UPDATE | instruções do template para quem remixar |
| `docs/WHITELABEL.md` | CREATE | como entregar, como destravar, o que acontece no remix |

## Tasks

### Fase 0 — Backup e limpeza total (IRREVERSÍVEL)

- **Ação**: copiar `auth.users`, `companies`, `company_members` e as tabelas com dado
  operacional para o schema `backup_pre_whitelabel_20260801`; conferir contagem; então
  `DELETE FROM auth.users` (cascade limpa o resto) e `DELETE FROM public.companies`.
- **Mirror**: o precedente `backup_20260727` (copiar → conferir → apagar).
- **Validate**: `SELECT count(*) FROM auth.users` = 0, `companies` = 0, e o schema de
  backup com as 115/136 linhas.
- **Observação**: o palco da demo (`demo@financeai.app`) também morre aqui. Ele é
  recriável a qualquer momento por `supabase/seed-demo.sql` — e **não deve** ser
  recriado no template, porque o cliente remixado quer o banco limpo.

### Fase 1 — Trava do banco original

- **Ação**:
  1. `platform_lock(id, locked_system_identifier text, motivo text, created_at)` com uma
     única linha gravando `7581440907192989109`.
  2. `plataforma_bloqueada()` `STABLE`: `EXISTS(SELECT 1 FROM platform_lock WHERE
     locked_system_identifier = (SELECT system_identifier::text FROM pg_control_system()))`.
     Sem linha, sem tabela ou cluster diferente → **false** (falha para o lado seguro:
     o remix nunca nasce travado).
  3. Policies `RESTRICTIVE` de INSERT/UPDATE/DELETE em **todas** as tabelas de `public`
     (DO block dinâmico sobre `pg_tables`), com `WITH CHECK (NOT plataforma_bloqueada())`.
  4. Guard `plataforma_bloqueada()` nas RPCs `SECURITY DEFINER` que escrevem
     (elas bypassam RLS): `create_company_for_user`, `aceitar_convite`, `venda_balcao`,
     `fechar_mes`, `registrar_movimento_estoque` e as demais já mapeadas.
  5. Trigger `BEFORE INSERT ON auth.users` → `RAISE EXCEPTION` quando bloqueado:
     **mata o cadastro** no banco original (o GoTrue insere ali).
- **Mirror**: RESTRICTIVE + função STABLE do RBAC de viewer.
- **Validate**: smoke com rollback provando, como `authenticated`: signup barrado,
  INSERT barrado, RPC barrada. E o teste decisivo do remix (abaixo).

### Fase 2 — Prova de que o remix libera sozinho

- **Ação**: simular o cluster diferente sem precisar remixar: dentro de uma transação,
  trocar `locked_system_identifier` para um valor falso, provar que **tudo volta a
  funcionar** (signup + insert + RPC), e dar `ROLLBACK`.
- **Validate**: `RAISE EXCEPTION 'SMOKE_OK ...'` com os dois cenários no mesmo bloco:
  travado = bloqueia, "outro cluster" = libera.
- **Por que importa**: é o único jeito honesto de garantir que o cliente não recebe um
  produto morto. Sem esta prova, o plano é fé.

### Fase 3 — Primeiro usuário = administrador da plataforma

- **Ação**:
  1. `platform_owner(user_id uuid, definido_em timestamptz)` — uma linha, imutável.
  2. Trigger `AFTER INSERT ON auth.users`: se `platform_owner` estiver vazia, grava o
     novo usuário como dono.
  3. `sou_dono_da_plataforma()` para o front.
  4. `useAdminPlataforma` passa a considerar o dono (hoje usa "membro mais antigo").
- **Nota**: `useCompany` já cria "Minha Empresa" com `role='admin'` no primeiro acesso
  (`create_company_for_user`), e o wizard já abre com `onboarding_completed=false` —
  então o fluxo do primeiro login **já existe**; a tarefa é consagrar quem é o dono.
- **Validate**: smoke criando um usuário efêmero e conferindo que ele vira dono; segundo
  usuário não rouba o posto.

### Fase 4 — Botão discreto de "concluir configuração"

- **Ação**: `usePlataformaStatus` calcula o progresso (reusa `carregarConfiguradas` +
  `progressoConfiguracao`); botão pequeno no topbar do `AppLayout`, visível só para
  admin e só enquanto < 100%, levando a `/settings/plataforma`. Sem modal, sem banner,
  sem bloquear nada — apenas um lembrete que sai do caminho.
- **Mirror**: o padrão de badge/pill discreto já usado no topbar (modo demonstração).
- **Validate**: E2E — aparece com configuração incompleta, some quando completa.

### Fase 4.1 — Correções visuais pedidas (JÁ EXECUTADAS)

Duas correções de baixo risco entraram fora da fila destrutiva, porque atrapalhavam o uso:

1. **Dropdown do seletor de perfil "transparente"** — não era transparência: `.via-sidebar > *`
   dá `z-index: 1` a todos os filhos diretos do aside, criando contextos de empilhamento
   irmãos; a `<nav>`, por vir depois no DOM, cobria o menu aberto e os textos se
   misturavam. Corrigido elevando o contexto do seletor (`.via-persona-wrapper`,
   `z-index: 40`, declarado depois da regra `> *`). **É a mesma armadilha** que tinha
   derrubado a altura da navegação com a alça de resize.
2. **Cards de Configurações desalinhados** — a grade era `sm:grid-cols-2` com `max-w-2xl`
   e o `<Link>` não esticava, então descrições de tamanhos diferentes geravam alturas
   diferentes. Agora é **grade de 3** (`lg:grid-cols-3`), sem o `max-w` que espremia, com
   `h-full` + `flex flex-col` no card: todos os cards da linha têm a mesma altura.

E2E novo trava as duas regressões (z-index do seletor e igualdade de altura dos cards).

### Fase 5 — Base de conhecimento + documentação

- **Ação**: gravar na base de conhecimento do Lovable (hoje **vazia**) o contrato do
  template: o que é, que o banco de origem é somente leitura por design, que o remix
  libera sozinho, e o que o agente **não** deve fazer (recriar seed, remover a trava,
  editar migrations de trava). Mais `docs/WHITELABEL.md` com o procedimento de entrega
  e a válvula de destravamento (`DELETE FROM platform_lock`).

## Validation

```bash
npx tsc --noEmit -p tsconfig.app.json
npm run build
npx vitest run
npx playwright test
```

Mais os smokes SQL em produção (com `ROLLBACK`), que são a prova real das fases 1–3.

## Risks

| Risco | Probabilidade | Mitigação |
|---|---|---|
| Perder 115 usuários e 136 empresas para sempre | Alta (é o pedido) | Backup em `backup_pre_whitelabel_20260801` antes; conferência de contagem |
| **O remix nascer travado** (produto morto para o cliente) | Média | Função falha para o lado seguro (sem linha/tabela → liberado) + Fase 2 provando por simulação |
| RESTRICTIVE em 67 tabelas quebrar algo silenciosamente | Média | Só bloqueia escrita e só quando `plataforma_bloqueada()`; no remix é no-op |
| RPC `SECURITY DEFINER` furar a trava (bypassa RLS) | Média | Guard explícito nas RPCs de escrita (lição do hardening da demo) |
| Guilherme não conseguir mais testar o original | Alta | Válvula documentada: `DELETE FROM platform_lock` destrava em 1 comando |
| Trigger em `auth.users` derrubar o login (não só o signup) | Baixa | Trigger só em INSERT; UPDATE (login/last_sign_in) segue livre — mesmo cuidado do `protege_conta_demo` |

## Acceptance

- [ ] Banco zerado: 0 usuários, 0 empresas; backup conferido
- [ ] No banco original: signup, INSERT e RPC de escrita **barrados** para `authenticated`
- [ ] Simulação de outro cluster: **tudo liberado**, provado por smoke com rollback
- [ ] Primeiro usuário vira dono; o segundo não
- [ ] Wizard abre no primeiro login; botão discreto aparece enquanto < 100% e some depois
- [ ] Base de conhecimento do Lovable preenchida + `docs/WHITELABEL.md`
- [ ] tsc, build, vitest e playwright verdes
