# Deployar as duas functions que faltaram

## Contexto

Nas últimas levas de deploy, `agent-runner` e `openfinance-sync` ficaram de fora: o
`import { getCronSecret }` estava aninhado dentro de outro bloco `import {`, quebrando o parse.

O código já sincronizado no projeto **não tem mais esse erro** — em ambos os arquivos o import
está numa linha própria, no topo (`agent-runner/index.ts:18` e `openfinance-sync/index.ts:22`).
Ou seja, as duas estão prontas para subir, mas nunca foram deployadas com as mudanças do Vault
(`_shared/cron.ts` e `_shared/segredos.ts`).

## O que fazer

1. Deployar `agent-runner`.
2. Deployar `openfinance-sync`.
3. Confirmar que ambas subiram sem erro de build e reportar o resultado.

Sem alteração de código, sem migrations, sem mexer em secrets.

## Risco

Baixo. São as mesmas versões já validadas nas demais 25 functions da mesma leva; se o build
falhar, o deploy é rejeitado e nada em produção muda.
