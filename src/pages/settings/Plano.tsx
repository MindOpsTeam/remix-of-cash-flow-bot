import { useQuery } from "@tanstack/react-query";
import { Check, Crown, Minus } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { formatCurrency } from "@/lib/utils";

/**
 * Plano da empresa: o que está incluso e o caminho para subir. A régua vive
 * no banco (tabela plans + triggers de teto); esta tela só mostra e aponta.
 * Cobrança automática é decisão comercial — o CTA fala com o time.
 */

interface Plan {
  key: string;
  nome: string;
  preco_centavos: number;
  max_agentes: number;
  max_widgets: number;
  whatsapp: boolean;
  pdv: boolean;
  contaazul: boolean;
}

type PlansFrom = (table: string) => {
  select: (q: string) => { order: (c: string, o: { ascending: boolean }) => PromiseLike<{ data: unknown }> };
};

const LINHAS: Array<{ label: string; render: (p: Plan) => string | boolean }> = [
  { label: "Agentes de IA ativos", render: (p) => (p.max_agentes < 0 ? "Ilimitados" : String(p.max_agentes)) },
  { label: "Visões de BI personalizadas", render: (p) => (p.max_widgets < 0 ? "Ilimitadas" : String(p.max_widgets)) },
  { label: "Avisos por WhatsApp", render: (p) => p.whatsapp },
  { label: "Frente de caixa (PDV)", render: (p) => p.pdv },
  { label: "Importação Conta Azul", render: (p) => p.contaazul },
];

export default function Plano() {
  const { company } = useCompany();

  const planos = useQuery({
    queryKey: ["plans"],
    staleTime: 300_000,
    queryFn: async () => {
      const { data } = await (supabase.from as unknown as PlansFrom)("plans")
        .select("key, nome, preco_centavos, max_agentes, max_widgets, whatsapp, pdv, contaazul")
        .order("preco_centavos", { ascending: true });
      return (data ?? []) as Plan[];
    },
  });

  const atual = useQuery({
    queryKey: ["company_plan", company?.id],
    enabled: !!company,
    queryFn: async () => {
      const { data } = await supabase
        .from("companies")
        .select("plan_key" as never)
        .eq("id", company!.id)
        .maybeSingle();
      return ((data as { plan_key?: string } | null)?.plan_key ?? "trial") as string;
    },
  });

  const planKey = atual.data ?? "trial";

  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl">
        <div className="mb-6">
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-[-0.02em] text-foreground">
            <Crown className="h-6 w-6 text-primary" /> Plano
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {company?.name} está no plano{" "}
            <Badge variant="secondary">{planos.data?.find((p) => p.key === planKey)?.nome ?? planKey}</Badge>
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {(planos.data ?? []).map((p) => {
            const ehAtual = p.key === planKey;
            return (
              <div
                key={p.key}
                className={`flex flex-col rounded-lg border p-5 ${
                  ehAtual ? "border-primary/40 bg-primary/[0.04]" : "border-border bg-card"
                }`}
              >
                <div className="mb-1 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-foreground">{p.nome}</h2>
                  {ehAtual && <Badge>atual</Badge>}
                </div>
                <p className="mb-4 font-mono text-xl font-bold tracking-[-0.03em] text-foreground">
                  {p.preco_centavos === 0 ? "Grátis" : `${formatCurrency(p.preco_centavos / 100)}/mês`}
                </p>
                <ul className="mb-4 flex-1 space-y-2">
                  {LINHAS.map(({ label, render }) => {
                    const valor = render(p);
                    return (
                      <li key={label} className="flex items-start gap-2 text-xs text-muted-foreground">
                        {valor === false ? (
                          <Minus className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
                        ) : (
                          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[hsl(var(--success))]" />
                        )}
                        <span className={valor === false ? "line-through opacity-60" : ""}>
                          {label}
                          {typeof valor === "string" ? `: ${valor}` : ""}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                {!ehAtual && p.key !== "trial" && (
                  <Button asChild size="sm" variant={p.key === "pro" ? "default" : "outline"} className="w-full">
                    <a href={`mailto:tech@viverdeia.ai?subject=FinanceAI — mudar para o plano ${p.nome} (${company?.name ?? ""})`}>
                      Falar com o time
                    </a>
                  </Button>
                )}
              </div>
            );
          })}
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          Os limites valem no banco, não só na tela. A avaliação libera tudo; quando o plano muda, o sistema passa a
          aplicar os tetos automaticamente.
        </p>
      </div>
    </AppLayout>
  );
}
