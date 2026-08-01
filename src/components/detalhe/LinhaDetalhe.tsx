import type { ReactNode, KeyboardEvent } from "react";
import { useDetalhe } from "./DetalheProvider";
import type { TipoRegistro } from "@/lib/detalhe-registro";

/**
 * Linha de tabela que abre o detalhe do registro.
 *
 * Acessível de propósito: vira `button` para leitor de tela, responde a Enter e
 * Espaço e mostra foco visível. Cliques em botões/links dentro da linha seguem
 * funcionando normalmente (o handler ignora quando o alvo é interativo).
 */
export function LinhaDetalhe({
  tipo,
  id,
  children,
  className = "",
}: {
  tipo: TipoRegistro;
  id: string;
  children: ReactNode;
  className?: string;
}) {
  const { abrirDetalhe } = useDetalhe();

  // Cuidado: a própria linha tem role="button"; sem excluir currentTarget o
  // closest() encontraria a si mesma e cancelaria todo clique.
  const alvoEhInterativo = (e: { target: unknown; currentTarget: unknown }) => {
    const el = e.target as HTMLElement | null;
    const interativo = el?.closest?.("button, a, input, select, textarea, [role='button'], [data-sem-detalhe]");
    return !!interativo && interativo !== e.currentTarget;
  };

  const abrir = () => abrirDetalhe({ tipo, id });

  return (
    <tr
      role="button"
      tabIndex={0}
      aria-label="Abrir detalhes do registro"
      onClick={(e) => {
        if (alvoEhInterativo(e)) return;
        abrir();
      }}
      onKeyDown={(e: KeyboardEvent<HTMLTableRowElement>) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        if (alvoEhInterativo(e)) return;
        e.preventDefault();
        abrir();
      }}
      className={`cursor-pointer transition-colors hover:bg-muted/50 focus:outline-none focus-visible:bg-muted/60 focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-primary/40 ${className}`}
    >
      {children}
    </tr>
  );
}

/**
 * Versão para cartões, itens de lista e pontos de gráfico — qualquer superfície
 * que não seja `<tr>`.
 */
export function BlocoDetalhe({
  tipo,
  id,
  children,
  className = "",
  titulo = "Abrir detalhes",
}: {
  tipo: TipoRegistro;
  id: string;
  children: ReactNode;
  className?: string;
  titulo?: string;
}) {
  const { abrirDetalhe } = useDetalhe();
  return (
    <button
      type="button"
      title={titulo}
      onClick={() => abrirDetalhe({ tipo, id })}
      className={`w-full cursor-pointer text-left transition-colors hover:bg-muted/40 focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/40 ${className}`}
    >
      {children}
    </button>
  );
}
