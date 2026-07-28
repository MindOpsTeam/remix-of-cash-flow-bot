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

---

## Lente: suprimentos, compras e estoque

### Verificado no código

**Buraco de controle interno, corrigido.** `PurchaseOrders.tsx` criava o título em `bills_payable` **sem passar `approval_status`**, caindo no default `approved` do banco. O caminho manual (`useBillsPayable`) respeita `company_members.approval_limit`. Ou seja: qualquer membro comprometia a empresa com qualquer valor criando um pedido e marcando confirmado. Corrigido, o título agora herda o estado de aprovação e aponta para o pedido pela nova FK `bills_payable.purchase_order_id`.

**O razão de estoque mentia.** No ajuste, a tela gravava a quantidade **absoluta** como se fosse variação: estoque 80 ajustado para 50 registrava +50, quando o delta real era -30. Reprocessar o histórico nunca reproduziria o saldo. E o saldo era calculado no cliente, a partir do cache, com dois round-trips não atômicos: dois usuários simultâneos perdiam movimento.

Corrigido com a RPC `registrar_movimento_estoque`, que trava a linha do produto, grava sempre o **delta**, recusa saída maior que o saldo e calcula **custo médio móvel** (`products.average_cost`, coluna nova, semeada pelo custo cadastrado). Verificado em produção com tenant temporário: ajuste de 80 para 50 gravou `-30`, e saída de 5.000 sobre saldo 100 foi recusada.

### A decisão que o especialista recomenda

**Cortar o estoque, construir a espinha compra-para-pagamento, integrar o armazém.** O argumento não é logístico, é financeiro: o CMV hoje é classificação de caixa (`DRE.tsx`, despesa em conta 4.x), então **a margem bruta, que é o número de vitrine do produto, está errada para qualquer cliente que carrega estoque**. A correção é uma camada de custeio de três colunas, não um WMS.

Números que sustentam: Katana cobra US$ 299/mês e vende reposição por IA como produto separado de US$ 249; Cin7 começa em US$ 349. Quem faz só isso cobra mais que nós inteiros. E a própria Omie terceiriza cotação e alçada para um app de terceiro.

---

## Lente: experiência e ativação

### O número que explica o produto

O sistema criou **2.877 linhas de configuração** (plano de contas, centros de custo, contas bancárias) para sustentar **34 lançamentos reais**. Oitenta e cinco linhas de andaime para cada linha de valor. A mediana dos 115 usuários **nunca lançou nada**.

E o que nunca aconteceu em 130 empresas: nenhuma conexão bancária, nenhuma conciliação, nenhum recebível, nenhum orçamento, nenhum fechamento. Vinte das cinquenta tabelas estão zeradas.

### Verificado e corrigido

**O onboarding se autodestruía.** `Index.tsx` marcava `onboarding_completed = true` **na abertura do wizard**, dentro do mesmo bloco que detectou que ele não tinha sido feito. Fechar a aba na primeira etapa era indistinguível de concluir, e o modal não pode ser fechado. Uma chance por usuário, gasta antes de começar. Corrigido: quem conclui é o wizard, que já fazia isso.

**A persona escondia a única tela que importa.** O grupo Operação, onde vive Lançamentos, estava visível só para a persona `operacional`. O dono da empresa, que se identifica como estratégico e é o comprador do produto, tinha a tela de registrar dinheiro removida da navegação. Corrigido para as três personas.

### O que aceito como diagnóstico

A ordem do produto está invertida: **configurar, integrar, declarar pronto, nunca usar**. O certo é **usar, ver resultado, então configurar o que acelera**. Duas consequências práticas: a etapa de integrações do onboarding pede seis credenciais de API a um dono de PME na primeira sessão (o banco mostra o resultado: 3,8% configuraram Asaas, 1,5% o Inter), e não existe importação de nada, só exportação. Colar extrato num campo de texto é a feature de maior retorno por linha de código do backlog inteiro.

---

## Lente: inteligência artificial

### Verificado e corrigido

**O classificador aceitava conta inventada.** `ai-classify` devolvia o `account_id` do modelo sem conferir se ele estava na lista enviada. UUID alucinado ia direto para o insert. Corrigido: o que não estava na lista vira nulo e a confiança cai.

**O botão de cobrança abria conversa sem destinatário.** `agent-collections` nunca preenche `contact_whatsapp`, e a tela montava `wa.me/` com string vazia, marcando a ação como enviada no clique. Corrigido: com telefone, link; sem telefone, copiar a mensagem. Nada finge que enviou.

### O diagnóstico mais duro, que aceito

**`ai-forecast` viola a regra da casa.** Ele manda seis linhas de resumo para o modelo e pede que **o modelo devolva o número projetado**, com temperatura 0,3. A mesma pergunta duas vezes dá dois resultados. Um CFO que vê a previsão mudar sozinha deixa de confiar em todas as telas, inclusive nas certas. Média móvel ponderada com sazonalidade resolve em vinte e cinco linhas, com intervalo de confiança real, custo zero e resultado estável. O modelo entra depois, só para narrar a causa.

**E a solução do custo já está construída e desligada.** A função `mcp` do próprio projeto expõe `cash_summary` e `list_transactions`, ferramentas determinísticas prontas. O `cfo-digital` não as chama: ele injeta mil linhas de transação em texto no prompt a cada turno e pede ao modelo que some. Ligar as ferramentas resolve custo e alucinação na mesma mudança.

### A fronteira do dinheiro

Para quando os MCPs de pagamento forem ligados, a regra proposta é boa e fica registrada: aprova-se um **hash** de beneficiário mais documento mais valor, não um texto; beneficiário novo exige dois aprovadores independentemente do valor; janela de arrependimento de trinta minutos antes de executar; e teto agregado por dia, não só por transação. Alteração de chave Pix de fornecedor conhecido nunca executa sozinha, porque é o golpe mais comum contra PME brasileira.

---

## Risco jurídico que a pesquisa fiscal trouxe

A **LC 227/2026** inseriu o art. 341-G, VI na LC 214/2025, criando multa de 150 UPF por equipamento para quem **desenvolve, fornece ou instala software** que emita documento fiscal fora dos requisitos da legislação.

A multa é na software house, não no cliente. Um ERP que emitir NF-e sem o grupo IBS/CBS depois de 3 de agosto cai literalmente na hipótese. Isso muda a natureza da correção que fizemos hoje: não era melhoria de produto, era exposição legal nossa.

Dois pontos operacionais da mesma pesquisa: para NFS-e o layout exigido é o da **NT004 mais o `tpRetPisCofins` da NT007**, e não a NT009; e a tabela oficial de `cClassTrib` tem **164 códigos** com colunas que dizem quais grupos XML são obrigatórios em cada documento, o que significa que a validação deve ser **carregada da planilha versionada**, nunca escrita à mão no código.

---

## Lente: contabilidade e fiscal, benchmark do contador

### O achado mais acionável de todo o conselho

**O Fisco publica uma API pública e gratuita com a tabela tributária e um validador.** Portal Conformidade Fácil (SVRS/ENCAT), autenticação por certificado ICP-Brasil, anunciado em outubro de 2025:

- Portal: `https://dfe-portal.svrs.rs.gov.br/Cff`
- API: `https://cff.svrs.rs.gov.br/api/v1/consultas/classTrib`

Entrega as tabelas `cClassTrib`, `cCredPres` e `indOp`, um assistente de classificação por NCM e um **validador RTC** para NF-e, NFC-e, CT-e, BP-e, NF3e e NFCom.

Consumir isso direto elimina a manutenção manual da tabela tributária, que é exatamente o trabalho que a Systax cobra caro para fazer, e permite validar o XML **antes** de transmitir. Nós já temos `tax_rates` e `municipalities`: plugar essa fonte é o caminho mais curto entre onde estamos e conformidade de verdade.

### A mudança estrutural que ninguém no nosso porte está preparado para

**Apuração assistida, a partir de janeiro de 2027.** O Fisco consolida débitos e créditos a partir dos documentos fiscais (art. 46 da LC 214/2025) e entrega uma **proposta pré-preenchida**. O prazo de validação é o dia 15 do mês seguinte, ou dia 20 para quem entrega DeRE. **Silêncio equivale a aceitação, com efeito de confissão de dívida.**

Isso inverte a profissão: o contador deixa de montar a apuração e passa a **auditar a apuração do Fisco dentro de prazo fatal**. Software sem caixa de entrada da proposta fiscal, sem contador de prazo e sem trilha de contestação vira gargalo de risco para o escritório.

A TOTVS já integra oficialmente a etapa 2 do piloto do sistema de apuração assistida do IBS. A ROIT lançou em maio um produto inteiro só para isso, tratando a apuração como conciliação entre cinco fontes da verdade: ERP, banco, Receita, Comitê Gestor e documentos fiscais. É a arquitetura correta, e quase ninguém tem.

### A régua mínima do contador para trocar de sistema

Sem estes, ele não abre a demonstração:

1. **ECD e ECF com recuperação do período anterior.** Não é "gerar SPED", é gerar a ECD, recuperar a ECD dentro da ECF e recuperar a ECF anterior antes de validar.
2. **Plano de contas referencial** amarrado à empresa, com partida dobrada e rateio por centro de custo.
3. **Captura automática de XML de entrada direto da SEFAZ**, sem depender do cliente enviar. É o diferencial que todos os sistemas de escritório vendem em primeira linha.
4. **Nota Técnica em dia, com data.** Atraso de layout do fornecedor não é inconveniente, é parada de faturamento do cliente do contador.
5. **Folha, eSocial, DCTFWeb e EFD-Reinf no mesmo sistema.**

Nós temos, hoje, a partida dobrada (a tela de auditoria criada nesta rodada) e emissão. **Não temos ECD, ECF, plano referencial, captura automática de XML nem folha.** Isso define com precisão o que somos: um ERP financeiro que conversa com o contador, não um sistema contábil. Vender como sistema contábil seria mentir, e o contador descobre na primeira pergunta.

### O que copiar, em ordem de retorno

**Cronograma público datado, como o do Omie.** Enquanto TOTVS, Domínio e Contmatic dizem "estamos prontos", o Omie publica data por entrega, com marca de concluído no que saiu e previsão no que falta. Custa quase nada de engenharia, mata ansiedade do cliente e vira ativo de vendas. É o maior retorno de confiança do benchmark inteiro.

**Assistente de exceções da Sankhya.** Em vez de pedir que o usuário classifique o catálogo do zero, o sistema lê os documentos fiscais que a empresa **já emitiu**, extrai os NCM e NBS realmente usados e sugere a classificação. Transforma projeto de meses em revisão. O padrão vale para qualquer migração, não só para a Reforma.

**Robô de diagnóstico gratuito da Senior.** Uma ferramenta que varre a base do cliente e devolve o status de parametrização. É qualificação de lead disfarçada de utilidade, e o cliente chega com o gap mapeado.

**Simulador de transição dentro do módulo fiscal, exportável em PDF (Alterdata).** O nosso já existe e é bom. A diferença é que o deles gera o PDF que o contador manda para o cliente, e isso vira venda de honorário consultivo.

### Referência de preço da camada fiscal

A Focus NFe é a única com preço público do benchmark: R$ 89,90 por mês para um CNPJ com 100 notas, e R$ 548 para CNPJs ilimitados com 4.000 notas, sem fidelidade. Nenhum dos ERPs grandes ou sistemas de escritório publica preço.

---

## Síntese: as cinco decisões que este conselho pede

1. **Publicar.** Nada disso existe para o cliente enquanto a produção estiver parada em junho.
2. **Fechar a cadeia pedido, nota, recebível.** Duas colunas e um botão "Faturar" transformam três ilhas em processo.
3. **Inverter a ordem do produto.** Usar, ver resultado, depois configurar. Colar extrato é o maior retorno por linha de código do backlog.
4. **Tirar o LLM de cima do número.** A previsão de caixa precisa ser cálculo, com o modelo apenas narrando a causa.
5. **Assumir o que somos.** ERP financeiro com fiscal forte que conversa com o contador. Não sistema contábil, não WMS. E aí, dentro desse recorte, ser o melhor: conciliação a três vias, crédito de CBS/IBS visível, e pagamento com lastro fiscal.
