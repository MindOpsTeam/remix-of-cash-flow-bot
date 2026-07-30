import { Building2, Check, ChevronsUpDown, Layers } from "lucide-react";
import { useCompany } from "@/hooks/useCompany";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function formatCNPJ(digits: string | null): string {
  if (!digits) return "sem CNPJ";
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

export function CompanyScopeSwitcher() {
  const { companies, scope, setScope, loading } = useCompany();

  if (loading || companies.length === 0) return null;

  const isCombined = scope === "all";
  const active = companies.find((c) => c.id === scope);

  const label = isCombined
    ? `Visão combinada · ${companies.length} ${companies.length === 1 ? "CNPJ" : "CNPJs"}`
    : active?.name ?? "Empresa";

  // Com apenas 1 empresa não há o que alternar.
  const singleCompany = companies.length === 1;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-2 text-sm font-medium text-foreground shadow-[inset_0_1px_0_var(--via-edge-hi)] transition-all duration-150 hover:border-primary/25 hover:shadow-card disabled:opacity-70"
        disabled={singleCompany}
      >
        {isCombined ? (
          <Layers className="h-4 w-4 text-primary" />
        ) : (
          <Building2 className="h-4 w-4 text-primary" />
        )}
        <span className="max-w-[180px] truncate">{label}</span>
        {!singleCompany && <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 rounded-lg border-border/80 shadow-dropdown">
        <DropdownMenuLabel className="text-xs text-muted-foreground">Escopo do painel</DropdownMenuLabel>

        <DropdownMenuItem onClick={() => setScope("all")} className="gap-2">
          <Layers className="h-4 w-4 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">Visão combinada</p>
            <p className="text-xs text-muted-foreground">Todos os {companies.length} CNPJs somados</p>
          </div>
          {isCombined && <Check className="h-4 w-4 text-primary" />}
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs text-muted-foreground">Empresas (CNPJ)</DropdownMenuLabel>

        {companies.map((c) => (
          <DropdownMenuItem key={c.id} onClick={() => setScope(c.id)} className="gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{c.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {c.orgId} · {formatCNPJ(c.cnpj)}
              </p>
            </div>
            {scope === c.id && <Check className="h-4 w-4 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
