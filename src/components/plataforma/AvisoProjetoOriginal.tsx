import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Compass, GitFork, Loader2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { useEntrarNaDemonstracao } from "@/hooks/useDemonstracao";
import { AVISO_LINHA, MODAL_TITULO, PASSOS_DO_REMIX } from "@/lib/plataforma-avisos";
import { demonstracaoDisponivel, plataformaBloqueada } from "@/lib/rpc-plataforma";
import wordmarkNavy from "@/assets/via/wordmark-navy.png";
import wordmarkWhite from "@/assets/via/wordmark-white.png";

/** Uma vez por aba: o aviso precisa ser visto, não repetido a cada clique. */
const CHAVE_JA_ABRIU = "financeai:aviso-original-visto";

/**
 * Estamos dentro do editor do Lovable (preview em iframe) e não no site publicado?
 *
 * É o que separa QUEM EDITA de quem compra. O site publicado é a vitrine
 * comercial e não pode receber um popup na cara; o preview do editor é
 * exatamente onde a pessoa prestes a mandar um prompt está olhando. Um `try`
 * porque acessar `window.top` entre origens diferentes lança — e quando lança é
 * porque HÁ um pai de outra origem, ou seja, estamos no editor.
 */
function dentroDoEditor(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

function jaAbriuNestaAba(): boolean {
  try {
    return sessionStorage.getItem(CHAVE_JA_ABRIU) === "1";
  } catch {
    // Navegação privada ou storage bloqueado: melhor abrir de novo do que
    // nunca abrir. O aviso é o produto aqui.
    return false;
  }
}

/**
 * Assinatura da Viver de IA no topo do modal.
 *
 * Este popup é a primeira coisa que um visitante vê do produto, e antes ele
 * aparecia órfão: um aviso branco sem dono, que podia ser de qualquer sistema.
 * A marca diz de quem é o template e por que a regra existe.
 *
 * Duas imagens em vez de um filtro CSS porque o wordmark é lettering, não ícone:
 * inverter cor com `invert` sujaria as bordas. O card do diálogo é branco no
 * tema claro e navy no escuro, então cada tema recebe o arquivo desenhado para
 * ele. `darkMode` aqui é seletor `[data-theme="dark"]`, o mesmo que o
 * ViaThemeToggle escreve.
 */
function Marca() {
  // `pr-7` abre espaço para o X do diálogo, que é absoluto no canto: sem isso o
  // rótulo da direita passa por baixo dele.
  return (
    <div className="mb-1 flex items-center justify-between gap-4 border-b border-border pb-4 pr-7">
      <img
        src={wordmarkNavy}
        alt="Viver de IA"
        width={373}
        height={31}
        className="h-4 w-auto dark:hidden"
      />
      <img
        src={wordmarkWhite}
        alt="Viver de IA"
        width={373}
        height={31}
        className="hidden h-4 w-auto dark:block"
      />
      <span className="shrink-0 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        FinanceAI
      </span>
    </div>
  );
}

function marcarComoVisto(): void {
  try {
    sessionStorage.setItem(CHAVE_JA_ABRIU, "1");
  } catch {
    /* sem storage o popup reabre na próxima navegação; é o lado seguro */
  }
}

/**
 * Aviso do projeto original: popup que abre sozinho, mais a tira que fica.
 *
 * Passou por duas versões antes desta, e as duas erraram para lados opostos.
 * A primeira era uma tarja larga, clara e semitransparente que quebrava em duas
 * linhas e deixava o conteúdo aparecer por baixo. A segunda, corrigindo o
 * exagero, virou uma tira de 36px tão discreta que ninguém via — e um aviso que
 * ninguém vê não é aviso, é decoração.
 *
 * O formato certo para esta mensagem é o de consentimento: abre por cima,
 * desfoca o que está atrás, e obriga uma escolha antes de seguir. Quem chega
 * aqui está numa de duas situações, e o popup oferece as duas saídas em vez de
 * só proibir:
 *
 *   - veio conhecer o produto  → "Ver demonstração guiada"
 *   - veio construir em cima   → "Fazer o meu remix", com o passo a passo
 *
 * Abre UMA vez por aba. Repetir a cada navegação transformaria o aviso em
 * obstáculo, e obstáculo se fecha no automático sem ler. Depois de fechado, a
 * tira fina continua no topo como lembrete e reabre o popup quando clicada.
 *
 * Tudo pendura em `plataforma_bloqueada()`: num remix a função devolve falso
 * porque o `system_identifier` do cluster é outro, e o cliente não vê nada
 * disto. É por isso que a condição mora no banco e não numa variável de
 * ambiente — variável viaja na cópia, identificador de cluster não.
 */
export function AvisoProjetoOriginal() {
  const [aberto, setAberto] = useState(false);
  const [vendoPassos, setVendoPassos] = useState(false);
  const { user } = useAuth();
  const { entrar, entrando } = useEntrarNaDemonstracao();

  const { data: bloqueada } = useQuery({
    queryKey: ["plataforma-bloqueada-aviso"],
    queryFn: plataformaBloqueada,
    staleTime: 5 * 60_000,
  });

  const ativo = Boolean(bloqueada) && dentroDoEditor();

  // A demonstração só é oferecida a quem ainda não entrou, e só onde ela existe
  // de fato: propor um login que vai falhar é pior do que não propor nada.
  const { data: temDemonstracao } = useQuery({
    queryKey: ["demonstracao-disponivel-aviso"],
    queryFn: demonstracaoDisponivel,
    enabled: ativo && !user,
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (!ativo || jaAbriuNestaAba()) return;
    setAberto(true);
    marcarComoVisto();
  }, [ativo]);

  if (!ativo) return null;

  function abrirNoAviso() {
    setVendoPassos(false);
    setAberto(true);
  }

  return (
    <>
      <div
        role="note"
        className="flex h-9 shrink-0 items-center justify-center gap-2.5 bg-sidebar px-4 text-sidebar-foreground"
      >
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-sidebar-foreground/70" aria-hidden="true" />
        <span className="truncate text-[11px] font-medium tracking-[0.01em]">
          Projeto original · somente leitura
        </span>
        <button
          type="button"
          onClick={abrirNoAviso}
          className="shrink-0 rounded text-[11px] font-medium text-sidebar-foreground/70 underline-offset-[3px] transition-colors hover:text-sidebar-foreground hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sidebar-foreground/40"
        >
          Entenda
        </button>
      </div>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent
          overlayClassName="bg-black/70 backdrop-blur-md"
          className="max-h-[86vh] overflow-y-auto sm:max-w-[580px]"
          // Sem isto o Radix foca o primeiro elemento tabulável e um dos dois
          // cartões nasce com anel de foco, parecendo já escolhido — inverte a
          // hierarquia que o desenho está tentando dizer. O foco vai para o
          // painel, que é tabulável, então o teclado continua funcionando.
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            (e.currentTarget as HTMLElement).focus();
          }}
        >
          <Marca />

          {vendoPassos ? (
            <>
              <DialogHeader>
                <button
                  type="button"
                  onClick={() => setVendoPassos(false)}
                  className="-ml-1 mb-1 inline-flex w-fit items-center gap-1.5 rounded text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                  Voltar
                </button>
                <DialogTitle>{MODAL_TITULO}</DialogTitle>
                <DialogDescription>
                  Leva cerca de dois minutos. A cópia é sua, e nela tudo destrava sozinho.
                </DialogDescription>
              </DialogHeader>

              <ol className="mt-1 space-y-6">
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
                          className="mt-3 h-auto w-full max-w-[420px] rounded-lg border border-border"
                        />
                      ) : null}
                    </div>
                  </li>
                ))}
              </ol>
            </>
          ) : (
            <>
              <DialogHeader>
                <span className="mb-2 inline-flex w-fit items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary-foreground">
                  <TriangleAlert className="h-3.5 w-3.5" aria-hidden="true" />
                  Projeto original
                </span>
                <DialogTitle className="text-[1.375rem] leading-tight">
                  Este projeto é somente leitura
                </DialogTitle>
                <DialogDescription>{AVISO_LINHA}</DialogDescription>
              </DialogHeader>

              <p className="text-sm leading-6 text-muted-foreground">
                Editar aqui não adianta: o banco recusa toda escrita, ninguém consegue criar conta e
                qualquer alteração feita neste projeto{" "}
                <strong className="font-semibold text-foreground">é revertida sem aviso</strong>. Escolha
                por onde seguir:
              </p>

              <div className="mt-1 grid gap-3">
                {!user && temDemonstracao ? (
                  <button
                    type="button"
                    onClick={entrar}
                    disabled={entrando}
                    className="group flex items-start gap-3.5 rounded-xl border border-primary/30 bg-primary/[0.06] p-4 text-left transition-all duration-150 hover:-translate-y-px hover:border-primary/50 hover:bg-primary/[0.1] disabled:pointer-events-none disabled:opacity-60"
                  >
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                      <Compass className="h-[18px] w-[18px]" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                        {entrando ? "Preparando demonstração..." : "Ver a demonstração guiada"}
                        {entrando ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                        ) : (
                          <ArrowRight
                            className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-0.5"
                            aria-hidden="true"
                          />
                        )}
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                        Percorra o produto com um roteiro, numa empresa fictícia de 3 CNPJs. Conta
                        compartilhada e somente leitura: nada é salvo.
                      </span>
                    </span>
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={() => setVendoPassos(true)}
                  className="group flex items-start gap-3.5 rounded-xl border border-border bg-card p-4 text-left transition-all duration-150 hover:-translate-y-px hover:border-primary/25 hover:bg-secondary"
                >
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary text-foreground">
                    <GitFork className="h-[18px] w-[18px]" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                      Fazer o meu remix
                      <ArrowRight
                        className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-0.5"
                        aria-hidden="true"
                      />
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                      Três passos, com o print de cada tela. Na sua cópia o cadastro abre, a primeira
                      conta vira administradora e você edita à vontade.
                    </span>
                  </span>
                </button>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setAberto(false)}
                className="mx-auto mt-1 w-fit text-xs text-muted-foreground"
              >
                Continuar só olhando
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
