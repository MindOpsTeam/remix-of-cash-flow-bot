import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { DetalheRegistroDialog } from "./DetalheRegistroDialog";
import type { TipoRegistro } from "@/lib/detalhe-registro";

export interface ReferenciaRegistro {
  tipo: TipoRegistro;
  id: string;
  /** Rótulo opcional só para o botão de voltar da pilha. */
  rotulo?: string;
}

interface DetalheContexto {
  abrirDetalhe: (ref: ReferenciaRegistro) => void;
  fechar: () => void;
  voltar: () => void;
  pilha: ReferenciaRegistro[];
}

const Ctx = createContext<DetalheContexto | null>(null);

/**
 * Um único modal de detalhe para o app inteiro.
 *
 * Qualquer tabela, gráfico ou indicador chama `abrirDetalhe({ tipo, id })` e o
 * registro abre. Dentro do modal, os relacionados também são clicáveis: a
 * navegação empilha (lançamento → cliente → pedido) e o botão voltar desfaz um
 * passo. Nenhum caminho termina em beco sem saída.
 */
export function DetalheProvider({ children }: { children: ReactNode }) {
  const [pilha, setPilha] = useState<ReferenciaRegistro[]>([]);

  const abrirDetalhe = useCallback((ref: ReferenciaRegistro) => {
    setPilha((p) => {
      const topo = p[p.length - 1];
      if (topo && topo.tipo === ref.tipo && topo.id === ref.id) return p; // já aberto
      return [...p, ref];
    });
  }, []);

  const fechar = useCallback(() => setPilha([]), []);
  const voltar = useCallback(() => setPilha((p) => p.slice(0, -1)), []);

  const valor = useMemo(() => ({ abrirDetalhe, fechar, voltar, pilha }), [abrirDetalhe, fechar, voltar, pilha]);

  return (
    <Ctx.Provider value={valor}>
      {children}
      <DetalheRegistroDialog />
    </Ctx.Provider>
  );
}

/**
 * Acesso ao modal de detalhe. Fora do provider devolve no-op para o componente
 * continuar funcionando isolado (storybook, teste de unidade), em vez de quebrar.
 */
export function useDetalhe(): DetalheContexto {
  const ctx = useContext(Ctx);
  return (
    ctx ?? {
      abrirDetalhe: () => undefined,
      fechar: () => undefined,
      voltar: () => undefined,
      pilha: [],
    }
  );
}
