import { labelMesCurto, type PeriodoMode, type PeriodoSel, type PontoPeriodo } from "@/lib/periodo";

const MODES: { key: PeriodoMode; label: string }[] = [
  { key: "mes", label: "Mês" },
  { key: "intervalo", label: "Intervalo" },
  { key: "ano", label: "Ano" },
];

const selectClass =
  "h-8 rounded-md border border-border bg-background px-2 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40";

/**
 * Escolhe a janela do painel: um mês, um intervalo de meses ou o ano. Os meses
 * disponíveis vêm do próprio trend (12 meses já carregados), então trocar de
 * janela é instantâneo e não bate no backend.
 */
export function PeriodoSelector({
  trend,
  sel,
  onChange,
}: {
  trend: PontoPeriodo[];
  sel: PeriodoSel;
  onChange: (s: PeriodoSel) => void;
}) {
  const meses = trend.map((p) => p.key);
  const ultimo = meses[meses.length - 1];
  const anos = [...new Set(meses.map((k) => k.slice(0, 4)))];

  const trocarModo = (mode: PeriodoMode) => {
    if (mode === "mes") onChange({ mode: "mes", mesKey: ultimo });
    else if (mode === "ano") onChange({ mode: "ano", ano: anos[anos.length - 1] });
    else {
      const inicio = meses[Math.max(0, meses.length - 3)];
      onChange({ mode: "intervalo", inicioKey: inicio, fimKey: ultimo });
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div
        role="tablist"
        aria-label="Tipo de janela"
        className="inline-flex rounded-md border border-border bg-muted/60 p-0.5"
      >
        {MODES.map((m) => (
          <button
            key={m.key}
            type="button"
            role="tab"
            aria-selected={sel.mode === m.key}
            onClick={() => trocarModo(m.key)}
            className={`rounded-[5px] px-2.5 py-1 text-xs font-medium transition-colors ${
              sel.mode === m.key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {sel.mode === "mes" && (
        <select
          aria-label="Escolher mês"
          className={selectClass}
          value={sel.mesKey ?? ultimo}
          onChange={(e) => onChange({ mode: "mes", mesKey: e.target.value })}
        >
          {meses.map((k) => (
            <option key={k} value={k}>{labelMesCurto(k)}</option>
          ))}
        </select>
      )}

      {sel.mode === "intervalo" && (
        <div className="flex items-center gap-1.5">
          <select
            aria-label="Mês inicial"
            className={selectClass}
            value={sel.inicioKey ?? meses[0]}
            onChange={(e) => onChange({ ...sel, mode: "intervalo", inicioKey: e.target.value })}
          >
            {meses.map((k) => (
              <option key={k} value={k}>{labelMesCurto(k)}</option>
            ))}
          </select>
          <span className="text-xs text-muted-foreground">até</span>
          <select
            aria-label="Mês final"
            className={selectClass}
            value={sel.fimKey ?? ultimo}
            onChange={(e) => onChange({ ...sel, mode: "intervalo", fimKey: e.target.value })}
          >
            {meses.map((k) => (
              <option key={k} value={k}>{labelMesCurto(k)}</option>
            ))}
          </select>
        </div>
      )}

      {sel.mode === "ano" && (
        <select
          aria-label="Escolher ano"
          className={selectClass}
          value={sel.ano ?? anos[anos.length - 1]}
          onChange={(e) => onChange({ mode: "ano", ano: e.target.value })}
        >
          {anos.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      )}
    </div>
  );
}
