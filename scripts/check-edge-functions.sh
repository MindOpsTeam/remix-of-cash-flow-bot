#!/usr/bin/env bash
# Type-check de TODA edge function.
#
# POR QUE ISTO EXISTE
# O `tsc -b` do projeto não olha para supabase/functions: são módulos Deno com
# import por URL. Uma function pode ficar com erro de sintaxe, subir no git,
# passar em 450 testes e só quebrar em produção quando alguém clica no botão.
# Aconteceu duas vezes: um import aninhado dentro de outro derrubou o Open
# Finance e o motor de agentes em silêncio, porque o cron chama por HTTP e
# nunca lê a resposta.
#
# NO_COLOR e código de saída, nunca grep na mensagem: a primeira versão deste
# script procurava "^error:" na saída, que vem com escape de cor ANSI na frente.
# O grep nunca casava e o gate reportava "tudo compila" com duas functions
# quebradas. Um verificador que mente é pior que não ter verificador.
set -uo pipefail
cd "$(dirname "$0")/.."
export NO_COLOR=1

falhas=0
for f in supabase/functions/*/index.ts; do
  if ! saida=$(deno check --no-lock "$f" 2>&1); then
    echo "QUEBRADA: $f"
    echo "$saida" | grep -i "error" | head -3
    falhas=$((falhas + 1))
  fi
done

if [ "$falhas" -gt 0 ]; then
  echo "edge functions com erro: $falhas"
  exit 1
fi
echo "todas as edge functions compilam"
