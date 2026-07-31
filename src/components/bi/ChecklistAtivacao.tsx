import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Circle, Rocket, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { useBankConnections } from "@/hooks/useBankConnections";

/**
 * Checklist de ativação: os 4 passos que separam cadastro de uso. Persistente
 * no topo do cockpit até completar; some sozinho quando os 4 fecham. A régua
 * de cada passo lê dado real — nunca "marcado como visto".
 */

interface Passo {
  chave: string;
  titulo: string;
  feito: boolean;
  to: string;
  cta: string;
}

type CountFrom = (table: string) => {
  select: (q: string, o: { count: "exact"; head: true }) => {
    eq: (c: string, v: string) => PromiseLike<{ count: number | null }> & {
      eq: (c2: string, v2: boolean | string) => PromiseLike<{ count: number | null }>;
    };
  };
};

export function ChecklistAtivacao() {
  const { company, companies, scope } = useCompany();
  const { connections } = useBankConnections();
  const holder = scope === "all" ? companies[0]?.id : company?.id;

  const dados = useQuery({
    queryKey: ["ativacao", holder],
    enabled: !!holder,
    staleTime: 60_000,
    queryFn: async () => {
      const from = supabase.from as unknown as CountFrom;
      const [lanc, metas, agentes, caConfig] = await Promise.all([
        from("transactions").select("id", { count: "exact", head: true }).eq("company_id", holder!).eq("status", "confirmed"),
        from("kpi_metas").select("id", { count: "exact", head: true }).eq("company_id", holder!),
        from("agent_instances").select("id", { count: "exact", head: true }).eq("company_id", holder!).eq("ativo", true),
        from("contaazul_config").select("id", { count: "exact", head: true }).eq("company_id", holder!),
      ]);
      return {
        lancamentos: lanc.count ?? 0,
        metas: metas.count ?? 0,
        agentes: agentes.count ?? 0,
        contaazul: (caConfig.count ?? 0) > 0,
      };
    },
  });

  if (!dados.data) return null;

  const passos: Passo[] = [
    {
      chave: "dados",
      titulo: "Conecte o banco ou importe do Conta Azul",
      feito: connections.length > 0 || dados.data.contaazul,
      to: "/settings/bank-accounts",
      cta: "Conectar",
    },
    {
      chave: "lancamento",
      titulo: "Tenha o primeiro lançamento confirmado",
      feito: dados.data.lancamentos > 0,
      to: "/bank-inbox",
      cta: "Revisar extrato",
    },
    {
      chave: "meta",
      titulo: "Defina uma meta no cockpit",
      feito: dados.data.metas > 0,
      to: "/dashboard",
      cta: "Definir",
    },
    {
      chave: "agente",
      titulo: "Ative um agente para vigiar por você",
      feito: dados.data.agentes > 0,
      to: "/agents",
      cta: "Ativar",
    },
  ];

  const feitos = passos.filter((p) => p.feito).length;
  if (feitos === passos.length) return null;

  return (
    <div className="mb-6 rounded-lg border border-primary/20 bg-primary/[0.04] p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Rocket className="h-4 w-4 text-primary" /> Coloque o FinanceAI para trabalhar
        </p>
        <span className="font-mono text-xs text-muted-foreground">{feitos}/4</span>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {passos.map((p) =>
          p.feito ? (
            <div key={p.chave} className="flex items-center gap-2 rounded-md border border-border/60 bg-card/60 px-3 py-2 opacity-70">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-[hsl(var(--success))]" />
              <span className="text-xs text-muted-foreground line-through">{p.titulo}</span>
            </div>
          ) : (
            <Link
              key={p.chave}
              to={p.to}
              className="group flex items-center justify-between gap-2 rounded-md border border-border bg-card px-3 py-2 transition-colors hover:border-primary/30"
            >
              <span className="flex items-center gap-2">
                <Circle className="h-4 w-4 shrink-0 text-muted-foreground/50" />
                <span className="text-xs font-medium text-foreground">{p.titulo}</span>
              </span>
              <span className="flex shrink-0 items-center gap-1 text-[11px] font-medium text-primary">
                {p.cta}
                <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          ),
        )}
      </div>
    </div>
  );
}
