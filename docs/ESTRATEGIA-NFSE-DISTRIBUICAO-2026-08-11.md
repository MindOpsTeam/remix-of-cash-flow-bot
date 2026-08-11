# Estratégia de emissão NFS-e num produto distribuído por remix (2026-08-11)

## O problema de modelo de negócio

O ERP é distribuído como **remix do Lovable**: cada cliente recebe uma cópia com **banco Supabase
próprio, não compartilhado**. A emissão de NFS-e via Ambiente Nacional exige um **worker Node** que
faz mTLS com o certificado A1 (não roda em edge/Deno). Isso colide com o modelo de distribuição:

1. **Um worker central do Guilherme** serviria todos → ele **paga a infra de todos** e passa a
   **guardar o certificado A1 de terceiros** (identidade jurídica de assinatura de cada cliente) —
   risco de custo e risco jurídico. Inaceitável.
2. **Cada cliente com o seu worker** mantém o isolamento e não onera o Guilherme, mas introduz
   **fricção de deploy** para um público PME/vibecoder.

Decisão do dono: **dar opções ao cliente** e adotar a **Via 1 (servidor próprio)** como a via
gratuita (notas ilimitadas, sem custo por nota) — motor de aquisição para a obrigatoriedade do
Simples (Res. CGSN 189/2026, 01/09/2026) — reduzindo a fricção com **deploy por botão**.

## Decisão

**Duas vias, escolhidas pelo cliente dentro do app** (Configurações → NFS-e → "Servidor de emissão"):

| | Via 1 — Servidor próprio | Via 2 — Provedor (SaaS) |
|---|---|---|
| Como emite | worker do cliente (Railway/Cloud Run) → SEFIN | PlugNotas / Focus NFe (REST) |
| Custo | ~US$5/mês de hospedagem, **notas ilimitadas** | **por nota** (sem servidor) |
| Certificado | fica no ambiente do cliente | guardado pelo provedor (com contrato) |
| Isolamento | total (worker + banco do cliente) | total (token por remix) |
| Fricção | deploy 1-clique + colar URL | só colar token do provedor |
| Alvo | quem emite volume; quer custo marginal zero | baixo volume; não quer manter servidor |

**Nenhuma via usa infra do Guilherme.** O modelo "worker central" está descartado.

## Via 1 por botão — a resposta à fricção

**Sim, dá para entregar por botão.** O `nfse-worker` foi publicado como repositório público
distribuível — **github.com/MindOpsTeam/nfse-worker** — com Dockerfile, `railway.json` (healthcheck
`/health`) e um botão **"Deploy on Railway"**. O template do Railway **gera a `NFSE_WORKER_API_KEY`
sozinho** (`${{ secret(32) }}`), então o cliente não digita chave.

Fluxo do cliente: **clicar no botão → login/criar conta Railway → deploy automático → gerar domínio →
colar a URL + a chave no app → "Testar servidor"**. ~3–5 min.

### A fricção residual honesta: cartão

O botão elimina a fricção **técnica**, não a de **billing**. A Railway **não tem mais free tier
persistente**; para o worker ficar de pé (emissão precisa responder na hora) é preciso o plano
**Hobby (~US$5/mês) com cartão**. Isso é intrínseco a "ter servidor próprio" — nenhum provedor
mantém serviço sempre-ligado de graça. Mitigações oferecidas:

- **Railway Hobby** (botão, ~US$5/mês) — recomendado, experiência mais simples.
- **Google Cloud Run** (scale-to-zero) — praticamente grátis no free tier para volume PME (paga só
  quando emite); cold start ~1–2s; setup mais técnico. `DEPLOY-CLOUDRUN.md` no repo.
- **Via 2 (provedor)** — para quem não quer manter servidor de forma alguma.

Ou seja: a "fricção" que sobra é uma **escolha comercial consciente** (US$5/mês de infra própria
vs. pagar por nota), exposta ao cliente — não um obstáculo técnico.

> Nota: por que a edge do Supabase não resolve sozinha? `Deno.createHttpClient({cert,key})` faz mTLS
> na linguagem, mas o Supabase Edge Runtime tem histórico de instabilidade com client certs (Deno
> antigo). Fica como spike futuro; se algum dia estabilizar, a Via 1 vira "sem servidor" de graça.

## Mudanças técnicas nesta entrega (git-first, aplicadas no app)

1. **Worker por empresa** (antes era um env global — incompatível com remix isolado):
   migration `..._nfse_via_por_empresa.sql` adiciona a `nfse_config` as colunas `nfse_via`
   (`worker_proprio` | `provedor`), `worker_url`, `worker_api_key` (aditivas, nulas → retrocompatível).
2. **Edge `nfse-proxy`** passa a resolver o worker **da empresa** (`config.worker_url`/`worker_api_key`),
   com fallback para o env antigo. Se não houver worker configurado, erro claro orientando a via.
3. **UI** (`NfseIntegration.tsx`): seletor de via + campos de URL/chave do worker + botão "Deploy do
   worker" (aponta pro repo público) + "Testar servidor" (bate em `/health`).

## Pendências (operacionais, do Guilherme)

- Publicar o **template Railway** a partir do repo público (1x, pela UI do Railway) para o botão do
  README resolver com a key auto-gerada. (A API de template exige projeto-modelo + billing ativo.)
- **Segurança (P1 da auditoria)**: `worker_api_key` e o certificado continuam em texto claro em
  `nfse_config` → migrar para Vault/pgsodium.
- Deploy da edge `nfse-proxy` atualizada e da UI (via sync do Lovable) e validação em **homologação**.

## Consequências

- O produto deixa de depender de qualquer infra do Guilherme para emitir. Escala por remix sem
  onerá-lo e sem ele custodiar certificados alheios.
- O worker vira um artefato open-source reutilizável (`MindOpsTeam/nfse-worker`).
- O cliente decide o trade-off custo-fixo (Via 1) vs custo-por-nota (Via 2) dentro do próprio app.
