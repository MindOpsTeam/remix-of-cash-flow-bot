import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, GitFork } from "lucide-react";
import { AVISO_LINHA, AVISO_TITULO, URL_COMO_REMIXAR } from "@/lib/plataforma-avisos";
import { plataformaBloqueada } from "@/lib/rpc-plataforma";

/**
 * Estamos dentro do editor do Lovable (preview em iframe) e não no site publicado?
 *
 * É o que separa QUEM EDITA de quem compra. O site publicado é a vitrine
 * comercial e não pode ter tarja de aviso atravessada; o preview do editor é
 * exatamente onde a pessoa que está prestes a mandar um prompt está olhando.
 * Um `try` porque acessar `window.top` entre origens diferentes pode lançar — e
 * quando lança é porque HÁ um pai de outra origem, ou seja, estamos no editor.
 */
function dentroDoEditor(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

/**
 * Faixa fixa avisando que este é o projeto original.
 *
 * Só renderiza quando `plataforma_bloqueada()` é verdadeiro — isto é, só no
 * banco de origem. Num remix a função devolve falso porque o `system_identifier`
 * do cluster é outro, e a faixa some sozinha, sem ninguém rodar nada. É por isso
 * que a condição mora no banco e não numa variável de ambiente: variável viaja
 * no remix, identificador de cluster não.
 *
 * A consulta não depende de sessão de propósito: quem está avaliando editar
 * costuma estar deslogado, e um aviso que só aparece depois do login não avisa
 * ninguém.
 */
export function FaixaProjetoOriginal() {
  const { data: bloqueada } = useQuery({
    queryKey: ["plataforma-bloqueada-faixa"],
    queryFn: plataformaBloqueada,
    staleTime: 5 * 60_000,
  });

  if (!bloqueada || !dentroDoEditor()) return null;

  return (
    <div
      role="alert"
      className="sticky top-0 z-50 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b-2 border-[hsl(var(--warning))] bg-[hsl(var(--warning))]/[0.16] px-4 py-2 text-center backdrop-blur"
    >
      <AlertTriangle className="h-4 w-4 shrink-0 text-[hsl(var(--warning))]" aria-hidden="true" />
      <span className="text-sm font-semibold text-foreground">{AVISO_TITULO}</span>
      <span className="text-xs leading-5 text-muted-foreground">{AVISO_LINHA}</span>
      <a
        href={URL_COMO_REMIXAR}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 rounded-md border border-[hsl(var(--warning))]/50 px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-[hsl(var(--warning))]/20"
      >
        <GitFork className="h-3.5 w-3.5" aria-hidden="true" />
        Como fazer o remix
      </a>
    </div>
  );
}
