# Recorrência & Recompra — estratégia e como o FinanceAI executa

Guia único: o que é receita recorrente, o que é recompra, quais métricas mandam,
como desenhar planos e cadências, e onde cada peça vive no produto.

---

## 1. Por que isso é a bola da vez

Uma PME que vende por projeto/avulso acorda todo mês do zero: a receita do mês
que vem é uma incógnita e o dono vira refém do comercial. Receita recorrente
inverte a lógica: o mês começa com uma base já contratada. O efeito no negócio
é triplo.

- **Previsibilidade** — dá para planejar caixa, contratar e investir sabendo a base.
- **Valuation** — receita recorrente vale múltiplos maiores que receita de projeto.
- **Custo de venda** — vender de novo para quem já comprou custa uma fração de conquistar um cliente novo.

Existem dois motores distintos, e confundir os dois é o erro mais comum:

| | **Recorrência (assinatura)** | **Recompra (repetição)** |
|---|---|---|
| Natureza | Contrato ativo, cobrança automática | Cliente decide comprar de novo |
| Métrica-mãe | MRR / churn | Frequência, intervalo, LTV |
| Gatilho | Ciclo de cobrança | Janela de recompra do cliente |
| Onde vive | `contracts` → `/contracts` | `sales_orders` → `/recorrencia` |
| Risco | Cancelamento (churn) | Esquecimento / concorrente |

O ERP trata os dois no mesmo lugar: **`/recorrencia`** (menu Visão).

---

## 2. As métricas que importam (e a definição exata usada aqui)

### Recorrência

- **MRR (Monthly Recurring Revenue)** — receita recorrente normalizada por mês. Contratos em outros ciclos são mensalizados: semanal ×52/12, quinzenal ×26/12, mensal ×1, bimestral ×0,5, trimestral ×1/3, semestral ×1/6, anual ×1/12.
- **MRR novo** — contratos que começaram no mês.
- **MRR perdido (churn de receita)** — contratos que terminaram no mês.
- **Net new MRR** — novo menos perdido. **Este é o número que diz se o negócio está crescendo**; MRR total pode subir enquanto o net new despenca.
- **Churn %** — MRR perdido no mês ÷ MRR ativo do mês anterior. Referência: acima de 5% ao mês, o balde fura mais rápido do que o comercial enche.
- **LTV** — quanto um cliente vale ao longo da vida. Aproximação usada: ticket recorrente ÷ churn mensal. Sem churn, LTV é infinito (mostramos "—").

### Recompra

- **Intervalo médio** — dias entre a primeira e a última compra ÷ (nº de compras − 1). É a cadência natural daquele cliente, descoberta do histórico, não arbitrada.
- **Próxima esperada** — última compra + intervalo médio.
- **Status** (razão entre dias desde a última compra e o intervalo típico):
  - `em dia` < 0,8 — comprou há pouco, não incomode
  - `comprar agora` 0,8–1,25 — **está na janela; é aqui que a oferta converte**
  - `atrasado` 1,25–2 — passou do ritmo, risco de perda
  - `perdido` > 2 ciclos — sumiu, exige win-back
  - `1ª compra` — sem cadência ainda
- **Receita em jogo** — soma do ticket médio de quem está em "comprar agora" + "atrasado". É dinheiro quente, não projeção.

---

## 3. Como desenhar planos de recorrência

### 3.1 Escolha o modelo

| Modelo | Como funciona | Bom para |
|---|---|---|
| Assinatura simples | Valor fixo por mês | Serviço contínuo (contabilidade, suporte, manutenção) |
| Escada de valor | Bronze / Prata / Ouro | Base heterogênea; permite upgrade |
| Por consumo | Fixo + variável | Volume que oscila (mensagens, usuários) |
| Fee + sucesso | Base menor + % do ganho | Serviço com resultado mensurável |
| Clube / recorrente de produto | Entrega recorrente | Produto consumível (o caso de recompra virando assinatura) |

Regra prática: **três níveis, o do meio ancorado como o "certo"**. Mais que isso confunde.

### 3.2 Precifique pelo valor entregue, não pelo custo

Se a entrega economiza R$ 5 mil/mês do cliente, ancore em fração disso.
Um ciclo anual pago à vista com 2 meses de desconto melhora caixa e derruba churn.

### 3.3 Reduza o atrito de entrada

Período de teste, implantação diluída ou o primeiro mês proporcional convertem
mais que desconto permanente — que só corrói margem para sempre.

### 3.4 Combata churn antes de existir

- Reajuste anual **contratado desde o início** (o ERP tem índice e data no contrato: IPCA, IGPM, INPC ou fixo).
- Cobrança automática com boleto/PIX (Asaas) — falha de pagamento é causa silenciosa de churn.
- Contato proativo no primeiro sinal de queda de uso.

---

## 4. Como montar a estratégia de recompra

1. **Descubra a cadência real** — não invente "a cada 30 dias". O ERP calcula do histórico de cada cliente.
2. **Aja na janela, não fora dela** — oferta em "comprar agora" converte; em "em dia" irrita.
3. **Priorize por ticket** — o radar já ordena: oportunidade quente primeiro, maior ticket antes.
4. **Trate atrasado como urgência** — cada ciclo perdido dobra a chance de virar `perdido`.
5. **Win-back é campanha à parte** — quem sumiu há mais de 2 ciclos precisa de motivo novo, não de lembrete.
6. **Converta o recorrente informal em contrato** — cliente que compra igual há 6 meses é candidato natural a assinatura. Isso transforma recompra em MRR (o radar marca quem já tem contrato).

### Cadência de contato sugerida

| Momento | Ação |
|---|---|
| Entrou em "comprar agora" | Mensagem curta, oferta do que ele sempre compra |
| +7 dias sem resposta | Segunda tentativa com benefício (frete, brinde, prazo) |
| Virou "atrasado" | Ligação/áudio: entender se mudou algo |
| Virou "perdido" | Campanha de win-back, oferta de retorno |

---

## 5. Onde isso vive no FinanceAI

### Tela `/recorrencia` (menu Visão → "Recorrência & Recompra")

- **Saúde do MRR** — MRR atual, MRR novo do mês, churn %, LTV estimado.
- **Gráfico de 12 meses** com net new no mês.
- **Funil de recompra** — chips com quantos estão em cada status + receita em jogo e receita perdida.
- **Radar de clientes** — tabela ordenada por oportunidade: compras, intervalo, última, próxima esperada, ticket médio e ação. Quem tem WhatsApp e está na janela ganha o botão **Oferecer** (abre a conversa).

### Agente "Vigia de Recompra" (menu Inteligência → Agentes)

Roda todo dia pelo cron. Avisa quem entrou na janela e quem já atrasou, com o
total de ticket em jogo e o maior nome. Configurável: ignora clientes abaixo de
um ticket mínimo. Canais: sino do app e WhatsApp.

### Contratos (`/contracts`)

Onde a assinatura nasce: ciclo, dia de cobrança, forma de pagamento, índice de
reajuste e próxima data. Gera recebível automático (cron `contracts-billing`) e,
quando integrado ao Asaas, a cobrança sai sozinha.

### Fundação de dados (views, somente leitura)

| View | O que entrega |
|---|---|
| `v_mrr_movimentos` | MRR ativo/novo/perdido e contagem de contratos, por empresa e mês (12 meses) |
| `v_recompra_clientes` | Cadência por cliente: nº de compras, intervalo médio, dias desde a última, próxima esperada, ticket médio, se já tem contrato e o status |

Ambas com `security_invoker`: a RLS multiempresa vale normalmente. **Nenhuma
delas toca a régua do DRE** — são leitura pura sobre `contracts`, `sales_orders`
e `contacts`.

---

## 6. Roteiro de implantação (o que fazer nesta ordem)

1. **Semana 1 — enxergar.** Abra `/recorrencia`. Sem contratos, o MRR fica zerado: isso já é o diagnóstico. Veja quantos clientes têm cadência e quanto está em jogo.
2. **Semana 2 — colher o óbvio.** Ative o Vigia de Recompra e trabalhe a lista de "comprar agora" e "atrasado". É receita que já existe.
3. **Semana 3 — converter em contrato.** Pegue os clientes com cadência estável e ofereça assinatura com desconto contra o avulso. Cada conversão vira MRR.
4. **Mês 2 — automatizar a cobrança.** Ligue Asaas nos contratos: boleto/PIX automático, menos churn por falha de pagamento.
5. **Mês 3 — defender a base.** Configure reajuste anual nos contratos e acompanhe churn e net new mensalmente no painel.

---

## 7. Erros que custam caro

- **Olhar só o MRR total.** Ele sobe por inércia; o que denuncia problema é o net new e o churn.
- **Oferecer fora da janela.** Contato cedo demais queima a oferta; tarde demais perde o cliente.
- **Desconto permanente para segurar cliente.** Corrói margem e vira expectativa. Prefira ciclo anual antecipado.
- **Contrato sem reajuste.** Inflação come a margem em silêncio.
- **Tratar "perdido" como "atrasado".** Quem sumiu há 3 ciclos não volta com lembrete; precisa de oferta nova.
