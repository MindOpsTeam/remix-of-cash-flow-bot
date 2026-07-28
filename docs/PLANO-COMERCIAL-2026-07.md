# Plano: a parte comercial do FinanceAI

Você está certo. O produto virou um sistema contábil-financeiro forte com um cadastro comercial pendurado do lado. Abaixo está o retrato medido e o plano para transformar isso.

---

## O diagnóstico, com número

O pedido de venda é **uma ilha completa**. Ele não vira nota, não vira recebível, não move estoque e não entra no DRE.

- `SalesOrders.tsx:366` manda para `/nfse/emit?sales_order_id=...`, e **`NfseEmit.tsx:70` descarta esse parâmetro**. Por isso `invoices.sales_order_id` é sempre nulo.
- Não existe `receivables.sales_order_id` nem `receivables.invoice_id`. Vender não gera dinheiro a receber.
- Não existe `invoice_items`. A nota não sabe o que foi vendido.
- Confirmar pedido não baixa estoque. `current_stock` só muda por lançamento manual em `Stock.tsx:112`.

Em produção: **4 pedidos de venda, 0 recebíveis**.

**O produto não se classifica nem se emite.** Dos 22 produtos cadastrados:

| Furo | Quantos | Consequência |
|---|---|---|
| sem `account_id` | **22 de 22** | a coluna existe e a tela nunca expõe. A venda nasce sem conta contábil, o que alimenta os 32% de lançamentos que somem do DRE |
| sem `cclasstrib` | **22 de 22** | depois de **03/08/2026** nenhum deles pode ser emitido com o grupo IBS/CBS obrigatório |
| sem NCM | 19 de 22 | mesma coisa, para mercadoria |
| sem custo | 16 de 22 | margem por produto e por pedido é impossível de calcular |

O `cclasstrib` não é detalhe: a **LC 227/2026, art. 341-G VI** põe a multa em quem **desenvolve o software**, não no cliente. Produto sem classificação tributária depois de 3 de agosto é exposição nossa.

**O cliente é um cadastro, não um relacionamento.** A tabela `contacts` é rica (endereço completo, documento, `credit_limit`, `default_payment_terms`, WhatsApp). A tela grava tudo e **nada disso é lido depois**:

- `credit_limit` é gravado e **nunca consultado** em lugar nenhum. Não existe bloqueio nem aviso de venda.
- `default_payment_terms` não pré-preenche nada.
- Não existe aba de histórico: nenhuma tela agrega pedidos, notas ou recebíveis por cliente.
- `transactions` e `bills_payable` **não têm `contact_id`**. O financeiro puro não sabe de quem é o dinheiro.

**Colunas prontas que a tela ignora.** `sales_orders` já tem `commission_percent`, `commission_value`, `payment_method`, `payment_terms`, `discount_percent`, `internal_notes`. A tela não grava nenhuma delas. `salesperson` é campo de texto livre: vendedor não é entidade, então não há comissão, meta nem ranking.

**Os agentes não têm o que fazer.** `agent_actions` tem **0 linhas**. Não é bug de tela: `agent-collections` lê **somente `company_asaas_payments`**, que tem 0 linhas em produção. Quem não usa Asaas nunca verá uma ação, por construção. E as regras são constantes no código: `DIAS_ANTECEDENCIA = 3`, `FATOR_ANOMALIA = 3`, `VALOR_MINIMO = 500`, `JANELA_DIAS = 7`.

---

## O plano

Seis fases, ordenadas por dinheiro que destravam. Cada uma entrega sozinha.

### F0 — O pedido vira dinheiro

O passo que transforma três ilhas em processo. É a decisão nº 2 do conselho.

1. `receivables.sales_order_id` e `receivables.invoice_id`; criar `invoice_items`.
2. Botão **Faturar** no pedido: gera os recebíveis (com **parcelamento**, usando `default_payment_terms` do cliente), grava `invoices.sales_order_id` e opcionalmente dispara a emissão.
3. `NfseEmit.tsx:70` passa a ler `sales_order_id` (correção de uma linha que hoje quebra a cadeia inteira).
4. Confirmar pedido **baixa estoque** pela RPC atômica `registrar_movimento_estoque`, que já existe e já trata trava de linha e custo médio.
5. Status vira máquina de estados de verdade, não `Select` livre: orçamento → confirmado → faturado → entregue, com o que cada transição obriga.

**Resultado:** vender passa a aparecer no DRE, no fluxo de caixa e na cobrança.

### F1 — Produto que se classifica e que pode emitir nota

1. Expor `account_id` no cadastro. A venda passa a **nascer classificada**, atacando na origem os 32% de lançamentos sem conta.
2. Expor `cfop` e `tax_origin`, hoje invisíveis na tela.
3. **NCM e cClassTrib com sugestão de IA** a partir do nome e da descrição, validada contra a tabela oficial de 164 códigos (carregada da planilha versionada, nunca escrita à mão). O usuário confirma; a correção dele vira regra, igual ao classificador de extrato.
4. Painel **"produtos que não podem emitir nota depois de 3 de agosto"**, com o botão de resolver em lote. É proteção legal nossa e é argumento de venda.

### F2 — Cliente 360 e crédito que segura

1. Aba de histórico no contato: pedidos, notas, recebíveis, **atraso médio, ticket médio, curva ABC**.
2. `credit_limit` deixa de ser decorativo: ao confirmar pedido, avisa ou bloqueia conforme o saldo em aberto do cliente.
3. `contact_id` em `transactions` e `bills_payable`, para o financeiro saber de quem é cada real.
4. `default_payment_terms` pré-preenche o parcelamento no faturamento.

### F3 — Vendedor, comissão e meta

1. Vendedor vira entidade (usuário da empresa ou cadastro simples), no lugar do texto livre.
2. Comissão calculada de verdade, usando as colunas que já existem, virando **conta a pagar** no fechamento do mês.
3. Meta por vendedor e por mês, com realizado saindo da **mesma régua do DRE**, para não nascer um quinto número para o mesmo mês.

### F4 — Proposta que fecha sozinha

1. Orçamento como documento: numeração, validade, condição comercial.
2. **Link público de aceite**, com registro de quem aceitou e quando. Aceite converte em pedido automaticamente.
3. Lista de preços e política de desconto por cliente, com teto por perfil.

### F5 — Agentes com regra, que era o que faltava

1. Tabela `agent_rules` por empresa, e tela de configuração: ligar e desligar cada agente, limiares, cadência, horário de disparo, canal e tom.
2. **`agent-collections` passa a ler `receivables`**, e não só Asaas. Hoje ele é mudo por construção para quem não usa Asaas, que é praticamente todo mundo.
3. Régua de cobrança configurável (D-3, D+1, D+7, D+15), com o texto que o cliente aprova uma vez virando modelo.
4. Os limiares hoje fixos no código passam a ser padrão editável, não lei.

---

---

## Estado da implementação, 28/07/2026

| Fase | Estado |
|---|---|
| **F0** — o pedido vira dinheiro | **Feito.** `faturar_pedido()` com parcelamento numa transação, índice único contra faturar duas vezes, e `NfseEmit` lendo o `sales_order_id` que a tela sempre mandou e ele sempre descartou (`91540fe`). Confirmar o pedido **baixa estoque** e cancelar devolve, com procedência no movimento; o status virou **máquina de estados** no banco (`482deee`). Correção de rota: eu tinha marcado F0 como feito só com o faturamento, e esses dois itens do mesmo F0 não existiam. Fica de fora `invoice_items`, que só faz falta quando a nota precisar detalhar item a item. |
| **F1** — produto que se classifica e emite | **Feito**, menos a tabela oficial. `account_id`, `cfop` e `tax_origin` expostos; painel do prazo de 3 de agosto; `sugerir-fiscal` propondo NCM e cClassTrib com o humano confirmando. Falta carregar a planilha da NT, e a carga está pronta em `carregar_cclasstrib()`. `c167e51`, `44f8252` |
| **F2** — cliente 360 e crédito | **Feito.** `v_cliente_360`, `checar_credito()` avisando antes do clique, `contact_id` em transactions e bills_payable, histórico no topo do cadastro. Avisa e não bloqueia, de propósito. `3153a43` |
| **F3** — vendedor, comissão e meta | **Feito.** `salespeople` com migração do texto livre, `sales_targets`, `v_meta_vendedor`, `fechar_comissao()` gerando conta a pagar idempotente, e a tela `/salespeople`. `3153a43` |
| **F4** — proposta que fecha sozinha | **Feito.** Link público com token de 32 bytes e validade, leitura que não expõe custo nem nota interna, aceite registrando quem/quando e confirmando o pedido, token queimado no aceite. `5a1e64b` |
| **F5** — agentes com regra | **Feito antes das outras**, porque o agente de cobrança era mudo por construção. `a9b0639` |

Fica de fora, por decisão: lista de preços por cliente e política de desconto por perfil, que dependem de saber como o cliente realmente negocia. Sem um usuário real usando F2 e F4, essa modelagem seria chute.

## Ordem sugerida

**F0 e F1 primeiro, juntas.** F0 destrava o dinheiro e F1 tem prazo legal em 3 de agosto. Depois F5, que é barata e faz os agentes deixarem de ser enfeite. F2, F3 e F4 na sequência, conforme a validação com cliente real.

## O que continua bloqueado

Nada disso chega ao cliente enquanto a produção estiver parada. Medido hoje contra `biz-whisper-fin.lovable.app`, faltam no bundle publicado 14 rotas que existem no código, incluindo Recebíveis, Contratos, Orçamento, Fechamento e a importação de extrato. `lovable_deploy` responde 403: o **Publish é seu**, no editor. As edge functions são exceção, essas já estão no ar e verificadas.
