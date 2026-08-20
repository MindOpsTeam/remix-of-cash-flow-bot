import { useQuery } from "@tanstack/react-query";
import { Activity, CheckCircle2, AlertTriangle, XCircle, Clock, Loader2 } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { SomenteAdmin } from "@/components/auth/SomenteAdmin";

/**
 * As rotinas automáticas rodaram mesmo?
 *
 * O pg_cron dispara por `net.http_post`, que é assíncrono: ele marca o job como
 * "succeeded" mesmo quando a função devolve 500 ou nem carrega. Foi exatamente
 * assim que duas edge functions ficaram mortas em produção por semanas sem
 * ninguém ver, porque ninguém lê a resposta de um disparo que nunca volta.
 *
 * "Não respondeu" é o estado mais importante desta tela: é a ausência virando
 * sinal, em vez de virar silêncio.
 */

interface LinhaJob {
  jobname: string | null;
  schedule: string | null;
  active: boolean | null;
  ultimo_disparo: string | null;
  concluido_em: string | null;
  ok: boolean | null;
  erro: string | null;
  situacao: string | null;
}

const SITUACAO: Record<string, { rotulo: string; explicacao: string; classe: string; Icone: typeof CheckCircle2 }> = {
  ok: {
    rotulo: "Rodou",
    explicacao: "A rotina foi até o fim e reportou sucesso.",
    classe: "text-revenue",
    Icone: CheckCircle2,
  },
  falhou: {
    rotulo: "Falhou",
    explicacao: "A rotina respondeu, mas reportou erro.",
    classe: "text-[hsl(var(--destructive))]",
    Icone: XCircle,
  },
  "nao respondeu": {
    rotulo: "Não respondeu",
    explicacao: "O disparo saiu e a função nunca respondeu. É o sintoma de função fora do ar.",
    classe: "text-[hsl(var(--destructive))]",
    Icone: AlertTriangle,
  },
  "em execucao": {
    rotulo: "Em execução",
    explicacao: "Disparada há pouco, ainda rodando.",
    classe: "text-[hsl(var(--warning))]",
    Icone: Clock,
  },
  "nunca disparou": {
    rotulo: "Ainda não rodou",
    explicacao: "Agendada, mas o horário ainda não chegou desde a instalação.",
    classe: "text-muted-foreground",
    Icone: Clock,
  },
};

function quando(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR");
}

export default function SaudeDosJobs() {
  const { data: jobs = [], isLoading } = useQuery<LinhaJob[]>({
    queryKey: ["saude-jobs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("v_saude_jobs")
        .select("jobname, schedule, active, ultimo_disparo, concluido_em, ok, erro, situacao");
      if (error) throw error;
      return (data ?? []) as LinhaJob[];
    },
    refetchInterval: 60_000,
  });

  const comProblema = jobs.filter((j) => j.situacao === "falhou" || j.situacao === "nao respondeu");

  return (
    <SomenteAdmin>
      <AppLayout>
        <PageHeader
          title="Rotinas automáticas"
          description="Cobrança, sincronização bancária, alertas e impostos: o que rodou e o que não rodou"
          backTo="/settings"
        />

        {comProblema.length > 0 && (
          <div className="mb-4 flex items-start gap-3 rounded-lg border border-[hsl(var(--destructive))]/40 bg-[hsl(var(--destructive))]/[0.06] px-4 py-3">
            <AlertTriangle className="h-4 w-4 text-[hsl(var(--destructive))] mt-0.5 shrink-0" />
            <p className="text-sm text-foreground">
              {comProblema.length === 1
                ? "Uma rotina não está rodando."
                : `${comProblema.length} rotinas não estão rodando.`}{" "}
              Enquanto isso, os números que dependem delas param no tempo sem avisar.
            </p>
          </div>
        )}

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : jobs.length === 0 ? (
              <div className="py-12 text-center">
                <Activity className="h-7 w-7 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Nenhuma rotina agendada nesta instalação.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {jobs.map((j) => {
                  const s = SITUACAO[j.situacao ?? "nunca disparou"] ?? SITUACAO["nunca disparou"];
                  const { Icone } = s;
                  return (
                    <div key={j.jobname} className="flex items-start justify-between gap-4 px-4 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">{j.jobname}</p>
                        <p className="text-xs text-muted-foreground">
                          agenda <code className="font-mono">{j.schedule}</code> · último disparo{" "}
                          {quando(j.ultimo_disparo)}
                        </p>
                        {j.erro && <p className="text-xs text-[hsl(var(--destructive))] mt-1 break-words">{j.erro}</p>}
                        <p className="text-[11px] text-muted-foreground mt-0.5">{s.explicacao}</p>
                      </div>
                      <span className={`inline-flex shrink-0 items-center gap-1 text-xs ${s.classe}`}>
                        <Icone className="h-3.5 w-3.5" /> {s.rotulo}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </AppLayout>
    </SomenteAdmin>
  );
}
