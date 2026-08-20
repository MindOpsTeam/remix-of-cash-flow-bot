# Verificação e alinhamento do que está no ar

Sua última mensagem veio vazia, então proponho o passo mais útil no ponto em que estamos:
validar o código atualmente sincronizado (HEAD `ede3a74`, árvore limpa) e colocar no ar o que
ainda estiver defasado.

## O que será feito

1. **Gates de qualidade** (somente leitura, sem alterar código)
   - Typecheck real do front: `npx tsc --noEmit -p tsconfig.app.json`
   - Type-check de todas as edge functions: `scripts/check-edge-functions.sh`
   - Suíte de testes: `vitest run`
   - Build de produção: `vite build`

2. **Relatório do resultado**
   - Lista objetiva do que passou e do que quebrou, com arquivo e linha.

3. **Correções (se algo quebrar)**
   - Apenas o mínimo para os gates passarem, sem refactor oportunista.

4. **Deploy das edge functions**
   - Deployar as functions cujo código mudou desde a última leva (incluindo as que dependem de
     `_shared/` alterado), depois de os gates passarem.
   - Sem migrations, sem mexer em secrets.

## Fora de escopo

- Nenhuma migration será aplicada ou reaplicada.
- Nenhum secret criado, alterado ou removido.
- Nenhuma mudança de UI ou de regra de negócio.

Se você preferir outro rumo (bug específico, feature nova, ou deploy de um commit determinado),
é só dizer o commit/tela e eu troco o plano.
