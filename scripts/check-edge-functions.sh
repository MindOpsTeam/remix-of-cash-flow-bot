#!/usr/bin/env bash
# Type-check de TODA edge function.
#
# POR QUE ISTO EXISTE
# O `tsc -b` do projeto não olha para supabase/functions: são módulos Deno com
# import por URL. Uma function pode ficar com erro de sintaxe, subir no git,
# passar em centenas de testes e só quebrar em produção quando alguém clica no
# botão. Aconteceu duas vezes: um import aninhado dentro de outro derrubou o
# Open Finance e o motor de agentes em silêncio, porque o cron chama por HTTP e
# nunca lê a resposta.
#
# NO_COLOR e código de saída, nunca grep na mensagem: a primeira versão deste
# script procurava "^error:" na saída, que vem com escape de cor ANSI na frente.
# O grep nunca casava e o gate reportava "tudo compila" com duas functions
# quebradas. Um verificador que mente é pior que não ter verificador.
#
# ARQUIVOS GERADOS
# `mcp/index.ts` é escrito pelo Lovable e regenerado a cada sync: correções de
# tipo feitas à mão são desfeitas na próxima geração. Para eles vale a régua que
# de fato importa em produção: SyntaxError impede a função de bootar, erro de
# TIPO não, porque o runtime do Supabase não type-checa no deploy. Baixar a
# régua onde não temos controle é o que mantém o gate confiável no resto: um
# gate cronicamente vermelho é um gate que ninguém lê.
set -uo pipefail
cd "$(dirname "$0")/.."
export NO_COLOR=1

GERADAS=("supabase/functions/mcp/index.ts")

eh_gerada() {
  local alvo="$1"
  for g in "${GERADAS[@]}"; do [ "$alvo" = "$g" ] && return 0; done
  return 1
}

falhas=0
avisos=0
for f in supabase/functions/*/index.ts; do
  if saida=$(deno check --no-lock "$f" 2>&1); then continue; fi

  if eh_gerada "$f" && ! echo "$saida" | grep -q "SyntaxError"; then
    echo "AVISO (arquivo gerado, só erro de tipo): $f"
    avisos=$((avisos + 1))
    continue
  fi

  echo "QUEBRADA: $f"
  echo "$saida" | grep -i "error" | head -3
  falhas=$((falhas + 1))
done

if [ "$falhas" -gt 0 ]; then
  echo "edge functions com erro: $falhas"
  exit 1
fi
[ "$avisos" -gt 0 ] && echo "avisos em arquivo gerado: $avisos (não bloqueiam o deploy)"
echo "todas as edge functions bootam"
