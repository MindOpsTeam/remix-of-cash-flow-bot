import { Link } from "react-router-dom";
import { Receipt, Lock, Bot, GaugeCircle, ArrowRight } from "lucide-react";
import { ChartPanel } from "@/components/bi/ChartPanel";
import { formatCurrency } from "@/lib/utils";
import type { CockpitData } from "@/hooks/useCockpit";

/**
 * O que exige providência agora: impostos chegando, fechamento aberto, ações
 * de agente esperando decisão e o ciclo de caixa. Cada linha leva para a tela
 * onde a providência acontece.
 */
interface RadarOperacionalCardProps {
  data: CockpitData;
  dsoDias: number | null;
  dpoDias: number | null;
}

function Linha({
  to,
  icon,
  titulo,
  valor,
  atencao = false,
}: {
  to: string;
  icon: React.ReactNode;
  titulo: string;
  valor: string;
  atencao?: boolean;
}) {
  return (
    <Link
      to={to}
      className="group flex items-center justify-between gap-3 rounded-md border border-border/70 px-3 py-2.5 transition-colors hover:bg-muted/40"
    >
      <span className="flex min-w-0 items-center gap-2.5">
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${
            atencao ? "bg-destructive/10 text-destructive" : "bg-muted/70 text-muted-foreground"
          }`}
        >
          {icon}
        </span>
        <span className="truncate text-xs font-medium text-foreground">{titulo}</span>
      </span>
      <span className="flex shrink-0 items-center gap-1.5">
        <span className={`font-mono text-xs font-semibold ${atencao ? "text-destructive" : "text-foreground"}`}>
          {valor}
        </span>
        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

export function RadarOperacionalCard({ data, dsoDias, dpoDias }: RadarOperacionalCardProps) {
  const ciclo = dsoDias !== null && dpoDias !== null ? dsoDias - dpoDias : null;

  return (
    <ChartPanel
      title="Radar operacional"
      description="O que pede providência e o ritmo do ciclo de caixa"
      delay={250}
    >
      <div className="space-y-2">
        <Linha
          to="/fiscal/impostos"
          icon={<Receipt className="h-3.5 w-3.5" />}
          titulo="Impostos nos próximos 60 dias"
          valor={formatCurrency(data.impostos60d)}
          atencao={data.impostos60d > 0}
        />
        <Linha
          to="/close"
          icon={<Lock className="h-3.5 w-3.5" />}
          titulo="Fechamento do mês anterior"
          valor={data.fechamentoAnteriorAberto ? "aberto" : "fechado"}
          atencao={data.fechamentoAnteriorAberto}
        />
        <Linha
          to="/agents"
          icon={<Bot className="h-3.5 w-3.5" />}
          titulo="Ações dos agentes aguardando"
          valor={String(data.acoesPendentes)}
          atencao={data.acoesPendentes > 0}
        />
        <div className="flex items-center justify-between gap-3 rounded-md border border-border/70 px-3 py-2.5">
          <span className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted/70 text-muted-foreground">
              <GaugeCircle className="h-3.5 w-3.5" />
            </span>
            <span className="truncate text-xs font-medium text-foreground">Ciclo de caixa (DSO − DPO)</span>
          </span>
          <span className="shrink-0 font-mono text-xs font-semibold text-foreground">
            {ciclo === null
              ? "—"
              : `${ciclo.toFixed(0)} dias`}
          </span>
        </div>
        {dsoDias !== null && (
          <p className="px-1 text-[11px] text-muted-foreground">
            Você recebe em ~{dsoDias.toFixed(0)} dias{dpoDias !== null ? ` e paga em ~${dpoDias.toFixed(0)}` : ""}.
          </p>
        )}
      </div>
    </ChartPanel>
  );
}
