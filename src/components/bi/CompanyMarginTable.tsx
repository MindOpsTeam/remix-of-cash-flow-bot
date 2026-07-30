import { formatCurrency } from "@/lib/utils";
import { formatPercent, marginTone, MARGIN_TONE_CLASS, companyColor, type CompanyMargin } from "@/lib/margin";
import { useCompany } from "@/hooks/useCompany";

interface CompanyMarginTableProps {
  data: CompanyMargin[];
}

function formatCNPJ(digits: string | null): string {
  if (!digits) return "—";
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

/** Ranking dos CNPJs por margem operacional — a leitura central do modo combinado. */
export function CompanyMarginTable({ data }: CompanyMarginTableProps) {
  const { setScope } = useCompany();

  return (
    <section className="via-chart-panel animate-slide-up min-w-0 p-5 sm:p-6" style={{ animationDelay: "400ms", animationFillMode: "backwards" }}>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-foreground">Desempenho detalhado</h2>
          <p className="mt-1 text-xs text-muted-foreground">Receita, estrutura de custos e margens por empresa</p>
        </div>
        <span className="text-[11px] text-muted-foreground">Clique em uma linha para abrir o CNPJ</span>
      </div>
      <div className="space-y-3 md:hidden">
        {data.map((row, index) => {
          const tone = marginTone(row.margemOperacional);
          const metrics = [
            { label: "Receita", value: formatCurrency(row.receita) },
            { label: "Custos", value: formatCurrency(row.custos) },
            { label: "Despesas", value: formatCurrency(row.despesas) },
            {
              label: "Resultado",
              value: formatCurrency(row.resultado),
              className: row.resultado < 0 ? "text-expense" : "text-foreground",
            },
            { label: "M. Bruta", value: formatPercent(row.margemBruta) },
            {
              label: "M. Operac.",
              value: formatPercent(row.margemOperacional),
              className: MARGIN_TONE_CLASS[tone],
            },
          ];

          return (
            <button
              key={row.companyId}
              type="button"
              onClick={() => setScope(row.companyId)}
              className="w-full rounded-md border border-border bg-muted/15 p-4 text-left transition-colors hover:bg-muted/35"
            >
              <div className="mb-4 flex items-start gap-2">
                <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: companyColor(index) }} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{row.name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{row.orgId} · {formatCNPJ(row.cnpj)}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                {metrics.map((metric) => (
                  <div key={metric.label}>
                    <p className="text-[10px] uppercase tracking-[0.06em] text-muted-foreground">{metric.label}</p>
                    <p className={`mt-1 font-mono text-xs font-semibold ${metric.className ?? "text-foreground"}`}>
                      {metric.value}
                    </p>
                  </div>
                ))}
              </div>
            </button>
          );
        })}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="pb-2 pr-3 font-medium">Empresa</th>
              <th className="pb-2 px-3 text-right font-medium">Receita</th>
              <th className="pb-2 px-3 text-right font-medium">Custos</th>
              <th className="pb-2 px-3 text-right font-medium">Despesas</th>
              <th className="pb-2 px-3 text-right font-medium">Resultado</th>
              <th className="pb-2 px-3 text-right font-medium">M. Bruta</th>
              <th className="pb-2 pl-3 text-right font-medium">M. Operac.</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, index) => {
              const tone = marginTone(row.margemOperacional);
              return (
                <tr
                  key={row.companyId}
                  onClick={() => setScope(row.companyId)}
                  className="cursor-pointer border-b border-border/50 transition-colors last:border-0 hover:bg-muted/40"
                >
                  <td className="py-2.5 pr-3">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: companyColor(index) }} />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">{row.name}</p>
                        <p className="truncate text-[11px] text-muted-foreground">{row.orgId} · {formatCNPJ(row.cnpj)}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 text-right font-mono text-xs">{formatCurrency(row.receita)}</td>
                  <td className="px-3 text-right font-mono text-xs text-muted-foreground">{formatCurrency(row.custos)}</td>
                  <td className="px-3 text-right font-mono text-xs text-muted-foreground">{formatCurrency(row.despesas)}</td>
                  <td className="px-3 text-right font-mono text-xs font-medium">{formatCurrency(row.resultado)}</td>
                  <td className="px-3 text-right font-mono text-xs">{formatPercent(row.margemBruta)}</td>
                  <td className={`pl-3 text-right font-mono text-xs font-semibold ${MARGIN_TONE_CLASS[tone]}`}>
                    {formatPercent(row.margemOperacional)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
