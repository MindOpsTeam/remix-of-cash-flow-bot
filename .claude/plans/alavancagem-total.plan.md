# Plan: Alavancagem total — consolidação, contador, Conta Azul, PDV, IA completa, harness Evolution

**Fonte**: pedido do Guilherme 2026-07-30 (noite). Decisões dele que valem como premissa: Publish segue manual (limitação Lovable); WhatsApp segue Evolution (melhorar o harness, não trocar de provedor); Conta Azul entra via MCP (ele fornece a key); benchmark de IA = sidebar do Conta Azul Pro (print: Início, Favoritos, Importações, Frente de caixa, Produtos, Serviços, Compras, Financeiro, Antecipações, Estoque, Relatórios, Integrações).
**Complexidade**: LARGE (6 fases; F1+F2 numa sessão, F3, F4, F5, F6 em sessões próprias).

## Fatos do código que ancoram o plano

| Fato | Onde |
|---|---|
| `v_group_account_totals` (DRE consolidada por group_code, mês, CNPJ) existe, tipada, security_invoker, e NINGUÉM lê | migration `20260709030000:52-70`; types.ts:5125; grep zero em src/ |
| O mapeamento de contas do grupo já tem tela (só escreve, não mostra número) | `src/pages/settings/GroupConsolidation.tsx` |
| Livro razão (partidas dobradas) já existe em tela, SEM exportação | `src/pages/Auditoria.tsx:57-69`; `company_journal_entries` types.ts:1734 |
| Export CSV genérico pronto (BOM, `;`, escape) com só 2 consumidores | `src/lib/csv-export.ts`; Reports.tsx:181; DRE.tsx:177 (PDF) |
| Venda balcão NÃO existe, mas a máquina de estados já prevê `confirmed→delivered` "venda no balcão", e o trigger baixa estoque sozinho nessa transição | `20260728200000_venda_baixa_estoque.sql:120-225` |
| `faturar_pedido` (RPC) já transforma pedido em recebíveis parcelados numa transação | `20260728160000_cliente_360_e_credito.sql:101` |
| `registrar_movimento_estoque` trava linha, custo médio, barra negativo, cria depósito default | `20260728200000:27-118` |
| NFC-e: edge `plugnotas-nfce` + `NfceForm`/`mapNfce` prontos; NFC-e hoje é ilha (não baixa estoque nem lança receita) | `supabase/functions/plugnotas-nfce`; `src/lib/plugnotas.ts:334` |
| `products` tem `barcode`, `sku`, `sell_price`, `track_stock`, `account_id` (conta de receita), `type` (produto/serviço) | types.ts:3243 |
| Antecipações Asaas: tabela + hook + resumo já lidos por /transfers; invisíveis na navegação | `useCompanyAsaasTransfers.ts:26-50`; CompanyTransfers.tsx:34 |
| `user_preferences.prefs` (jsonb): 1 leitor/1 escritor, e o upsert SOBRESCREVE o objeto inteiro — favoritos exigem merge | `settings/Preferences.tsx:77-81` |
| Persona do sidebar em localStorage `cfo:nav-persona` | AppSidebar.tsx:62 |
| Padrão MCP server stdio da casa: `mcp-servers/pluggy` (client.ts auth+request; `server.tool(nome, desc, zodShape, handler)`; ok/fail) | `mcp-servers/pluggy/src/index.ts:16-39` |
| Conta Azul API atual: OAuth2 (client_id/secret → access+refresh, scope fixo Cognito), base `https://api-v2.contaazul.com/v1`, recursos: pessoas, produtos, serviços, vendas, contas a pagar/receber, parcelas, contas financeiras | developers.contaazul.com |
| WhatsAppAgent.tsx chama Evolution do browser com key em texto puro (issue #27); `notify_number` já existe | WhatsAppAgent.tsx:168-256; migration 20260730130000 |

## Padrões a espelhar

| Categoria | Fonte | Padrão |
|---|---|---|
| Lib pura + teste | `src/lib/margin.ts` + `src/test/*` | montagem de DRE consolidada e layouts de export nascem puros |
| RPC transacional SQL | `faturar_pedido` / `registrar_movimento_estoque` | a venda de balcão é UMA função SQL, não N inserts do front |
| Config com segredo por empresa | Focus (`set_focus_token`, Vault, preview mascarado) | credencial Conta Azul e key Evolution no produto |
| Edge com auth manual | `_shared/auth.ts` (`authenticate`/`assertMembership`) | `contaazul-sync`, `evolution-proxy` |
| MCP server | `mcp-servers/pluggy` | `mcp-servers/contaazul` idêntico em estrutura |
| E2E | mocks PostgREST em `e2e/design-system.spec.ts` | PDV, consolidado e contador ganham testes com mock |

---

## FASE 1 — Consolidação total (M)

A view está pronta; falta a tela. Entrega: o grupo enxerga o resultado consolidado POR CONTA, com abertura por CNPJ.

- **T1.1** `src/lib/consolidado.ts` (puro, testado): monta a DRE consolidada a partir de linhas de `v_group_account_totals` — linhas por `group_code` (receita 3.x, custos 4.x, despesas 5.x, totais e margens), colunas = CNPJs + Total, células vazias onde o CNPJ não tem a conta. Meses selecionáveis (mês único e acumulado do ano).
- **T1.2** Página `/consolidado` (grupo Visão, só escopo combinado): tabela matriz conta × CNPJ, toggle mês/acumulado, linha de eliminações intercompany explícita (contagem de `is_intercompany=true` do período, para o usuário ver o que foi eliminado), export CSV e PDF (libs existentes). CTA para `/settings/consolidation` quando houver conta sem `group_code` (mapeamento incompleto = consolidação furada; mostrar o buraco, não esconder).
- **T1.3** `GroupConsolidation.tsx` ganha link de volta "ver consolidado" e contador de contas não mapeadas.

**Validação**: testes de `consolidado.ts` (conta sem grupo, CNPJ sem conta, intercompany fora), E2E mock da matriz, régua intocada (a view já filtra confirmed).

## FASE 2 — Saídas contábeis: Central do Contador (M)

- **T2.1** `src/lib/export-contabil.ts` (puro, testado): geradores de linhas para (a) **Diário de lançamentos** (data, conta código/nome, centro, descrição, D/C, valor, origem) a partir de transactions classificadas; (b) **Razão por conta** (agrupado, saldo corrente); (c) **Partidas dobradas** (company_journal_entries como veio do gatilho); (d) **DRE mensal** e **DRE consolidada** (F1); (e) **Plano de contas**. CSV com o `toCsv` existente; colunas estáveis e documentadas (formato genérico importável por Domínio/Alterdata/Excel — layout proprietário de sistema contábil fica FORA do escopo até um contador pedir um específico).
- **T2.2** Página `/contador` (grupo Contábil): período (mês/intervalo), cartões por artefato com botão de download, e "Pacote do mês" que baixa todos em sequência. Aviso de qualidade antes de exportar: N lançamentos sem conta no período (link pro fechamento).
- **T2.3** Auditoria.tsx ganha botão exportar CSV nas duas abas (3 linhas cada, lib existente).
- **T2.4** Reports.tsx ganha presets simples (mês atual, trimestre, ano) reusando o que a tela já calcula.

**Validação**: testes dos geradores (linha a linha num fixture), E2E mock de `/contador` com download disparado.

## FASE 3 — Conta Azul: MCP + trilho de migração (L)

Suposição declarada: o valor imediato é TRAZER dados de clientes que já vivem no Conta Azul (migração/onboarding) e me dar operação via MCP com a key que o Guilherme vai mandar. Integração self-service dentro do produto exige app OAuth registrado no Conta Azul (redirect_uri) — fica como T3.4 condicionada.

- **T3.1** `mcp-servers/contaazul` no padrão pluggy: `client.ts` com OAuth2 (env `CONTAAZUL_CLIENT_ID/SECRET/REFRESH_TOKEN`; renova access_token sozinho e guarda em memória; base `https://api-v2.contaazul.com/v1`). Tools (~14): `ca_list_pessoas`, `ca_get_pessoa`, `ca_create_pessoa`, `ca_list_produtos`, `ca_list_servicos`, `ca_list_vendas`, `ca_get_venda`, `ca_list_contas_receber`, `ca_list_contas_pagar`, `ca_list_parcelas`, `ca_list_contas_financeiras`, `ca_list_categorias`, `ca_api` (escape hatch GET/POST genérico), `ca_status`. Registrado no Claude Code user scope; quando a key chegar, gravo em `~/.claude/secrets.md` (seção Conta Azul) e ligo no MCP.
- **T3.2** `src/lib/contaazul-map.ts` (puro, testado): mapeadores Conta Azul → FinanceAI: pessoas→contacts, produtos/serviços→products (type), contas a receber→receivables (source `contaazul`, dedupe por id externo), contas a pagar→bills_payable, vendas→sales_orders históricos. Regras de dedupe e de status documentadas no arquivo.
- **T3.3** Edge `contaazul-import` + tela `/settings/integrations/contaazul`: credenciais no Vault (padrão `set_focus_token`), botão "importar cadastros" (pessoas+produtos) e "importar financeiro em aberto" (a receber/a pagar), com relatório do que entrou/pulou. Import escreve SEMPRE via mapeadores de T3.2; nada entra confirmado no DRE sem classificação (recebível/conta a pagar não tocam a régua).
- **T3.4** (condicionada ao app OAuth) Fluxo de autorização self-service no produto.

**Validação**: unit dos mapeadores; MCP smoke com a key real quando chegar (list pessoas/produtos); import E2E num tenant de teste com fixtures.

## FASE 4 — Frente de caixa / PDV (L)

- **T4.1** RPC SQL `venda_balcao(p_company_id, p_itens jsonb, p_forma_pagamento, p_desconto, p_contact_id?)` (eu escrevo; padrão `faturar_pedido`): numa transação cria `sales_orders` já em `delivered` (o trigger existente baixa o estoque sozinho), `sales_order_items`, `receivables` com status `recebido` (pago na hora) e a `transaction` revenue `confirmed` classificada pela conta do produto (`products.account_id`, fallback conta padrão de vendas). Devolve `{order_id, total, transaction_id}`. Estoque insuficiente = erro claro da RPC existente (não vende o que não tem).
- **T4.2** Página `/pdv`: modo caixa (layout limpo, fonte grande): busca por nome/SKU/**barcode** (input com foco permanente = leitor de código de barras funciona de fábrica), grid de toque, carrinho com quantidade/desconto, formas de pagamento (mesma lista da NFC-e: dinheiro, cartão, PIX), atalhos de teclado (F2 busca, F4 pagamento, Enter confirma). Fecha a venda pela RPC.
- **T4.3** NFC-e opcional pós-venda: se `enabled_nfce`, botão "emitir NFC-e" no recibo reusa `mapNfce` com os itens do pedido (fecha a ilha: PDV → estoque + receita + nota).
- **T4.4** Recibo simples imprimível (print CSS, padrão da casa: window.print, nunca html2canvas).

**Validação**: teste da RPC via SQL em tenant temporário (venda baixa estoque + receita confirmada + recebível recebido; cancelamento devolve), E2E mock do fluxo carrinho→finalizar, mobile/tablet sem overflow.

## FASE 5 — Revisão completa da IA vs Conta Azul (M)

Gap analysis do print, item a item:

| Conta Azul | FinanceAI hoje | Ação |
|---|---|---|
| Início | /dashboard | ok |
| **Favoritos** | não existe | pin por usuário no topo do sidebar; `user_preferences.prefs.favoritos` com **merge fix** (T5.1) |
| **Importações** | espalhado (bank-inbox, colar, OCR, Conta Azul) | grupo/hub "Importações" no sidebar reunindo os 4 (T5.2) |
| **Frente de caixa** | não existe | F4, entra no sidebar em Operação |
| Produtos | /products | ok |
| **Serviços** | products.type já suporta | visão própria "Serviços" (rota /services = Products filtrado por type, com copy própria) (T5.3) |
| Compras | /purchases | + card "Compra automatizada (OpenClaw)" linkando o app OpenClaw Compras em produção; doc de integração futura via public-api (T5.4) |
| Financeiro | ok (transactions/receivables/bills) | ok |
| **Antecipações** | dados prontos, enterrados em /transfers | subitem "Antecipações" no sidebar → aba dedicada em /transfers (T5.5) |
| Estoque | /stock | + gestão de depósitos (warehouses sem tela): CRUD leve dentro de /stock (T5.6) |
| Relatórios | /reports | presets da F2 |
| Integrações | /settings/integrations | + card Conta Azul (F3) |

- **T5.1** Corrigir o upsert de `prefs` para merge (ler antes de gravar num helper `usePrefs` único) e migrar a persona do sidebar do localStorage para lá. Favoritos: estrela em cada item do sidebar, seção "Favoritos" no topo.
- **T5.7** Sidebar reorganizada com os itens novos, personas revisadas, e a mesma fonte única `sections`.

**Validação**: E2E das rotas novas nas 52+ protegidas, favoritos persistem entre reloads (mock), mobile.

## FASE 6 — Harness Evolution/WhatsApp (M, issue #27)

- **T6.1** Edge `evolution-proxy`: TODAS as chamadas Evolution do front passam a ir por ela (JWT + membership; lê url/key de `whatsapp_configs` server-side). `WhatsAppAgent.tsx` para de montar headers com a key; a key sai do payload de leitura da tela (mascarar no select).
- **T6.2** Robustez de envio dos agentes: retry com backoff (2 tentativas) no `despachar` do agent-runner e no smart-alerts; falha de envio vira notificação in-app "WhatsApp falhou, reconecte" com link.
- **T6.3** Card de saúde da conexão em /whatsapp: estado da instância, último envio ok, botão reconectar (QR) — tudo via proxy.

**Validação**: grep zero de `evolution_api_key` no bundle final; teste manual de envio contra a instância ativa.

## Riscos

| Risco | Prob. | Mitigação |
|---|---|---|
| Consolidação furada por mapeamento incompleto de group_code | Alta | a tela MOSTRA contas não mapeadas e o quanto ficou de fora; nunca soma silenciosamente errado |
| Conta Azul: OAuth exige app registrado p/ self-service | Certa | MCP + import assistido primeiro (T3.1-T3.3 com a key dele); self-service condicionado (T3.4) |
| Key do Conta Azul ainda não chegou | Certa | MCP nasce pronto com env vars; smoke na hora que a key cair no secrets.md |
| PDV sem NFC-e configurada | Média | venda registra normal (estoque+receita); nota é opcional e o botão explica o pré-requisito |
| Venda balcão × régua do DRE | Média | receita entra `confirmed` JÁ classificada pela conta do produto; RPC única, testada em tenant temporário |
| prefs sobrescrito (favoritos apagando config) | Alta | helper único de merge ANTES de qualquer escritor novo |
| Evolution instável | Alta | proxy + retry + falha visível; decisão dele: continua Evolution |
| Publish manual | Certa | cada fase termina com commit na main + lembrete |

## Validação global

```bash
npm run test && npm run build && npx playwright test && npx eslint <arquivos novos>
```

## Estimativa

| Fase | Tamanho | Sessões |
|---|---|---|
| F1 Consolidação | M | 0,5 |
| F2 Central do Contador | M | 0,5 |
| F3 Conta Azul (MCP + import) | L | 1-1,5 |
| F4 PDV | L | 1 |
| F5 IA completa + favoritos | M | 1 |
| F6 Harness Evolution | M | 0,5 |

## Aceite

- [ ] DRE consolidada do grupo visível, com eliminações e buracos de mapeamento explícitos
- [ ] Contador baixa diário, razão, partidas, DRE e plano de contas por período sem pedir nada a ninguém
- [ ] MCP contaazul respondendo com a key real; import de cadastros e financeiro em aberto funcionando
- [ ] Venda de balcão em 3 toques baixa estoque, lança receita confirmada e (opcional) emite NFC-e
- [ ] Sidebar cobre 12/12 itens do benchmark com Favoritos e Importações
- [ ] Zero `evolution_api_key` no browser; envio com retry e falha visível
