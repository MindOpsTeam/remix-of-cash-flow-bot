import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Compass, Sparkles, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  DEMO_TOUR_DISMISSED_KEY,
  DEMO_TOUR_STEP_KEY,
  PASSOS_DO_TOUR,
} from "@/lib/demo";

function lerPasso(): number {
  const bruto = Number(sessionStorage.getItem(DEMO_TOUR_STEP_KEY));
  if (!Number.isInteger(bruto)) return 0;
  return Math.min(Math.max(bruto, 0), PASSOS_DO_TOUR.length - 1);
}

/**
 * Barra fixa que conduz a demonstração guiada. Cada "Continuar" navega para a
 * rota do próximo passo; a posição sobrevive a reload via sessionStorage. O
 * último passo troca o avanço por um CTA que encerra a sessão demo e leva ao
 * cadastro.
 */
export function DemoTour() {
  const navigate = useNavigate();
  const [passo, setPasso] = useState(lerPasso);
  const [oculto, setOculto] = useState(
    () => sessionStorage.getItem(DEMO_TOUR_DISMISSED_KEY) === "1",
  );
  const [saindo, setSaindo] = useState(false);

  const atual = PASSOS_DO_TOUR[passo];
  const ultimo = passo === PASSOS_DO_TOUR.length - 1;

  const irPara = (proximo: number) => {
    const alvo = Math.min(Math.max(proximo, 0), PASSOS_DO_TOUR.length - 1);
    // Síncrono de propósito: cada rota monta o próprio AppLayout, então este
    // componente desmonta na navegação e um useEffect nunca chegaria a rodar.
    sessionStorage.setItem(DEMO_TOUR_STEP_KEY, String(alvo));
    setPasso(alvo);
    navigate(PASSOS_DO_TOUR[alvo].rota);
  };

  const criarConta = async () => {
    setSaindo(true);
    sessionStorage.removeItem(DEMO_TOUR_STEP_KEY);
    sessionStorage.removeItem(DEMO_TOUR_DISMISSED_KEY);
    await supabase.auth.signOut();
    window.location.assign("/");
  };

  if (oculto) {
    return (
      <button
        type="button"
        onClick={() => {
          sessionStorage.removeItem(DEMO_TOUR_DISMISSED_KEY);
          setOculto(false);
          navigate(atual.rota);
        }}
        className="fixed bottom-5 left-5 z-40 flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-lg transition-all duration-150 hover:bg-muted"
      >
        <Compass className="h-4 w-4 text-primary" aria-hidden="true" />
        Retomar tour
      </button>
    );
  }

  return (
    <aside
      aria-label="Tour da demonstração"
      className="fixed inset-x-0 bottom-0 z-40 px-3 pb-3 sm:px-5 sm:pb-5"
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 rounded-2xl border border-border bg-card/95 p-4 shadow-2xl backdrop-blur sm:flex-row sm:items-center sm:gap-5 sm:p-5">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Passo {passo + 1} de {PASSOS_DO_TOUR.length}
            </p>
            <p className="mt-0.5 text-sm font-semibold text-foreground">{atual.titulo}</p>
            <p className="mt-1 text-[13px] leading-5 text-muted-foreground">{atual.texto}</p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 self-end sm:self-center">
          {passo > 0 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => irPara(passo - 1)}
              aria-label="Passo anterior"
            >
              <ArrowLeft aria-hidden="true" />
              Anterior
            </Button>
          ) : null}
          {ultimo ? (
            <Button type="button" size="sm" onClick={criarConta} disabled={saindo}>
              {saindo ? "Saindo..." : "Criar minha conta grátis"}
              <ArrowRight aria-hidden="true" />
            </Button>
          ) : (
            <Button type="button" size="sm" onClick={() => irPara(passo + 1)}>
              Continuar
              <ArrowRight aria-hidden="true" />
            </Button>
          )}
          <button
            type="button"
            onClick={() => {
              sessionStorage.setItem(DEMO_TOUR_DISMISSED_KEY, "1");
              setOculto(true);
            }}
            className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Fechar tour"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </aside>
  );
}
