import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useCompany } from "@/hooks/useCompany";
import { supabase } from "@/integrations/supabase/client";

interface Achado {
  severidade: "erro" | "alerta";
  regra: string;
  descricao: string;
  quantidade: number;
  exemplo: string | null;
}

/**
 * Integridade da cadeia contábil: pedido → recebível → lançamento → conta →
 * centro de custo. O DRE continua "funcionando" com um elo partido, mostrando
 * número errado em silêncio — este painel é quem grita.
 */
export function IntegridadeContabilCard() {
  const { company } = useCompany();

  const { data: achados = [], isLoading } = useQuery<Achado[]>({
    queryKey: ["integridade-contabil", company?.id],
    enabled: !!company,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await (
        supabase.rpc as unknown as (n: string, a: Record<string, unknown>) => Promise<{ data: Achado[] | null; error: unknown }>
      )("auditar_integridade_contabil", { p_company_id: company!.id });
      if (error) throw error;
      return data ?? [];
    },
  });

  const erros = achados.filter((a) => a.severidade === "erro");
  const alertas = achados.filter((a) => a.severidade === "alerta");

  return (
    <Card>
      <CardContent className="p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Integridade contábil</h3>
          </div>
          {!isLoading && (
            <div className="flex items-center gap-1.5">
              {erros.length > 0 && (
                <Badge variant="outline" className="border-destructive/30 bg-destructive/10 text-[11px] text-destructive">
                  {erros.length} {erros.length === 1 ? "erro" : "erros"}
                </Badge>
              )}
              {alertas.length > 0 && (
                <Badge variant="outline" className="border-[hsl(var(--warning))]/30 bg-[hsl(var(--warning))]/10 text-[11px] text-[hsl(var(--warning))]">
                  {alertas.length} {alertas.length === 1 ? "alerta" : "alertas"}
                </Badge>
              )}
            </div>
          )}
        </div>

        <p className="mb-3 text-xs leading-5 text-muted-foreground">
          Confere se a cadeia fecha: pedido gera recebível, recebível vira lançamento, lançamento respeita a
          natureza da conta e o mês fechado continua fechado.
        </p>

        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : achados.length === 0 ? (
          <p className="flex items-center gap-2 rounded-md border border-[hsl(var(--success))]/30 bg-[hsl(var(--success))]/10 p-3 text-xs text-[hsl(var(--success))]">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Nenhuma inconsistência: a cadeia contábil está fechada.
          </p>
        ) : (
          <ul className="space-y-2">
            {achados.map((a) => (
              <li
                key={a.regra}
                className={`rounded-md border p-3 ${
                  a.severidade === "erro"
                    ? "border-destructive/25 bg-destructive/5"
                    : "border-[hsl(var(--warning))]/25 bg-[hsl(var(--warning))]/5"
                }`}
              >
                <div className="flex items-start gap-2">
                  <AlertTriangle
                    className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
                      a.severidade === "erro" ? "text-destructive" : "text-[hsl(var(--warning))]"
                    }`}
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground">
                      {a.descricao} <span className="font-mono opacity-70">({a.quantidade})</span>
                    </p>
                    {a.exemplo && (
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">Ex.: {a.exemplo}</p>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
