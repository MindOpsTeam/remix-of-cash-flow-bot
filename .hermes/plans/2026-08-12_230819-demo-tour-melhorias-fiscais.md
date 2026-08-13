# Plano — Onboarding do modo demonstração: mostrar as melhorias fiscais em passos

## Goal

Atualizar **apenas o tour do modo demonstração** (a esteira de passos que o usuário
`demo@financeai.app` vê) para apresentar, em passos de onboarding, todas as melhorias
fiscais construídas nesta rodada (emissão robusta, cancelamento, nota→recebível com
prazo/conta/líquido/parcelas, notas de entrada + duplicatas + MDe, conciliação com
baixa parcial, cofre do certificado). Nada além do conteúdo do tour muda.

## Contexto atual (confirmado no código, read-only)

- O tour é renderizado por `src/components/DemoTour.tsx`, que lê os passos de
  `PASSOS_DO_TOUR` em **`src/lib/demo.ts`**. Cada passo é `{ rota, titulo, texto }`.
- O tour **só monta para o usuário demo**: `src/components/AppLayout.tsx` faz
  `const ehDemo = isDemoUser(user?.email)` e renderiza `{ehDemo ? <DemoTour/> : <CFOChatWidget/>}`.
  Logo, editar o array de passos **não** afeta remixes nem a decisão de "demo não
  aparecer no remix".
- O "mock" do demo é o **seed do banco** (grupo Aurora, `supabase/seed-demo.sql`),
  usuário **viewer** em 3 CNPJs (read-only garantido por RLS). `src/lib/mock-data.ts`
  existe mas **não é importado por ninguém** — é código morto; não usar.
- Rotas fiscais existentes (destino dos passos):
  `/fiscal`, `/fiscal/nfse/emit`, `/fiscal/contas-a-pagar`, `/fiscal/impostos`,
  `/fiscal/arquivos`, `/documents` (leitor/OCR), `/bank-inbox` (conciliação),
  `/settings/integrations/nfse` (wizard/cofre do cert), `/consolidado`, `/recorrencia`.

## Suposição declarada

"Modo demonstração (mock)" = o tour guiado do usuário demo (`PASSOS_DO_TOUR`). A
entrega é atualizar **os passos**; a config que esconde o demo no remix (gating em
`AppLayout`, `isDemoUser`, seed/RLS, migration `demonstracao_so_no_original`) **não é
tocada**.

## Escopo — o que NÃO muda (trava de segurança do pedido)

- `isDemoUser`, `DEMO_EMAIL`, `DEMO_PASSWORD`, chaves de sessionStorage.
- Gating `ehDemo` em `AppLayout.tsx` e o render condicional do tour.
- `supabase/seed-demo.sql` e as políticas RLS/migração que restringem o demo ao
  projeto original (a menos que se opte pelo item OPCIONAL abaixo, que é demo-scoped).
- Qualquer código fora do tour (nenhuma tela, edge, migration de produto).

## Abordagem

Reescrever **somente** o array `PASSOS_DO_TOUR` (e o comentário acima dele) em
`src/lib/demo.ts`, passando de 5 para ~9 passos, com um **arco fiscal** no meio que
encadeia as melhorias numa narrativa "sente na pele → converte". Cada passo aponta
para uma rota que já renderiza de forma coerente para um viewer (hub/listas/forms),
e o texto descreve a capacidade nova. O último passo continua sendo o CTA de conversão.

O usuário pediu explicitamente "todas essas melhorias" em passos — isso sobrepõe o
comentário atual ("5 passos, mais que isso vira aula"). Mantém-se o texto enxuto (1–2
frases por passo) para não virar aula.

## Passo a passo (conteúdo proposto para `PASSOS_DO_TOUR`)

Ordem e cópia propostas (ajustável na revisão):

1. **`/dashboard` — "O cockpit do seu dinheiro"** _(mantém)_
   Receita, margem, caixa e metas dos últimos 12 meses. É o grupo Aurora, fictício, 3 CNPJs.
2. **`/bank-inbox` — "O extrato chega sozinho"** _(mantém, cópia levemente ampliada)_
   O banco sincroniza e a IA classifica; um clique vira caixa contabilizado.
3. **`/fiscal/nfse/emit` — "Emita NFS-e Nacional de verdade"**
   Emissão pelo Ambiente Nacional com o seu certificado A1. Com trava anti-duplicidade
   (claim-first): timeout ou clique dobrado nunca transmitem a mesma nota duas vezes.
4. **`/fiscal` — "A nota vira dinheiro sozinha"**
   Nota autorizada abre a conta a receber já com vencimento (não nasce vencida), conta
   contábil certa, valor **líquido** de retenções e **parcelada** pelas duplicatas do XML.
5. **`/fiscal/contas-a-pagar` — "As compras entram sem digitar"**
   Nota de entrada (XML ou foto no OCR) vira N contas a pagar nas datas reais das
   duplicatas; a Ciência da Operação (MDe) é registrada com prazo.
6. **`/bank-inbox` — "Baixa parcial e o contábil fecha"**
   O crédito/débito real do extrato baixa o título — inteiro ou em parte, deixando saldo —
   e a receita/despesa cai na conta certa do DRE.
7. **`/fiscal/impostos` — "Cancelou? Estorna sozinho"**
   Cancelar a nota registra o evento no SEFIN e estorna o recebível em aberto — sem
   número fantasma inflando o vencido.
8. **`/settings/integrations/nfse` — "Seu certificado, blindado"**
   O A1 e a senha ficam só no servidor; nem o time que usa o sistema lê pelo navegador.
9. **`/dashboard` — "Pronto para o seu CNPJ?"** _(mantém — CTA de conversão)_
   Isso foi a Aurora. Crie sua conta e o assistente de instalação te leva ao primeiro fechamento.

> Observação de cópia: manter o tom "firme no conteúdo, leve no tom" (memória do
> Guilherme); sem travessões (usar vírgula/dois-pontos).

## Arquivos que provavelmente mudam

- `src/lib/demo.ts` — **único arquivo obrigatório** (array `PASSOS_DO_TOUR` + comentário).
- (Opcional, demo-scoped) `supabase/seed-demo.sql` — ver item abaixo.

## OPCIONAL (decisão do Guilherme) — enriquecer o seed do demo

Alguns passos apontam para telas que, no seed atual do demo, podem aparecer **vazias**
(ex.: `/fiscal/nfse/emit` sem `nfse_config`, `/fiscal/contas-a-pagar` sem notas de
entrada). Duas opções:

- **A (recomendada, menor toque):** manter só a edição do array; escolher rotas que
  renderizam bem para viewer (hub `/fiscal`, listas, wizard) e descrever a capacidade
  no texto. Não altera seed.
- **B (mais imersivo):** adicionar ao `seed-demo.sql` (ainda dentro do demo, não afeta
  remix): 1 nota autorizada com 2 duplicatas → 2 parcelas a receber; 1 nota de entrada
  → 2 contas a pagar; 1 nota cancelada com recebível estornado; 1 recebível com baixa
  parcial. Faz as telas mostrarem as melhorias de fato.

Como o pedido foi "não mude nada" além do onboarding, o plano assume **A** por padrão;
**B** só se o Guilherme quiser as telas populadas.

## Testes / validação

1. **Build/tipos:** o array é tipado por `PassoDoTour`; garantir `rota` válida (existe no
   `App.tsx`) e sem campo extra. `tsc`/build do Lovable deve passar.
2. **Rotas:** conferir no `App.tsx` que cada `rota` do passo existe (todas listadas acima
   já existem) e não cai em `NotFound`.
3. **Manual (preview do demo):** logar como `demo@financeai.app`, percorrer os 9 passos
   com "Continuar", confirmar que cada rota carrega para viewer sem erro, que
   "Anterior" volta, que o `sessionStorage` preserva a posição em reload e que o último
   passo mostra "Criar minha conta grátis".
4. **Remix intacto:** confirmar que num contexto não-demo o `DemoTour` não monta (gating
   `ehDemo` inalterado) — nada a mudar, só verificar que não foi tocado.

## Riscos e tradeoffs

- **Passo caindo em tela vazia** (viewer sem dados fiscais no seed): mitigado pela opção
  A (rotas de hub/lista/form) ou resolvido pela opção B (seed). Validar no preview.
- **Tour mais longo** (5 → 9): contraria o comentário original; é o pedido explícito.
  Mitigar com cópia curta; ordem coloca o CTA por último para não perder conversão.
- **Rota de "notas de entrada":** confirmar se a UI de notas recebidas/`ImportarNotaXml`
  vive em `/fiscal` ou `/fiscal/contas-a-pagar` e apontar o passo 5 para a correta.

## Fluxo de entrega (git-first, quando aprovado)

1. Editar `src/lib/demo.ts` localmente.
2. Commit + push no `main` de `MindOpsTeam/remix-of-cash-flow-bot`.
3. Sem migration e sem edge (mudança é só de front); o Lovable reconstrói o preview ao
   sincronizar. Verificar no preview do demo.

## Open questions

- Opção **A** (só o array) ou **B** (array + seed populado)? Default assumido: **A**.
- Confirmar a rota exata da tela de **notas de entrada** para o passo 5.
