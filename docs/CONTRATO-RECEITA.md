# Contrato de receita — Prova ⇄ FlowCRM ⇄ ERP

> Este documento é copiado, íntegro, nos três repositórios. Quando um lado muda, os três mudam
> juntos — contrato que vive num repositório só vira duas interpretações em uma semana.
>
> - `MindOpsTeam/gestor-de-tr-fego-2.0` (Prova — quem recebe)
> - `MindOpsTeam/flowcrm-remix-20-04` (FlowCRM — quem manda oportunidade ganha)
> - `MindOpsTeam/remix-of-cash-flow-bot` (ERP — quem manda a receita do período)

---

## 1. A pergunta que este contrato responde

**Quanto dinheiro entrou, e de qual anúncio ele veio?**

O Prova sabe o que foi gasto; ele não sabe o que entrou. Gateway, CRM e ERP sabem — cada um de um
jeito, e **cada um com uma confiança diferente**:

| fonte                                 | o que ela afirma               | `conciliado` |
| ------------------------------------- | ------------------------------ | ------------ |
| Gateway (Stripe, Asaas, Hotmart…)     | o pagamento foi **aprovado**   | `false`      |
| CRM (FlowCRM, Pipedrive, RD, HubSpot) | a oportunidade foi **ganha**   | `false`      |
| ERP (o da Viver de IA, e compatíveis) | o dinheiro **entrou na conta** | `true`       |
| Manual                                | alguém **digitou**             | `true`       |

**As quatro nunca se somam.** Aprovado, ganho e conciliado medem coisas diferentes do mesmo
dinheiro; somar dois conta a mesma venda duas vezes. A marca declara UMA fonte em
`brands.fonte_de_receita`; quem quiser ver lado a lado usa a reconciliação, que devolve a
**diferença**.

---

## 2. O formato

Um evento, um JSON. O mesmo nas duas direções.

```jsonc
{
  "origem": "flowcrm", // "flowcrm" | "erp" | "gateway" | "manual"
  "externalId": "opp_8813", // o id NO SISTEMA DE ORIGEM. É a chave de idempotência.
  "quando": "2026-09-20", // YYYY-MM-DD. Data do fato, não do envio.
  "valorCentavos": 240000, // inteiro, SEMPRE em centavos. Nunca decimal, nunca string.
  "moeda": "BRL",
  "conciliado": true, // ver a tabela acima. É o que impede a soma.
  "utms": {
    // opcional; ausente é diferente de vazio
    "source": "facebook",
    "medium": "cpc",
    "campaign": "120210000000000",
    "content": "238810000000000", // o id do ANÚNCIO, quando existir
  },
  "contato": {
    // opcional; usado para casar com o lead
    "email": "cliente@exemplo.com",
    "telefone": "+5511999998888",
  },
  "titulo": "Reforma cozinha — Ana", // opcional, para a tela ter o que mostrar
  "estornado": false, // opcional; `true` desfaz um evento já enviado
}
```

### As três regras que não se negociam

1. **`valorCentavos` é inteiro em centavos.** Decimal e string já produziram faturamento 100×
   maior em produção. Quem manda converte; quem recebe recusa o que não for inteiro.
2. **Ausência nunca vira zero.** Campo que não existe é **omitido**, nunca `0` nem `""`. Um
   negócio sem valor preenchido é comum em CRM, e contá-lo como R$ 0 derruba o ticket médio sem
   que nada tenha acontecido.
3. **`externalId` é estável e único na origem.** Ele é a chave de idempotência: reenviar o mesmo
   evento não pode criar uma segunda venda. Entrega é "pelo menos uma vez", sempre.

---

## 3. As duas portas

### 3.1 O parceiro EMPURRA (preferido)

```
POST https://<prova>/api/webhook/receita/<token>
Content-Type: application/json
X-Prova-Assinatura: sha256=<hmac do corpo cru, com o segredo>
```

Resposta `200` = recebido e enfileirado. **O Prova responde antes de processar**: o parceiro não
espera pela conciliação. Qualquer outro código significa "reenvie".

### 3.2 O Prova PUXA (para quem não tem webhook)

```
GET https://<parceiro>/api/prova/receita?de=2026-09-01&ate=2026-09-20
Authorization: Bearer <token que o parceiro gerou>

→ { "eventos": [ { …o mesmo formato… } ] }
```

Roda uma vez por dia. Janela fechada, nunca "desde sempre".

---

## 4. O que cada lado manda

### FlowCRM → `origem: "flowcrm"`, `conciliado: false`

Dispara quando a oportunidade **vira GANHA**. Não dispara em mudança de etapa intermediária:
o Prova não precisa do pipeline, precisa do desfecho.

- `externalId` = id da oportunidade
- `quando` = data do ganho
- `valorCentavos` = valor fechado
- `utms` = as que o lead trouxe, se o FlowCRM as guardou

**Reabrir uma oportunidade ganha** manda o mesmo `externalId` com `estornado: true`. É o análogo
do estorno — o Prova limpa `ganho_em` em vez de apagar a linha, e o histórico continua auditável.

### ERP → `origem: "erp"`, `conciliado: true`

Manda a **receita do período**, já conciliada — o que de fato entrou na conta.

- `externalId` = id do lançamento
- `quando` = data da liquidação, não a da emissão
- `valorCentavos` = valor líquido recebido

---

## 5. O pareamento, que é de dois campos

Sem OAuth, sem redirecionamento, sem app instalado.

1. No parceiro: **"Conectar ao Prova"** gera um token e mostra a URL de recebimento.
2. No Prova: **"Conectar FlowCRM"** / **"Conectar ERP"** pede a URL e o token.
3. O Prova faz uma chamada de teste e mostra o resultado na hora.

Dois campos de cada lado. Um assinante que precisa ler documentação para ligar dois produtos da
mesma casa é um assinante que não liga.

---

## 6. O que o Prova faz com o evento

```
recebe → confere assinatura → enfileira em `receita_eventos` (idempotente por externalId)
       → normaliza → grava em `vendas` (gateway/CRM) ou `receita_contabil` (ERP)
       → casa com o anúncio pelas UTMs, ou pelo contato, ou por nada
```

**Casar com o anúncio é opcional.** Venda sem origem conta no caixa e fica de fora da atribuição —
que é a verdade. Inventar uma origem seria pior: ela entra na conta e ninguém lembra que foi chute.

---

## 7. Estado, em 2026-09-20

| lado            | o que existe                                     | o que falta                                |
| --------------- | ------------------------------------------------ | ------------------------------------------ |
| Prova · gateway | 6 provedores, webhook, normalizador, ledger      | —                                          |
| Prova · ERP     | `erp_conectores`, leitura por API, reconciliação | a tela sair da aba e entrar no preparo     |
| Prova · CRM     | pipedrive, rdstation, hubspot                    | **flowcrm** (issue #70)                    |
| FlowCRM         | —                                                | o disparo no ganho e a tela de conectar    |
| ERP             | —                                                | o endpoint do período e a tela de conectar |
