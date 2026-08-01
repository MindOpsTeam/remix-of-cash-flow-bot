import { mensagemDeErro } from "@/lib/erros";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Settings2, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import type { Json } from "@/integrations/supabase/types";

/**
 * Configuração dos agentes.
 *
 * Antes as regras eram constantes no código, iguais para as 131 empresas:
 * lembrar 3 dias antes, alertar acima de 3× a média, piso de R$ 500. Isso é
 * palpite nosso. Uma clínica cobra no dia do vencimento; uma indústria dá
 * quinze dias. "Fora da curva" para um é R$ 500, para outro é R$ 50 mil.
 *
 * Os padrões continuam os mesmos, mas agora são ponto de partida e não lei.
 */

interface ConfigCobranca {
  dias_antes: number;
  dias_depois: number[];
  valor_minimo: number;
  tom: "cordial" | "direto" | "formal";
  assinatura: string;
}

interface ConfigAnomalia {
  fator: number;
  valor_minimo: number;
  janela_dias: number;
  baseline_dias: number;
}

// Fonte única: os mesmos defaults que as edges executam (issue #28 — a cópia
// local já tinha começado a divergir; agora divergir é impossível).
import {
  PADRAO_COBRANCA as PADRAO_COBRANCA_SHARED,
  PADRAO_ANOMALIA as PADRAO_ANOMALIA_SHARED,
} from "../../../supabase/functions/_shared/agentes";

const PADRAO_COBRANCA: ConfigCobranca = PADRAO_COBRANCA_SHARED as ConfigCobranca;
const PADRAO_ANOMALIA: ConfigAnomalia = PADRAO_ANOMALIA_SHARED as ConfigAnomalia;

interface LinhaRegra {
  agent: string;
  ativo: boolean;
  config: Record<string, unknown> | null;
}

export function ConfiguracaoAgentes() {
  const { company } = useCompany();
  const qc = useQueryClient();
  const [aberto, setAberto] = useState(false);

  const { data: regras } = useQuery({
    queryKey: ["agent_rules", company?.id],
    enabled: !!company,
    queryFn: async () => {
      const { data } = await supabase
        .from("agent_rules")
        .select("agent, ativo, config")
        .eq("company_id", company!.id);
      return (data ?? []) as unknown as LinhaRegra[];
    },
  });

  const linha = (nome: string) => regras?.find((r) => r.agent === nome);

  const [cobrancaAtiva, setCobrancaAtiva] = useState(true);
  const [anomaliaAtiva, setAnomaliaAtiva] = useState(true);
  const [cobranca, setCobranca] = useState<ConfigCobranca>(PADRAO_COBRANCA);
  const [anomalia, setAnomalia] = useState<ConfigAnomalia>(PADRAO_ANOMALIA);

  // Só recarrega o formulário quando o diálogo abre: reescrever o estado a cada
  // refetch apagaria o que o usuário está digitando no meio da edição.
  useEffect(() => {
    if (!aberto || !regras) return;
    const c = linha("collections");
    const a = linha("anomalies");
    setCobrancaAtiva(c?.ativo ?? true);
    setAnomaliaAtiva(a?.ativo ?? true);
    setCobranca({ ...PADRAO_COBRANCA, ...((c?.config ?? {}) as Partial<ConfigCobranca>) });
    setAnomalia({ ...PADRAO_ANOMALIA, ...((a?.config ?? {}) as Partial<ConfigAnomalia>) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, regras]);

  const salvar = useMutation({
    mutationFn: async () => {
      // config é jsonb no banco. O cast para Json é o ponto onde a forma
      // tipada do formulário vira o documento solto que a coluna guarda.
      const linhas = [
        { company_id: company!.id, agent: "collections", ativo: cobrancaAtiva, config: cobranca as unknown as Json },
        { company_id: company!.id, agent: "anomalies", ativo: anomaliaAtiva, config: anomalia as unknown as Json },
      ];
      const { error } = await supabase
        .from("agent_rules")
        .upsert(linhas, { onConflict: "company_id,agent" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Regras salvas. Valem na próxima varredura dos agentes.");
      qc.invalidateQueries({ queryKey: ["agent_rules", company?.id] });
      setAberto(false);
    },
    onError: (e: Error) => toast.error("Não consegui salvar: " + mensagemDeErro(e)),
  });

  const diasDepoisTexto = cobranca.dias_depois.join(", ");

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings2 className="h-4 w-4" />
          Regras dos agentes
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Regras dos agentes</DialogTitle>
          <DialogDescription>
            Os agentes nunca enviam nada sozinhos. Aqui você define quando eles devem falar e com que régua.
          </DialogDescription>
        </DialogHeader>

        <section className="space-y-3 rounded-lg border border-border p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium">Cobrança</h3>
              <p className="text-xs text-muted-foreground">Lê o contas a receber e sugere a mensagem.</p>
            </div>
            <Switch checked={cobrancaAtiva} onCheckedChange={setCobrancaAtiva} aria-label="Ativar agente de cobrança" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="dias-antes" className="text-xs">Lembrar quantos dias antes</Label>
              <Input
                id="dias-antes" type="number" min={0} max={60} value={cobranca.dias_antes}
                onChange={(e) => setCobranca({ ...cobranca, dias_antes: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="valor-min-cob" className="text-xs">Valor mínimo para cobrar (R$)</Label>
              <Input
                id="valor-min-cob" type="number" min={0} value={cobranca.valor_minimo}
                onChange={(e) => setCobranca({ ...cobranca, valor_minimo: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="dias-depois" className="text-xs">Insistir em quais dias de atraso</Label>
            <Input
              id="dias-depois" value={diasDepoisTexto} placeholder="1, 7, 15"
              onChange={(e) =>
                setCobranca({
                  ...cobranca,
                  dias_depois: e.target.value
                    .split(",")
                    .map((d) => Number(d.trim()))
                    .filter((d) => Number.isFinite(d) && d > 0),
                })
              }
            />
            <p className="text-[11px] text-muted-foreground">
              Separe por vírgula. Deixe vazio para lembrar só antes do vencimento e no dia.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Tom da mensagem</Label>
              <Select
                value={cobranca.tom}
                onValueChange={(v) => setCobranca({ ...cobranca, tom: v as ConfigCobranca["tom"] })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cordial">Cordial</SelectItem>
                  <SelectItem value="direto">Direto</SelectItem>
                  <SelectItem value="formal">Formal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="assinatura" className="text-xs">Assinatura</Label>
              <Input
                id="assinatura" value={cobranca.assinatura} placeholder="Nome da empresa"
                onChange={(e) => setCobranca({ ...cobranca, assinatura: e.target.value })}
              />
            </div>
          </div>
        </section>

        <section className="space-y-3 rounded-lg border border-border p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium">Alertas de gasto fora da curva</h3>
              <p className="text-xs text-muted-foreground">Compara o lançamento novo com o histórico da conta.</p>
            </div>
            <Switch checked={anomaliaAtiva} onCheckedChange={setAnomaliaAtiva} aria-label="Ativar agente de alertas" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="fator" className="text-xs">Quantas vezes acima da média</Label>
              <Input
                id="fator" type="number" min={1.2} step={0.5} value={anomalia.fator}
                onChange={(e) => setAnomalia({ ...anomalia, fator: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="valor-min-anom" className="text-xs">Ignorar abaixo de (R$)</Label>
              <Input
                id="valor-min-anom" type="number" min={0} value={anomalia.valor_minimo}
                onChange={(e) => setAnomalia({ ...anomalia, valor_minimo: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="janela" className="text-xs">Janela examinada (dias)</Label>
              <Input
                id="janela" type="number" min={1} max={90} value={anomalia.janela_dias}
                onChange={(e) => setAnomalia({ ...anomalia, janela_dias: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="baseline" className="text-xs">Histórico de comparação (dias)</Label>
              <Input
                id="baseline" type="number" min={30} max={730} value={anomalia.baseline_dias}
                onChange={(e) => setAnomalia({ ...anomalia, baseline_dias: Number(e.target.value) })}
              />
            </div>
          </div>
        </section>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setAberto(false)}>Cancelar</Button>
          <Button onClick={() => salvar.mutate()} disabled={salvar.isPending} className="gap-2">
            {salvar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar regras
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
