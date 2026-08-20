# Camada de previsibilidade: incerteza medida, sazonalidade e recorrência no caixa

**Data:** 19/08/2026 · **Repo:** MindOpsTeam/remix-of-cash-flow-bot (FinanceAI Projeto Original)
**Modo:** plano, nada implementado
**Restrição inegociável do pedido:** não quebrar nenhuma função existente. Tudo aditivo.

## Goal

Elevar a previsibilidade financeira de "um número com rótulo de confiança" para
um sistema que declara **quanto erra**, **por que erra** e **o que já está
contratado versus o que é aposta**. Sem tocar na assinatura de nada que já roda.

## O que já existe (levantado no código, não suposto)

| Peça | Onde | O que faz hoje |
|---|---|---|
| Projeção de caixa | `_shared/forecast.ts` → `projetarCaixa` | média ponderada (peso linear), desvio padrão para volatilidade, `Math.max(contratado, base)`, confiança categórica por 4 pontos |
| Motor TimesFM | `_shared/timesfm.ts` (19/08) | AI.FORECAST no BigQuery, base mês a mês, `null` em qualquer falha |
| Compromissos | `ai-forecast/index.ts` | já cruza `receivables`, `bills_payable` e `contracts` com o horizonte |
| Recompra | migration `20260731160000` | `intervalo_medio_dias = (última − primeira) / (n − 1)`; status por razão `dias_desde_ultima / intervalo` nos cortes 0.8 / 1.25 / 2 |
| MRR e LTV | `src/lib/recorrencia.ts` | `resumirMrr`, `ltvPorChurn`, `ordenarRadar` |
| Anomalia | `agent-anomalies` | valor acima de `média × FATOR` na janela, por categoria |

**Ponto de partida honesto:** a fundação é boa. `projetarCaixa` já separa
contratado de estimado, já é conservador (`max`) e já não deixa o modelo de
linguagem calcular. O que falta é a camada de cima.

## Os quatro buracos que a camada resolve

**1. A incerteza é um rótulo, não um número.** Hoje sai `confidence: "high"`.
Ninguém decide com isso. Falta a banda: "entre R$ X e R$ Y, com 80% de chance".

**2. Ninguém mede o erro.** Não existe tabela de previsão guardada, nem WAPE, nem
nada. Sem isso, "a IA prevê" é fé. Com isso, vira "ela errou 8% nas últimas 12
previsões desta empresa, então confio nessa margem".

**3. A sazonalidade é achatada.** A média ponderada trata dezembro como um mês
qualquer. O TimesFM resolve, mas só para quem configurou o Google Cloud, que é
opcional e pago.

**4. A recorrência não conversa com o caixa.** Existe um radar de recompra com
status por cliente, e ele morre numa tela. A informação "este cliente compra a
cada 32 dias e está no dia 30" é entrada de caixa provável e não entra na
projeção.

## Arquitetura da camada (por que não quebra nada)

Três regras que valem para tudo abaixo:

1. **Funções puras novas em arquivos novos.** Nenhuma função existente muda de
   assinatura. Onde precisar de entrada extra, entra **parâmetro opcional no
   fim**, exatamente como o `basePorMes` que já foi feito para o TimesFM.
2. **Campos de saída são opcionais.** `MesProjetado` ganha campos `?`, então
   todo consumidor atual continua compilando e renderizando igual.
3. **Degradação silenciosa.** Toda camada nova devolve `null` quando não tem
   base suficiente, e o caminho antigo assume. Nunca lança.

## Camada 1 · Banda de incerteza (P10 / P50 / P90)

**Arquivo novo:** `supabase/functions/_shared/analytics/incerteza.ts`

Estima a dispersão a partir do **erro do próprio método** no histórico, com
backtest de janela deslizante: reprojeta o passado com os dados que existiam
naquele momento e mede o desvio dos resíduos. É honesto porque a banda vem do
erro real daquela empresa, não de um chute fixo.

```ts
export interface Banda { p10: number; p50: number; p90: number }
export function bandaPorResiduo(historico: MesHistorico[], base: number, horizonte: number): Banda | null
```

- A banda **abre** com o horizonte (mês 3 é mais incerto que mês 1). Fator
  `sqrt(h)`, que é o comportamento de random walk e é defensável.
- Mínimo de 6 meses; abaixo disso devolve `null` e a UI mostra só o número, como
  hoje.

**Integração:** `projetarCaixa` ganha um 6º parâmetro opcional `bandas?`, e
`MesProjetado` ganha `faixa_receita?` e `faixa_despesa?`.

**Leitura de negócio que isso destrava:** para compromisso que tem que ser
honrado (folha, imposto), lê-se a borda de baixo. Para investimento que pode
esperar, a linha do meio. Hoje não dá para fazer essa distinção.

## Camada 2 · Sazonalidade explícita

**Arquivo novo:** `supabase/functions/_shared/analytics/sazonalidade.ts`

```ts
export interface FatorMes { mes: number; fator: number; base: number }
export function fatoresSazonais(historico: MesHistorico[]): FatorMes[] | null
export function aplicarSazonalidade(base: number, mesAlvo: number, fatores: FatorMes[]): number
```

- Fator = mediana do mês / mediana geral, com **mediana e não média**, para um
  dezembro atípico não virar regra.
- Exige **24 meses** (dois ciclos): com um só, não dá para separar sazonalidade
  de tendência, e inventar isso é pior que não ter.
- `winsoriza` os fatores em [0.5, 2.0]: sazonalidade real de PME não passa disso,
  e o que passa costuma ser erro de lançamento.

**Ordem de precedência no motor** (importante, e explícita para não haver
ambiguidade): TimesFM quando configurado → senão média ponderada **com** fatores
sazonais quando há 24 meses → senão média ponderada pura (comportamento atual).

## Camada 3 · Acurácia medida (o que dá confiança)

**Migration nova:** `20260820100000_forecast_accuracy.sql`

```sql
create table public.forecast_snapshots (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  gerado_em date not null default current_date,
  mes_alvo text not null,                       -- YYYY-MM previsto
  motor text not null,                          -- timesfm | sazonal | estatistico
  receita_prevista numeric(14,2) not null,
  despesa_prevista numeric(14,2) not null,
  p10 numeric(14,2), p90 numeric(14,2),
  unique (company_id, gerado_em, mes_alvo)
);

create table public.forecast_accuracy (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  mes_alvo text not null,
  motor text not null,
  wape_receita numeric(6,4),
  wape_despesa numeric(6,4),
  dentro_da_banda boolean,
  avaliado_em date not null default current_date,
  unique (company_id, mes_alvo, motor)
);
```

RLS `is_company_member` nas duas, escrita por `service_role`.

**Arquivo novo:** `_shared/analytics/acuracia.ts` com `wape()` e `avaliarMes()`,
funções puras.

**Quem avalia:** o job diário que já existe (`smart-alerts` ou `agent-runner`),
comparando snapshots cujo mês alvo fechou. Sem edge function nova, sem cron novo.

**O que a tela ganha:** "errou 8% nos últimos 3 meses" ao lado da projeção. É a
diferença entre confiar e torcer. Com base insuficiente, mostra "ainda medindo",
nunca um número inventado.

## Camada 4 · Recorrência alimentando o caixa

**Arquivo novo:** `supabase/functions/_shared/analytics/recompra.ts`

```ts
export interface ClientePadrao {
  contact_id: string; ticket_medio: number;
  intervalo_mediano: number; desvio_intervalo: number; ultima_compra: string;
}
export function probabilidadeCompraNoMes(c: ClientePadrao, mesAlvo: string, hoje: Date): number
export function entradaEsperada(clientes: ClientePadrao[], mesAlvo: string, hoje: Date): number
```

- Probabilidade por densidade acumulada em torno do intervalo mediano, limitada a
  [0, 0.95]: nunca 100%, porque cliente nenhum é certo.
- Cliente já `perdido` (mais de 2 ciclos) entra com peso zero, alinhado ao status
  que a view já calcula.

**Integração conservadora, e é aqui que mora o risco:** a entrada esperada
**não se soma** ao contratado nem à média. Ela entra como um terceiro candidato
no `Math.max` já existente:

```ts
const receita = Math.max(contratadoEntrada, doModelo?.receita ?? receitaBase, esperadoRecompra ?? 0);
```

Assim o número nunca infla por dupla contagem, que é o erro clássico. E vira um
campo próprio (`esperado_recompra?`) para a tela poder dizer de onde veio.

## Camada 5 · Recompra mais robusta (melhora o que existe)

A view atual usa `(última − primeira) / (n − 1)`. Uma compra atípica desloca o
intervalo de todo mundo.

**Migration nova** (não altera a view atual, cria uma ao lado):
`v_recompra_robusta`, com `percentile_cont(0.5)` sobre os intervalos reais entre
compras consecutivas, mais o desvio, mais `n_intervalos`.

A tela passa a ler a nova quando há 3 ou mais intervalos, e a antiga abaixo
disso. A view antiga **continua existindo e funcionando**: nada que a consome
quebra.

## Passo a passo, na ordem que reduz risco

| # | Entrega | Depende de | Risco |
|---|---|---|---|
| 1 | `analytics/incerteza.ts` + testes (puro, sem integrar) | nada | nenhum |
| 2 | `analytics/sazonalidade.ts` + testes (puro) | nada | nenhum |
| 3 | `analytics/acuracia.ts` + testes (puro) | nada | nenhum |
| 4 | `analytics/recompra.ts` + testes (puro) | nada | nenhum |
| 5 | Campos opcionais em `MesProjetado` + params opcionais em `projetarCaixa` | 1, 2, 4 | baixo |
| 6 | Migration de snapshots e acurácia | nada | baixo |
| 7 | `ai-forecast` grava snapshot e usa as camadas | 5, 6 | médio |
| 8 | Avaliação de acurácia no job diário | 6, 7 | baixo |
| 9 | View `v_recompra_robusta` + leitura na tela | nada | baixo |
| 10 | UI: banda, acurácia e origem da receita | 5, 7, 8 | baixo |

Os passos 1 a 4 são **funções puras testadas antes de qualquer integração**. Se o
plano parar no 4, nada mudou no produto e nada quebrou.

## Arquivos

```
supabase/functions/_shared/analytics/incerteza.ts        novo
supabase/functions/_shared/analytics/sazonalidade.ts     novo
supabase/functions/_shared/analytics/acuracia.ts         novo
supabase/functions/_shared/analytics/recompra.ts         novo
supabase/functions/_shared/forecast.ts                   altera (só params/campos OPCIONAIS)
supabase/functions/ai-forecast/index.ts                  altera (usa as camadas, grava snapshot)
supabase/functions/smart-alerts/index.ts                 altera (avalia acurácia vencida)
supabase/migrations/20260820100000_forecast_accuracy.sql novo
supabase/migrations/20260820110000_recompra_robusta.sql  novo
src/test/analytics-*.test.ts                             novos
src/pages/CashFlowForecast.tsx                           altera (banda + acurácia)
src/pages/RecorrenciaRecompra.tsx                        altera (intervalo robusto)
```

## Testes e validação

**Unitários (a maior parte do valor):**
- `incerteza`: banda abre com o horizonte; menos de 6 meses devolve `null`; p10 < p50 < p90 sempre.
- `sazonalidade`: dezembro atípico único não vira fator (mediana protege); menos de 24 meses devolve `null`; fatores ficam dentro de [0.5, 2].
- `acuracia`: WAPE com denominador zero não estoura; erro conhecido de mesa bate.
- `recompra`: probabilidade nunca passa de 0.95; cliente perdido pesa zero; intervalo mediano ignora outlier que a média captura.

**Teste de não regressão (o mais importante do plano):**
`projetarCaixa` chamado com a assinatura antiga, sem nenhum parâmetro novo,
produz **exatamente** o mesmo resultado de hoje. Congelar a saída atual num
fixture e comparar. Se esse teste passar, a promessa de não quebrar está provada,
não afirmada.

**Contábil:**
- Soma das entradas previstas não pode exceder contratado + esperado + estimado (anti dupla contagem).
- Saldo projetado do mês N confere com saldo N-1 + receita − despesa.

**Verificação viva:** rodar o `ai-forecast` na empresa demo antes e depois; o
número da projeção só pode mudar quando uma camada nova estiver ativa, e a
resposta precisa dizer qual motor usou.

## Riscos e tradeoffs

**Dupla contagem entre recompra e contratado.** É o risco número um. Mitigado
pelo `Math.max` em vez de soma, e por um teste dedicado com o caso do cliente que
tem recebível cadastrado E padrão de recompra: ele não pode contar duas vezes.

**Sazonalidade com pouco histórico.** Um único dezembro vira "regra" e distorce.
Mitigado pelo mínimo de 24 meses e pela mediana.

**Banda passar falsa precisão.** P10/P90 de 6 meses de histórico é grosseiro.
Mitigado exibindo o número de observações junto, e a acurácia medida ao lado.

**Complexidade.** São 4 módulos e 2 migrations. Mitigado por serem puros,
independentes e integrados só no passo 5 em diante.

**O que este plano NÃO faz:** não troca o TimesFM, não mexe em DRE, contábil,
reforma tributária ou conciliação. A camada é de previsão, e só.

## Questões em aberto

1. Guardar snapshot de toda execução ou só um por dia por empresa? O `unique`
   proposto é por dia, para não inflar a tabela com refresh de tela.
2. A entrada esperada por recompra deve aparecer para o usuário como linha
   própria na projeção, ou só compor o número? Recomendação: linha própria, senão
   o número muda e ninguém sabe por quê.
3. Acurácia por motor separada (TimesFM x sazonal x estatístico) permite provar
   qual é melhor **naquela empresa**. Custa uma coluna e vale muito: fica no
   plano como implementado.
