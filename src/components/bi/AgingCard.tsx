import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { ChartPanel, ChartEmptyState } from "@/components/bi/ChartPanel";
import { formatCurrency } from "@/lib/utils";
import type { AgingBuckets } from "@/lib/metrics";

/**
 * Aging de recebíveis e contas a pagar em barras empilhadas. O bucket 30+ usa
 * o coral destrutivo de propósito: é o único que representa problema real.
 */
interface AgingCardProps {
  ar: AgingBuckets;
  ap: AgingBuckets;
}

const SEGMENTOS: Array<{ key: keyof Omit<AgingBuckets, "total">; label: string; cor: string }> = [
  { key: "aVencer", label: "A vencer", cor: "var(--via-data-2)" },
  { key: "ate15", label: "1–15 dias", cor: "var(--via-data-1)" },
  { key: "de16a30", label: "16–30 dias", cor: "var(--via-chart-4)" },
  { key: "acima30", label: "30+ dias", cor: "var(--via-coral)" },
];

function Barra({ titulo, buckets, to }: { titulo: string; buckets: AgingBuckets; to: string }) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between text-xs">
        <Link to={to} className="group flex items-center gap-1 font-medium text-foreground hover:underline">
          {titulo}
          <ArrowRight className="h-3 w-3 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
        </Link>
        <span className="font-mono font-semibold text-foreground">{formatCurrency(buckets.total)}</span>
      </div>
      <div className="flex h-3 w-full gap-px overflow-hidden rounded-sm bg-muted" role="img" aria-label={`${titulo}: ${formatCurrency(buckets.total)} em aberto`}>
        {SEGMENTOS.map(({ key, cor }) => {
          const pct = buckets.total > 0 ? (buckets[key] / buckets.total) * 100 : 0;
          if (pct === 0) return null;
          return <div key={key} style={{ width: `${pct}%`, background: cor }} />;
        })}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
        {SEGMENTOS.map(({ key, label, cor }) => (
          <div key={key} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: cor }} />
            <span className="truncate">{label}</span>
            <span className="ml-auto font-mono">{formatCurrency(buckets[key])}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AgingCard({ ar, ap }: AgingCardProps) {
  const vazio = ar.total === 0 && ap.total === 0;
  return (
    <ChartPanel
      title="Aberto por vencimento"
      description="Recebíveis e contas a pagar por faixa de atraso"
      delay={200}
    >
      {vazio ? (
        <ChartEmptyState
          title="Nada em aberto"
          description="Recebíveis e contas a pagar em aberto aparecem aqui por faixa de atraso."
          minHeight={180}
        />
      ) : (
        <div className="space-y-5">
          <Barra titulo="A receber" buckets={ar} to="/receivables" />
          <Barra titulo="A pagar" buckets={ap} to="/fiscal/contas-a-pagar" />
        </div>
      )}
    </ChartPanel>
  );
}
