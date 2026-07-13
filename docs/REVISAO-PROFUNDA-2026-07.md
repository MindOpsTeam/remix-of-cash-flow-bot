# Revisão profunda do FinanceAI — descoberta ponta a ponta (2026-07-13)

Leitura do projeto inteiro por 10 agentes descobridores (7 fatias de código + 2 sínteses +
1 crítico adversarial): **88 páginas/tabelas mapeadas, 1,4M tokens de análise**, cruzando
o que o produto *consegue* fazer com o que *apresenta* ao usuário. Fonte da verdade factual,
não impressão de superfície.

## Diagnóstico em uma frase

**O backend é um ERP financeiro sério (31 edge functions, BI de margem multi-CNPJ, fiscal
com Reforma, IA com humano no loop, Open Finance); a apresentação sabota a confiança nesse
poder** — telas que prometem o que o backend não faz, números que divergem entre telas sem
rótulo, e entulho do pivô PF→PJ ocupando espaço nobre.

## Parte 1 — Integridade dos dados (a preocupação nº1: o DRE)

`public.transactions` é o **ledger único** (45 acessos). TODO número de DRE/margem/relatório/
forecast/fechamento deriva dele. A régua receita/custo/despesa vive **espelhada em dois
lugares**: SQL (views `v_company_margin`/`_full`, migração 20260709030000) e JavaScript
(`DRE.tsx` l.76-84, `margin.ts`). Mudar um sem o outro = painel e DRE divergem. **É o ponto
mais frágil do sistema.**

### 10 invariantes que NENHUMA refatoração pode quebrar
1. RECEITA é dirigida pelo **type**: `sum(amount) WHERE type='revenue'`. O code 3.x é só rótulo.
2. CUSTOS (CMV) = `type='expense' AND left(coalesce(coa.code,''),1)='4'`. Vive em SQL **e** em DRE.tsx — mudam juntas.
3. DESPESAS = `type='expense' AND left(code,1)<>'4'`. Conta com code NULL cai **sempre** em despesas.
4. Só `status='confirmed'` entra em qualquer número. pending/reconciled não contam.
5. `v_company_margin` (painel) exclui `is_intercompany=true`; `v_company_margin_full` (DRE/Budget) inclui. Diferença intencional — não igualar sem rotular a UI.
6. Fórmulas: margemBruta=(receita−custos)/receita; margemOperacional=(receita−custos−despesas)/receita; 0 quando receita≤0. Concentradas em `margin.ts`.
7. Período = `date_trunc('month', transactions.date)`.
8. Todo dinheiro aterrissa em `transactions` com o type correto — nenhuma navegação pode desviar escrita para outra tabela e esperar aparecer no DRE.
9. A classificação contábil (account_id + code/type) define a linha do DRE. Editar/mover (TransactionEditForm, ai-classify no /close) altera o DRE.
10. As 6 origens de escrita (manual, owner_transfer, inter, webhook, scanner, whatsapp) convergem para o MESMO contrato de colunas.

### As 3 fraturas que corroem os números (em ordem de gravidade)
1. **Escopo de escrita silencioso** (achado da crítica, o mais grave): no escopo "combinado"
   (default), `company = companies[0]`. Todo lançamento manual cai no **primeiro CNPJ** sem
   aviso — num cliente de 6 CNPJs, corrompe a margem por empresa, que é o pitch do produto.
   → **CORRIGIDO nesta rodada** (seletor de CNPJ-alvo obrigatório no TransactionForm quando
   escopo=combinado). Falta estender a OwnerTransactions e DocumentScanner.
2. **owner_transfer e inter entram sem conta contábil**: somem das *linhas* do DRE mas
   **inflam** o gráfico de 6 meses e a margem (que somam por type). Pior: retirada de sócio
   conta como *despesa*, aporte como *receita* — contabilmente errado. ⚠️ **NÃO** classificar
   com account_id (jogaria retirada em DESPESAS). O certo é **excluí-las da margem por source**,
   editando a régua nos **dois** lugares (SQL + DRE.tsx) juntos + gráfico + ai-forecast/summary,
   com teste de reconciliação painel×DRE. → **STAGED** (toca invariante em 2 linguagens; risco alto).
3. **Open Finance morre no staging**: `bank_transactions_raw` nunca é promovido a `transactions`.
   A badge "X aguardando revisão" leva a `/transactions`, que não lê o staging — beco sem saída.
   O backend de import já existe (`openfinance-sync` action=import); falta a **tela de revisão**.
   → **STAGED** (alto valor, aditivo, sem tocar régua).

## Parte 2 — Curadoria (o que apresentar)

### CORTADO nesta rodada (falso ou morto)
- Card "Lançamento Automático" do WhatsApp (o webhook nunca cria lançamento) → reescrito para a verdade (aprovação de ações no grupo).
- Botão "Exportar CSV" morto em Fiscal (sem handler) → removido.
- Link "Esqueceu a senha?" (`href="#"`, sem fluxo) → removido.
- Texto falso de dupla-entrada em OwnerTransactions ("cria na conta pessoal E na empresa") → reescrito para a verdade (só o lado PJ).
- Componentes mortos no bundle: `FinancialScore.tsx`, `AIInsightCard.tsx` → deletados.
- Bug de token (publishable key como Bearer → 401) em **CFO Digital, dica de IA do dashboard e OCR de documentos** → corrigido (helper `lib/edge.ts` com session.access_token). *A "tela principal" da Inteligência volta a funcionar.*

### A CORTAR (próxima rodada de curadoria)
- Bloco "MCP Server / claude_desktop_config" na config de NFS-e (ruído de dev).
- Tab CT-e no PlugnotasEmit (PlugNotas não tem `/cte`).
- Tela Preferences inteira (100% localStorage, vaza entre empresas).
- Typos "Emissao"/"Receita" nos cards de Integrations.

### A PROMOVER (poder escondido)
- **BI de margem consolidada × individual multi-CNPJ** (o pitch) — deve ser a home indiscutível.
- **DocumentScanner/OCR** — orquestra 5 tabelas; hoje escondido como "Scanner OCR".
- **DRE consolidada do grupo** — `v_group_account_totals` + group_code existem no backend; **nenhuma tela consome** (o diferencial multi-tenant não foi construído na UI).
- **Aprovação por alçada** em Contas a Pagar — governança real, invisível.
- **Reforma (CBS/IBS por nota)** — dado em `plugnotas_documents`, sem tela de conformidade.

### A CONSOLIDAR (duplicado)
- `/inter` e a aba Inter de `/transfers` (mesmo hook) → fonte única.
- CFO Digital + Simulador + CFOChatWidget (mesma edge, só muda o prompt) → uma superfície com modos.
- Régua de classificação em SQL **e** JS → DRE deve consumir `v_company_margin_full` (preserva o comportamento sem filtro de intercompany), removendo a régua JS.
- Base de "realizado" do orçamento: Budget usa `_full` (com intercompany), GroupApArCard usa a sem — rotular a base.
- 3 parses monetários diferentes → um utilitário pt-BR único.
- Duas telas "Contas a Pagar" (BillsPayable viva × CompanyBills morta) → um modelo só.

## Parte 3 — Personas (o que cada nível precisa)

| | Estratégico (dono/CFO) | Tático (controller) | Operacional (lançador) |
|---|---|---|---|
| **Tela inicial ideal** | Painel de margem consolidada × CNPJ + seletor de período | Central de Gestão/Fechamento (checklist + atalhos) | Fluxo de caixa unificado com fila "A revisar" no topo |
| **Precisa ver** | margem grupo × individual; ranking de CNPJs; tendência 6-12m; caixa projetado confiável; conta-corrente do sócio; Reforma | DRE por empresa e **consolidada do grupo**; AP por alçada; orçado×realizado; calendário fiscal; fila dos agentes | caixa de todas as origens com status claro; fila de staging OF + sem-conta; OCR; cadastros |
| **Deseja (dados)** | margem por empresa e consolidada; receita **incluindo vendas**; caixa com previstos; saldo PJ↔PF; impostos no horizonte | DRE por conta com custo/despesa coerente; AP/AR do grupo; desvio numa base única; guias ligadas às notas | transações por source e status; extrato bruto OF; contatos/produtos fiscais; estoque |
| **Precisa (funções)** | seletor de período no painel; drill-down; simulador determinístico; exportar visão executiva | fechar e **travar** o mês; aprovar por alçada; classificar em lote por IA; consolidar plano de contas | lançar multicanal; **revisar/promover staging OF**; editar com trava por origem; conciliar; criar previsto |

## Parte 4 — Roadmap priorizado (crítica adversarial aplicada)

Legenda: impacto/esforço/risco. ✅=feito nesta rodada · ▶=staged (próximo).

| # | Ação | I/E/R | Status |
|---|---|---|---|
| 1 | Fix token CFO Digital/OCR (session.access_token) | A/B/B | ✅ |
| 2 | Cortar falso/morto (WhatsApp, CSV, senha, componentes, texto sócio) | M/B/B | ✅ |
| 3 | **Guard de escopo de escrita** (CNPJ-alvo explícito) | A/B/B | ✅ (TransactionForm; estender a Owner/Scanner ▶) |
| 4 | Tela de revisão/conciliação do Open Finance (staging→ledger) | A/M/M | ▶ |
| 5 | owner_transfer/inter **neutros na margem** (excluir por source, SQL+JS juntos + teste reconciliação) | A/A/**A** | ▶ |
| 6 | De-dup da régua: DRE consome `v_company_margin_full`, some a régua JS | A/M/M | ▶ |
| 7 | Dupla-entrada sócio PJ↔PF real (ou remover campos vestigiais) + travar edição de source inter/owner | A/M/A | ▶ |
| 8 | Seletor de período/escopo (URL state) no Painel/DRE/Reports + rótulo da base | A/M/B | ▶ |
| 9 | **DRE consolidada do grupo** consumindo `v_group_account_totals` | A/M/B | ▶ |
| 10 | RBAC real por `company_members.role` + fluxo de convite funcional | A/A/M | ▶ |
| 11 | Lançamento previsto/pendente (read-path separado; NÃO relaxar o filtro confirmed) | A/M/B | ▶ |
| 12 | Travar período no fechamento (guarda no banco, não só marcador) — antes de vender "mês auditável" | A/M/M | ▶ |
| 13 | Saneamento de schema: drop `personal_*`/`asaas_*` legado **dropando triggers ANTES** (sequência atômica; risco CRÍTICO se fora de ordem) | M/M/**A** | ▶ |
| 14 | Fechar loops: venda→receita/nota, compra→estoque | A/A/M | ▶ |
| 15 | Tela dedicada da Reforma (CBS/IBS por nota) | M/B/B | ▶ |

### Avisos de risco de dados (não ignorar ao executar o staged)
- **Item 5**: excluir por source exige editar SQL (views) **e** DRE.tsx **juntos**; mexer em um lado sem o outro faz painel≠DRE.
- **Item 13**: `trg_auto_journal_pj` é AFTER INSERT em `transactions` e escreve em `company_journal_entries`; dropar a tabela sem dropar o trigger antes faz **todo INSERT em transactions estourar** → ledger para. Sequência: (1) drop trigger, (2) validar dependências, (3) drop tabela.
- **Item 6**: apontar a DRE para `v_company_margin` (sem intercompany) muda valores; só `_full` preserva o comportamento atual.
- **Item 11**: pending cai num estado que nenhuma view lê — precisa de read-path novo, não de "destravar campo"; garantir que confirmed continua isolado.

> Os itens ▶ que tocam a régua do DRE (5, 6, 13) são deliberadamente deixados para execução
> supervisionada — são exatamente o "muito cuidado com a concatenação das tabelas" pedido pelo dono.
