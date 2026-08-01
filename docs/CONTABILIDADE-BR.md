# Como o FinanceAI classifica com correção contábil (CFC)

Resposta curta à pergunta "como a IA sabe o centro de custo certo?": **na maior parte
das vezes ela não decide nada** — quem decide é regra determinística. A IA só entra no
que sobra, e mesmo aí com a doutrina no contexto e validação na volta.

## A ordem de decisão (a IA é o último recurso, não o primeiro)

```
1. Regra aprendida da empresa   → o humano já corrigiu esse padrão antes. Zero token.
2. Doutrina determinística      → DAS, FGTS, tarifa, maquininha, aluguel… não admitem
                                  dúvida. Código auditável, zero token.
3. IA com doutrina no contexto  → só o que exige julgamento.
4. Validação contábil na volta  → derruba o que fere a norma, antes de virar lançamento.
```

Cada camada reduz a seguinte. Na segunda importação de extrato do mesmo cliente, quase
tudo cai em (1) e (2) — a IA fica mais barata conforme o sistema é usado, não mais cara.

## O que está codificado (`_shared/contabil-br.ts`)

Base de conhecimento pura, injetada em **todo** prompt de classificação (extrato e OCR
de documento):

- **Princípios do CFC** com a norma que os sustenta: Competência, Entidade, Oportunidade,
  Registro pelo valor original, Prudência (NBC TG Estrutura Conceitual, ITG 1000, ITG 2000).
- **Custo × despesa**, o erro mais caro, com teste prático: *"se eu não vender nada este
  mês, esse gasto acontece?"* Se sim, é despesa; se não, é custo (NBC TG 16; Lei 6.404/76
  art. 187).
- **Natureza de cada conta** do plano padrão — e, principalmente, **o que ela não aceita**.
  Exemplo: 5.7 (Impostos) aceita DAS e ISS, mas **não** aceita INSS/FGTS, que são encargo
  de pessoal.
- **Critério de centro de custo**: é de quem **consome** o recurso, não de quem paga nem
  de quem assina. E a regra que evita o pior: *na dúvida, deixe vazio* — centro errado
  contamina a análise gerencial e ninguém percebe.
- **Armadilhas do extrato brasileiro**: transferência entre contas próprias, aporte de
  sócio, distribuição de lucro, antecipação de recebível, estorno de venda, juros embutidos
  em pagamento de fornecedor.

## O que é resolvido sem IA (`_shared/contabil-heuristica.ts`)

Padrões que o extrato brasileiro repete todo mês, com a justificativa contábil junto:

| Descrição no extrato | Vai para | Por quê |
|---|---|---|
| DAS, DARF, ISS, PIS/COFINS | 5.7 Impostos | tributo sobre faturamento/lucro |
| FGTS, INSS, GPS | 5.2 Salários | encargo de pessoal, **não** imposto |
| Stone, Cielo, PagSeguro, maquininha | 4.3 Taxas de pagamento | incide sobre a venda → é **custo** |
| Tarifa, IOF, juros, multa | 5.8 Juros e Tarifas | despesa **financeira** |
| Aluguel, condomínio, IPTU | 5.4 Aluguel | ocupação do imóvel |
| Google, AWS, Microsoft | 5.5 Softwares | assinatura de estrutura |
| Contador, advogado | 5.6 Contabilidade | honorário profissional |
| Pró-labore | 5.3 Pró-labore | separado de salário e de lucro |
| Frete, Correios, transportadora | 4.4 Fretes | frete sobre venda é custo |
| Rendimento de aplicação | 3.4 Outras Receitas | receita financeira |

E o mais importante: um conjunto de padrões que **bloqueia a classificação**, porque o
lançamento não pertence ao resultado — transferência entre contas do mesmo CNPJ, aporte de
sócio, distribuição de lucro, empréstimo recebido. Nesses casos o sistema **não classifica
nada** e explica o motivo. Ficar de fora do DRE é melhor do que inflá-lo.

## O que é validado depois (a IA erra em silêncio)

Toda classificação, venha da IA ou do humano, passa por `validarClassificacao()`:

- entrada só pode ir para conta de receita; saída só para custo/despesa (**erro**, derruba);
- receita tem de estar no grupo 3; custo/despesa nos grupos 4 ou 5 (**erro**);
- movimento que não é resultado não pode ter conta (**erro**);
- quando a descrição sugere fortemente outra conta, gera **alerta** para revisão humana —
  sem bloquear, porque pode haver contexto que o padrão não vê.

## O ouro: integridade da cadeia entre tabelas

O valor do ERP não está numa tabela isolada, está no encadeamento. Um elo partido não
quebra o sistema: ele faz o DRE mostrar número errado em silêncio. A função
`auditar_integridade_contabil(company_id)` (exposta em **Auditoria**) procura exatamente
isso:

| Regra | Severidade | O que denuncia |
|---|---|---|
| `natureza_da_conta` | erro | receita em conta de despesa (ou o inverso) |
| `grupo_do_plano` | erro | conta fora da régua 3/4/5 |
| `centro_de_outra_empresa` | erro | **vazamento entre CNPJs**: centro de custo de outro tenant |
| `conta_de_outra_empresa` | erro | idem para conta contábil |
| `recebivel_sem_lancamento` | erro | título recebido que não virou receita (caixa entrou, DRE não viu) |
| `lancamento_em_mes_fechado` | erro | lançamento criado depois do fechamento |
| `pedido_faturado_sem_recebivel` | alerta | pedido faturado que não gerou título |
| `contrato_sem_cobranca` | alerta | contrato ativo vencido sem recebível |
| `lancamento_sem_conta` | alerta | confirmado sem classificação |
| `competencia_ausente` | alerta | regime de competência sem data de competência |

**Validada com furos plantados** num tenant efêmero (e desfeita por rollback): receita em
conta de despesa, centro de custo de outra empresa, recebível recebido sem lançamento e
lançamento sem conta — a auditoria acusou todos.

## Limites honestos

- Isto **não substitui o contador**. O sistema organiza, classifica e denuncia
  inconsistência; a responsabilidade técnica da escrituração continua sendo do
  profissional habilitado (Resolução CFC 1.330/11).
- Centro de custo é **gerencial**, não exigência do CFC. O critério aqui é o de consumo do
  recurso, e o sistema prefere deixar vazio a chutar rateio.
- A classificação automática assume o **plano de contas padrão** da casa (3/4/5). Empresa
  que reescreve o plano inteiro perde parte das heurísticas por código — as validações de
  natureza e a auditoria de cadeia continuam valendo.
