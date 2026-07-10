import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2, XCircle, ArrowRight } from "lucide-react";
import { useCompany } from "@/hooks/useCompany";
import { reformaReadiness, REFORMA_2026 } from "@/lib/reforma";

/**
 * Card "Pronto para a Reforma" — mostra a prontidão CBS/IBS por empresa.
 * Some quando todas as empresas do grupo estão prontas.
 */
export function ReformaReadinessCard() {
  const { companies } = useCompany();

  const pendentes = companies
    .map((c) => ({
      company: c,
      readiness: reformaReadiness({
        regime: c.regimeTributario,
        cClassTribPadrao: c.cclasstribPadrao,
        emiteDocsComDestaque: true,
      }),
    }))
    .filter((r) => !r.readiness.pronto);

  if (pendentes.length === 0) return null;

  const deadline = new Date(`${REFORMA_2026.inicioRejeicao}T00:00:00-03:00`);
  const diasRestantes = Math.max(
    0,
    Math.ceil((deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
  );

  return (
    <div className="mb-6 rounded-lg border border-[hsl(var(--warning))]/40 bg-[hsl(var(--warning))]/5 p-5 animate-fade-in">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-[hsl(var(--warning))]" />
          <h2 className="font-semibold">Reforma Tributária — pendências de configuração</h2>
        </div>
        <span className="rounded-md bg-[hsl(var(--warning))]/15 px-2 py-0.5 text-xs font-medium text-[hsl(var(--warning))]">
          Rejeição de notas em {diasRestantes} dias (03/08/2026)
        </span>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        Desde 01/01/2026 os documentos fiscais devem destacar CBS e IBS (LC 214/2025).
        Complete a configuração para as emissões saírem com o destaque e garantir a dispensa
        de recolhimento do ano-teste.
      </p>
      <div className="space-y-3">
        {pendentes.map(({ company, readiness }) => (
          <div key={company.id} className="rounded-md border border-border bg-card p-3">
            <div className="mb-2 text-sm font-medium">{company.name}</div>
            <ul className="space-y-1">
              {readiness.items.map((item) => (
                <li key={item.key} className="flex items-center gap-2 text-sm">
                  {item.ok ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-[hsl(var(--success))]" />
                  ) : (
                    <XCircle className="h-4 w-4 shrink-0 text-[hsl(var(--destructive))]" />
                  )}
                  <span className={item.ok ? "text-muted-foreground" : ""}>{item.label}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mt-4">
        <Link
          to="/settings/company"
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          Configurar empresas <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
