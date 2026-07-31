# Campanha de reativação — agosto/2026

Diagnóstico (dados de 30/07): a base tem 130+ empresas e **zero conexões
bancárias**. O funil morre antes do primeiro lançamento. O produto agora tem o
caminho pronto (onboarding pede o banco, checklist de ativação no cockpit,
caixa de entrada bancária); a campanha leva a base até ele.

**Lista curada**: `~/financeai-campanha-ativacao.csv` (fora do repo de
propósito — PII não entra no git). 35 contatos únicos em 2 segmentos:
- **A (empresa real, nunca lançou)**: ~28 empresas com nome/e-mail
  corporativo e zero lançamentos.
- **B (experimentou e parou)**: 7 empresas com 1 a 9 lançamentos, paradas.

**Disparo é decisão do Guilherme** (ação externa em massa): e-mail primeiro;
WhatsApp apenas para quem responder ou para o segmento B.

## Copy — Segmento A (nunca lançou)

Assunto: `Seu DRE montado sozinho em 2 minutos (de verdade)`

> Oi, {nome} — aqui é o Guilherme, do FinanceAI (Viver de IA).
>
> Você criou a conta da {empresa} e imagino que a correria não deixou você ir
> além. Justo. Então nós fomos: agora o FinanceAI conecta direto no seu banco
> via Open Finance (padrão regulado pelo Banco Central), puxa o extrato todo
> dia e a IA classifica cada lançamento. Você só revisa e o DRE aparece
> montado.
>
> Leva 2 minutos: entrar → Conectar banco → pronto. O sistema faz o resto e
> ainda te avisa no WhatsApp quando algo pedir atenção.
>
> {link}
>
> Se travar em qualquer passo, responde este e-mail que eu mesmo resolvo.

## Copy — Segmento B (experimentou e parou)

Assunto: `A parte chata que te fez parar não existe mais`

> Oi, {nome} — você chegou a lançar {n} movimentações da {empresa} no
> FinanceAI e parou. Aposto que foi a digitação.
>
> Ela acabou: conecte o banco uma vez (Open Finance, 2 minutos) e o extrato
> entra sozinho todo dia, já classificado pela IA. Seus {n} lançamentos
> continuam lá esperando.
>
> {link}

## Mecânica

1. Enviar segmento A na terça 09h, segmento B na quarta 09h (melhor janela B2B).
2. Follow-up único após 4 dias úteis para quem não abriu.
3. Métrica: empresas com 1+ conexão bancária em 30 dias (hoje: 0). Meta: 10.
4. O produto rastreia sozinho: o checklist do cockpit e `v_ativacao_empresa`
   mostram quem avançou; nenhum pixel novo é necessário.

## Pré-requisito técnico

Publish do frontend no Lovable ANTES do disparo (a base vai cair numa
interface antiga sem o caminho de ativação se o Publish não acontecer).
