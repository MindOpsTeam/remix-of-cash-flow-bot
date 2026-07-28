# Conselho de especialistas, julho de 2026

Dez lentes independentes avaliaram a plataforma contra o estado da arte mundial e brasileiro. Cada uma pesquisou o mercado primeiro, leu o nosso código depois e só então opinou. Este documento consolida o que voltou, separando o que foi **verificado** do que é **recomendação**.

Regra de leitura: onde o especialista errou, está anotado. Nem tudo que um agente afirma sobre o próprio sistema é verdade, e conferir é parte do trabalho.

---

## Achado mais urgente: o prazo de 3 de agosto

A pesquisa de mercado trouxe um prazo que estava passando despercebido.

Desde **3 de agosto de 2026**, documento fiscal eletrônico de empresa no **regime regular** (Lucro Presumido e Real) é **rejeitado** sem os campos de IBS e CBS. Para o **Simples Nacional**, a data é **4 de janeiro de 2027**. Fonte: [Comitê Gestor do IBS](https://www.cgibs.gov.br/novo-marco-da-reforma-tributaria-inicia-em-03-de-agosto-com-preenchimento-obrigatorio-dos-campos-relativos-ao-ibs-e-a-cbs).

Situação dos nossos três emissores quando o conselho começou:

| Emissor | Mandava IBS/CBS? |
|---|---|
| PlugNotas | Sim, no formato real (`itens[].tributos.ibscbs`) |
| NFS-e Nacional | Não |
| Focus NFe | Não |

**Corrigido** no commit `a0bcabd`: `src/lib/reforma.ts` ganhou `montarGrupoIbsCbsFocus`, que reaproveita exatamente a mesma conta já testada do mapeador do PlugNotas e só troca o nome dos campos para o que a Focus espera dentro de `servico`. Um cálculo, dois mapeadores, com teste comparando os dois lado a lado para nunca divergirem. A tela de emissão passou a mostrar o que vai destacado e de onde veio a classificação tributária.

---

## Lente: vendas, faturamento e precificação

### O que foi verificado no código

**A cadeia pedido → nota → recebimento → receita não é uma cadeia.** São três ilhas, e só o último elo está soldado.

1. **A nota emitida pela Focus não existia dentro da plataforma.** A função `focus-nfe` gravava só telemetria em `focus_config` e nada em `invoices`. Como `/fiscal` lê `invoices`, toda emissão pela Focus era invisível no próprio sistema. Erro meu, do dia anterior. **Corrigido** no commit `cb01ed6`: a nota nasce com status `processing` (a emissão é assíncrona) e a consulta promove para `authorized`, gravando número e código de verificação, junto com o destaque de CBS/IBS.

2. **A NFS-e Nacional jogava o cliente fora.** `nfse-proxy` inseria a nota com `contact_id: null` fixo. A nota nascia órfã de cliente. **Corrigido** no mesmo commit, junto com suporte a `sales_order_id`.

3. **O elo pedido → nota morre no meio do caminho.** `SalesOrders.tsx` coloca `sales_order_id` na query string, e `NfseEmit.tsx` lê só `valor` e `contact_id`, descartando o resto. A coluna `invoices.sales_order_id` existe desde março e nunca foi preenchida.

4. **`receivables` não tem `invoice_id`.** Sem isso não há como responder "esta nota foi paga?", não existe aging por documento fiscal e a cobrança não consegue citar a nota.

5. **Colunas comerciais mortas.** `sales_orders.commission_percent` e `commission_value` existem no banco e nenhuma linha de código escreve ou lê. `salesperson` é texto livre, então "João" e "João Silva" são dois vendedores.

6. **Nenhum emissor trata retenções** (IRRF, INSS, PIS/COFINS/CSLL). Serviço B2B acima de R$ 5.000 tem retenção quase sempre, e o valor que cai na conta nunca bate com a nota.

### Onde o especialista errou

Ele afirmou que o motor de faturamento recorrente "nunca girou" porque não há cron no repositório. **Falso.** O `contracts-billing-daily` está ativo em produção como job 5, às 6h. O que falta é o agendamento estar versionado, não o agendamento existir.

### Recomendações que aceito

Em ordem: ligar `receivables.invoice_id` e `sales_order_id`; botão único "Faturar" no pedido que emite a nota, cria o recebível e move o status numa transação só; emissão automática de NFS-e no contrato recorrente; retenções na nota.

### A ideia comercial mais forte

**Carta de reajuste em um clique.** `contracts` não tem índice, mês de aniversário nem histórico, e `advanceDate` move a data sem nunca tocar no valor. Um contrato de 2024 cobra preço de 2024 para sempre. O argumento de venda se escreve sozinho: "seus 12 contratos estão R$ 3.870 por mês abaixo do reajuste devido, R$ 46.440 no ano". O Superlógica faz exatamente isso, com simulação antes de aplicar e carta pronta para o cliente ([como funciona](https://blog.superlogica.com/assinaturas/como-fazer-reajuste-de-contratos-assinaturas-e-mensalidades/)).

### Segunda ideia: crédito de CBS/IBS como argumento de retenção

Pela LC 214/2025, quem fica no Simples **não transfere crédito integral** de CBS/IBS ao cliente; quem está no regime regular transfere tudo. A primeira janela de opção é **setembro de 2026**. Traduzindo: um prestador B2B no Simples vai ficar efetivamente mais caro que o concorrente no Presumido e pode perder contrato sem entender por quê. Já temos `useReformaCarteira` classificando a carteira real em B2B e B2C. Falta o passo comercial: dizer ao dono quanto de crédito seus clientes perdem, e emitir um demonstrativo por nota do crédito gerado para o tomador.

---

## Pesquisa de referência: order-to-cash no estado da arte

Cadências publicadas, para não inventarmos a nossa do zero:

| Fonte | Cadência |
|---|---|
| Stripe Smart Retries | 8 tentativas em 14 dias, temporizadas por modelo |
| Chargebee inteligente | até 12 tentativas, sensível ao código de recusa |
| Chargebee B2B, recusa dura | 1 tentativa a cada 5 dias por 28 dias, pulando fim de semana |
| NetSuite | até 15 níveis ordenados; **`Days Overdue` aceita negativo**, então o mesmo mecanismo faz lembrete antes do vencimento e escalonamento depois |
| Stripe faturas manuais | até 3 lembretes, de 10 dias antes até 60 depois |

Dois achados estruturais que valem mais que a cadência:

1. **Pagamento originado no portal dá 100% de conciliação**, porque a remessa é capturada no momento do pagamento. O portal é jogada de conciliação, não só de experiência (Versapay).
2. **O maior erro na previsão de data de pagamento não é risco de crédito, é o calendário de contas a pagar do cliente.** A HighRadius publicou o estudo: Random Forest treinado em 120 mil faturas acerta a data exata em 35,5% e cai dentro de 3 dias em 81,1%, contra 50% do método tradicional ([estudo CRF](https://www.crfonline.org/wp-content/uploads/2018/04/HighRadius-Proactive-Collections-Management-Using-AI-1Q2018-Journal.pdf)).

Referência de mercado para nos ancorarmos: DSO de 39 dias e atraso médio de 6 dias na rede Billtrust em 2025; conciliação automática de 90% é o mínimo aceitável; inadimplência involuntária responde por 20% a 40% do churn em assinatura.

---

## Mercado e preço, pesquisa própria

O que a concorrência cobra por mês, em 2026:

| Produto | Faixa |
|---|---|
| Conta Azul | R$ 220 a R$ 650 |
| Bling | R$ 250 a R$ 800 |
| Omie | R$ 450 a R$ 1.800 |
| Sankhya e TOTVS | sob consulta |

Posicionamento praticado: Bling é o generalista de marketplace, Conta Azul puxa para o financeiro e para o contador, Omie atende PME média com processo customizável.

E o gatilho de troca de sistema em 2026 e 2027 é a Reforma. Quem não entregar IBS e CBS na nota perde o cliente por obrigação legal, não por preferência.

---

## Estado de preenchimento

Este documento é atualizado conforme as demais lentes retornam. Lentes concluídas: vendas e faturamento, pesquisa de order-to-cash, mercado e preço. Em andamento: controladoria, tesouraria, suprimentos, experiência e ativação, inteligência artificial. Refeitas após falha: contabilidade e fiscal, contas a receber.
