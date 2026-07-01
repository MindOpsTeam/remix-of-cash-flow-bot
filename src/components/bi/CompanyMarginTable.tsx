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
    <div className="animate-slide-up rounded-lg border border-border bg-card p-5" style={{ animationDelay: "300ms", animationFillMode: "backwards" }}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Margem por CNPJ</h2>
        <span className="text-xs text-muted-foreground">Clique para abrir a visão individual</span>
      </div>
      <div className="overflow-x-auto">
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
    </div>
  );
}
