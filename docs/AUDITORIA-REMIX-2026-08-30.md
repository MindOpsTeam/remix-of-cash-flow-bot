# Auditoria: o remix nasce livre, e a reversão não deixou dívida — 30/08/2026

Duas perguntas, respondidas com medição e não com leitura de código:

1. As travas do projeto original **somem** no remix?
2. A remoção do módulo STAY deixou o projeto **íntegro**?

Ambiente: Lovable `c5ba5dcd-8f5b-46fe-a1fc-fd596c11b334` (`biz-whisper-fin`),
Supabase `oxymhnddzamsjxwfglud`. Remix descartável usado no teste:
`91d1149a-3308-4758-88b3-6db8fc300b1d`, workspace "Viver de IA - Remixes".

---

## 1. O remix nasce livre — medido

Remix real, criado com **`include_custom_knowledge` ligado** (que é o que o modal
do produto instrui o cliente a fazer). Consultado o banco do remix:

| Sinal | Resultado | Significa |
|---|---|---|
| `plataforma_bloqueada()` | **false** | nenhuma trava vale |
| `platform_lock` | **0 linhas** | a linha da trava não veio |
| `cadastro_esta_aberto()` | true | o cliente cria a conta dele |
| `platform_owner` | 0 | a primeira conta vira administradora |
| objetos `stay_*` | **0** | o módulo alheio não viajou |
| `cron.job` | 0 | esperado: `bootstrap_instalacao` cria no primeiro login |

### O susto que a medição desfez

`20260801100000_whitelabel_lock.sql` faz

```sql
INSERT INTO public.platform_lock (..., (SELECT system_identifier::text FROM pg_control_system()), ...)
ON CONFLICT (id) DO UPDATE ...
```

Se o remix **replayasse migrations**, esse INSERT rodaria no cluster NOVO,
gravaria o identificador dele mesmo, e `plataforma_bloqueada()` compararia o
cluster atual com ele próprio: **todo remix nasceria travado**, com o cliente sem
conseguir nem criar conta.

Não acontece: **o Lovable clona o schema, não replaya migrations**. A tabela veio
com estrutura e sem linhas. Vale registrar porque o mecanismo inteiro depende
dessa propriedade da plataforma, não de uma escolha nossa — se um dia o remix
passar a replayar, a trava se inverte e trava o cliente em vez do original.
O `platform_lock` vazio é o que faz a função falhar para o lado seguro.

### O que VIAJA e é aceitável

`AGENTS.md`, `LEIA-ANTES-DE-EDITAR.md` e o bloco do `README.md` são arquivos de
código: viajam. Cada um abre com a condição (`plataforma_bloqueada()`) e manda
apagar a si mesmo quando ela for falsa. São endereçados ao humano que abre o
repositório, e o cliente pode deletá-los.

### O portão saiu da base de conhecimento

A base de conhecimento **viaja com o "Include custom knowledge"**, confirmado no
remix. Ela carregava um portão que começava com "PARE. NÃO EDITE AQUI" como a
primeira coisa que o agente lê.

Ele foi removido. A conta é simples:

- **Benefício medido: zero.** Três testes no original (29–30/08): o agente editou
  em todos, sem nunca rodar `SELECT plataforma_bloqueada()`.
- **Risco: real.** Se o agente do cliente ler a recusa e não rodar a verificação,
  ele se recusa a trabalhar num projeto que é do cliente.
- **Prova de inocuidade: impossível hoje.** O agente do remix não pôde ser testado
  porque a fila nasce pausada em `hitl_tool`, esperando confirmação de secrets.

Zero benefício + risco não descartável + atinge todo cliente = sai. Ficou no
lugar um parágrafo curto e condicional, e a documentação de produto, que é útil
no remix. O aviso forte continua onde é seguro: nos `.md` (descartáveis) e no
popup (condicionado ao banco, com teste que falha se ele aparecer com a trava
desligada).

---

## 2. A reversão do STAY não deixou dívida

### Repositório

- `npx vitest run` — **563 testes, 40 arquivos, verdes**
- `npx tsc -b` — limpo
- `npx vite build` — verde
- `npm run check:edge` — todas as edge functions bootam
- Zero referência órfã a `useStay`, `stay-metrics`, `pages/stay`, `stay-mark`,
  `stay-logo` ou rota `/hospedagem`
- Nenhuma migration sobrevivente cita `stay` (só um comentário histórico)
- Todo asset referenciado existe em disco

### Banco

| Verificação | Resultado |
|---|---|
| Objetos `stay_*` | 0 |
| Funções citando `stay_` | 0 |
| Tabelas sem RLS | **0** (83 tabelas, 100% com RLS) |
| Cobertura da trava de template | **79 de 79** (as 4 de fora são as excluídas por projeto) |
| `plataforma_bloqueada()` no original | true |

### Por que a remoção não quebrou a trava de whitelabel

`aplicar_trava_de_template()` **itera `pg_class`** e pula uma lista fixa de quatro
tabelas. Ela não nomeia tabela nenhuma, então apagar sete não a afeta: na próxima
execução ela simplesmente encontra sete a menos. Se a função tivesse a lista
gravada, o replay quebraria — é a diferença entre uma trava repetível e um
comando solto.

### Funcional, não só compilando

A demonstração guiada foi acionada de dentro do popup e entrou de verdade:
Painel Consolidado do grupo Aurora, 3 CNPJs, receita e margem calculadas, tour no
passo 1. O caminho que o cliente percorre está inteiro.

---

## Pendência

O remix de teste `91d1149a-3308-4758-88b3-6db8fc300b1d` ("TESTE trava remix 30-08
(descartar)") **precisa ser apagado à mão**: o conector oficial do Lovable não
expõe deleção de projeto, e o conector legado responde 403 por ser de outra conta.
