import { useEffect, useState } from "react";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Sparkles } from "lucide-react";
import { useCompany } from "@/hooks/useCompany";
import {
  integracoesPorCategoria, CATEGORIA_LABEL, progressoConfiguracao,
  type Integracao,
} from "@/lib/integracoes-catalogo";
import { carregarConfiguradas } from "@/lib/integracoes-io";
import { CardIntegracao, DialogIntegracao } from "./ConfiguracaoIntegracao";

/**
 * Central de configuração da plataforma: todas as chaves num lugar só, cada
 * uma com teste de conexão, salvamento e guia de "como obter". Tudo opcional
 * por design — o painel mostra o progresso sem cobrar conclusão.
 */
export function CentralDeConfiguracao({ compacto = false }: { compacto?: boolean }) {
  const { company } = useCompany();
  const [configuradas, setConfiguradas] = useState<string[]>([]);
  const [selecionada, setSelecionada] = useState<Integracao | null>(null);

  useEffect(() => {
    if (!company) return;
    let vivo = true;
    carregarConfiguradas(company.id).then((ids) => {
      if (vivo) setConfiguradas(ids);
    });
    return () => {
      vivo = false;
    };
  }, [company]);

  const progresso = progressoConfiguracao(configuradas);
  const grupos = integracoesPorCategoria();

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-border bg-muted/30 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
            <Sparkles className="h-4 w-4 text-primary" />
            {progresso.feitas === 0
              ? "Nenhuma integração ligada ainda — e está tudo bem"
              : `${progresso.feitas} de ${progresso.total} integrações ligadas`}
          </p>
          <span className="text-xs text-muted-foreground">{progresso.pct}%</span>
        </div>
        <Progress value={progresso.pct} className="mt-2 h-1.5" />
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          O FinanceAI funciona no manual desde o primeiro dia. Cada integração aqui é opcional e serve para
          tirar digitação da sua mão. Ligue na ordem que fizer sentido para o seu negócio.
        </p>
      </div>

      {grupos.map((grupo) => (
        <section key={grupo.categoria}>
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            {CATEGORIA_LABEL[grupo.categoria]}
          </h3>
          <div className={`grid gap-3 ${compacto ? "sm:grid-cols-2" : "sm:grid-cols-2 xl:grid-cols-3"}`}>
            {grupo.itens.map((integracao) => (
              <CardIntegracao
                key={integracao.id}
                integracao={integracao}
                configurada={configuradas.includes(integracao.id)}
                onConfigurar={() => setSelecionada(integracao)}
              />
            ))}
          </div>
        </section>
      ))}

      {progresso.feitas === progresso.total && progresso.total > 0 && (
        <p className="flex items-center gap-1.5 rounded-lg border border-[hsl(var(--success))]/30 bg-[hsl(var(--success))]/10 p-3 text-xs text-[hsl(var(--success))]">
          <CheckCircle2 className="h-4 w-4" />
          Plataforma toda configurada. Daqui para frente é só operar.
        </p>
      )}

      <DialogIntegracao
        integracao={selecionada}
        companyId={company?.id}
        aberto={!!selecionada}
        onFechar={() => setSelecionada(null)}
        onSalvou={(id) => setConfiguradas((p) => (p.includes(id) ? p : [...p, id]))}
      />
    </div>
  );
}
