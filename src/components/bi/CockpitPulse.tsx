import { Landmark, Hourglass, Repeat2, AlertTriangle } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { CockpitData } from "@/hooks/useCockpit";

/**
 * A linha de pulso do cockpit: caixa, fôlego, recorrência e inadimplência.
 * Div, não article: os `article` do painel são reservados aos KPIs de margem
 * (o E2E conta por eles).
 */
interface CockpitPulseProps {
  data: CockpitData;
  burn: number;
  runway: number | null;
}

function Tile({
  label,
  valor,
  contexto,
  icon,
  tom = "default",
  delay,
}: {
  label: string;
  valor: string;
  contexto: string;
  icon: React.ReactNode;
  tom?: "default" | "positivo" | "negativo";
  delay: number;
}) {
  const tomClass =
    tom === "positivo" ? "text-revenue" : tom === "negativo" ? "text-expense" : "text-foreground";
  return (
    <div
      className="via-chart-panel animate-slide-up min-h-[118px] p-4 sm:p-5"
      style={{ animationDelay: `${delay}ms`, animationFillMode: "backwards" }}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <span className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">{label}</span>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted/70 text-muted-foreground">
          {icon}
        </div>
      </div>
      <p className={`font-mono text-[clamp(1.3rem,1.8vw,1.7rem)] font-semibold leading-none tracking-[-0.04em] ${tomClass}`}>
        {valor}
      </p>
      <p className="mt-2 text-[11px] text-muted-foreground">{contexto}</p>
    </div>
  );
}

export function CockpitPulse({ data, burn, runway }: CockpitPulseProps) {
  const runwayTexto =
    data.caixa === null ? "—" : runway === null ? "∞" : runway >= 24 ? "24+ meses" : `${runway.toFixed(1)} meses`;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Tile
        label="Caixa"
        valor={data.caixa === null ? "—" : formatCurrency(data.caixa)}
        contexto={data.caixa === null ? "Conecte um banco para apurar o saldo" : "Saldo somado das contas cadastradas"}
        icon={<Landmark className="h-4 w-4" />}
        delay={0}
      />
      <Tile
        label="Runway"
        valor={runwayTexto}
        contexto={
          data.caixa === null
            ? "Depende do saldo de caixa"
            : runway === null
              ? "Operação gera caixa no ritmo atual"
              : `Queima média de ${formatCurrency(burn)}/mês`
        }
        icon={<Hourglass className="h-4 w-4" />}
        tom={runway !== null && runway < 3 ? "negativo" : "default"}
        delay={50}
      />
      <Tile
        label="MRR"
        valor={formatCurrency(data.mrrMensal)}
        contexto="Contratos ativos mensalizados"
        icon={<Repeat2 className="h-4 w-4" />}
        delay={100}
      />
      <Tile
        label="Inadimplência"
        valor={`${data.inadimplenciaPct.toFixed(1)}%`}
        contexto={
          data.arAberto > 0
            ? `${formatCurrency(data.agingAR.ate15 + data.agingAR.de16a30 + data.agingAR.acima30)} vencidos de ${formatCurrency(data.arAberto)} em aberto`
            : "Nenhum recebível em aberto"
        }
        icon={<AlertTriangle className="h-4 w-4" />}
        tom={data.inadimplenciaPct > 15 ? "negativo" : data.inadimplenciaPct > 0 ? "default" : "positivo"}
        delay={150}
      />
    </div>
  );
}
