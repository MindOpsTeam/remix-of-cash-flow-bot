import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AVISO_LINHA, MODAL_TITULO, PASSOS_DO_REMIX } from "@/lib/plataforma-avisos";
import { plataformaBloqueada } from "@/lib/rpc-plataforma";

/**
 * Estamos dentro do editor do Lovable (preview em iframe) e não no site publicado?
 *
 * É o que separa QUEM EDITA de quem compra. O site publicado é a vitrine
 * comercial e não pode ter tarja atravessada; o preview do editor é exatamente
 * onde a pessoa prestes a mandar um prompt está olhando. Um `try` porque acessar
 * `window.top` entre origens diferentes lança — e quando lança é porque HÁ um
 * pai de outra origem, ou seja, estamos no editor.
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
 * Faixa do projeto original: uma linha de chrome, não um alarme.
 *
 * A primeira versão era uma tarja larga, clara e semitransparente que quebrava
 * em duas linhas e deixava o conteúdo aparecer por baixo ao rolar. Numa tela que
 * também serve de demonstração guiada para prospect, isso custa mais do que
 * entrega: quem vê o produto pela primeira vez lê o erro antes do produto.
 *
 * Agora usa o mesmo azul da barra lateral, altura fixa de 36px, uma linha só e
 * fundo sólido. Lê como parte da moldura do app — igual às faixas de "staging"
 * de produto sério — em vez de um erro atravessado na cara do visitante.
 *
 * Só renderiza quando `plataforma_bloqueada()` é verdadeiro, isto é, só no banco
 * de origem. Num remix a função devolve falso porque o `system_identifier` do
 * cluster é outro, e a faixa some sozinha, sem ninguém rodar nada.
 */
export function FaixaProjetoOriginal() {
  const [aberto, setAberto] = useState(false);

  const { data: bloqueada } = useQuery({
    queryKey: ["plataforma-bloqueada-faixa"],
    queryFn: plataformaBloqueada,
    staleTime: 5 * 60_000,
  });

  if (!bloqueada || !dentroDoEditor()) return null;

  return (
    <>
      <div
        role="note"
        className="flex h-9 shrink-0 items-center justify-center gap-2.5 bg-sidebar px-4 text-sidebar-foreground"
      >
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full bg-[hsl(var(--warning))]"
          aria-hidden="true"
        />
        <span className="truncate text-[11px] font-medium tracking-[0.01em]">
          Projeto original · somente leitura
        </span>
        <button
          type="button"
          onClick={() => setAberto(true)}
          className="shrink-0 rounded text-[11px] font-medium text-sidebar-foreground/70 underline-offset-[3px] transition-colors hover:text-sidebar-foreground hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sidebar-foreground/40"
        >
          Como fazer o seu remix
        </button>
      </div>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-h-[86vh] overflow-y-auto sm:max-w-[620px]">
          <DialogHeader>
            <DialogTitle>{MODAL_TITULO}</DialogTitle>
            <DialogDescription>{AVISO_LINHA}</DialogDescription>
          </DialogHeader>

          <ol className="mt-2 space-y-6">
            {PASSOS_DO_REMIX.map((passo, i) => (
              <li key={passo.titulo} className="flex gap-3.5">
                <span
                  className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
                  aria-hidden="true"
                >
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">{passo.titulo}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{passo.detalhe}</p>
                  {passo.imagem ? (
                    <img
                      src={passo.imagem}
                      alt=""
                      width={passo.largura}
                      height={passo.altura}
                      loading="lazy"
                      decoding="async"
                      className="mt-3 h-auto w-full max-w-[360px] rounded-lg border border-border"
                    />
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        </DialogContent>
      </Dialog>
    </>
  );
}
