import { mensagemDeErro } from "@/lib/erros";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bot, Loader2, Play, Settings2, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useSomenteLeitura } from "@/hooks/useSomenteLeitura";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import {
  TEMPLATES_AGENTES,
  type TemplateAgente,
} from "../../../supabase/functions/_shared/templates-agentes";

/**
 * Galeria de agentes ativáveis. Cada template do catálogo (fonte única em
 * _shared/templates-agentes.ts, o mesmo arquivo que o runner executa) vira um
 * card: ativar cria a instância com defaults; configurar edita config e
 * canais. Os agentes nativos (cobrança/anomalia) seguem no diálogo próprio.
 */

export interface AgentInstance {
  id: string;
  template_key: string;
  nome: string;
  ativo: boolean;
  config: Record<string, unknown>;
  canais: { inapp?: boolean; whatsapp?: boolean };
  last_run_at: string | null;
  last_result: { avisos?: number; enviados?: number } | null;
}

type InstancesFrom = (table: string) => {
  select: (q: string) => {
    eq: (c: string, v: string) => {
      order: (c: string, o: { ascending: boolean }) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
    };
  };
  insert: (row: Record<string, unknown>) => PromiseLike<{ error: { message: string } | null }>;
  update: (patch: Record<string, unknown>) => {
    eq: (c: string, v: string) => PromiseLike<{ error: { message: string } | null }>;
  };
  delete: () => { eq: (c: string, v: string) => PromiseLike<{ error: { message: string } | null }> };
};
const instancesTable = () => (supabase.from as unknown as InstancesFrom)("agent_instances");

function useAgentInstances() {
  const { company } = useCompany();
  return useQuery({
    queryKey: ["agent_instances", company?.id],
    enabled: !!company,
    queryFn: async () => {
      const { data, error } = await instancesTable()
        .select("id, template_key, nome, ativo, config, canais, last_run_at, last_result")
        .eq("company_id", company!.id)
        .order("created_at", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as AgentInstance[];
    },
  });
}

function ConfigDialog({
  template,
  instance,
  open,
  onOpenChange,
}: {
  template: TemplateAgente;
  instance: AgentInstance;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { company } = useCompany();
  const queryClient = useQueryClient();
  const [config, setConfig] = useState<Record<string, unknown>>({ ...template.configPadrao, ...instance.config });
  const [whatsapp, setWhatsapp] = useState<boolean>(instance.canais.whatsapp ?? false);
  const [notifyNumber, setNotifyNumber] = useState<string>("");

  // Destinatário dos avisos mora em whatsapp_configs (por empresa, não por
  // agente). Sem instância Evolution ativa, o canal fica indisponível de forma
  // visível — nunca descarte silencioso.
  const waConfig = useQuery({
    queryKey: ["whatsapp_config_notify", company?.id],
    enabled: !!company && open,
    queryFn: async () => {
      const { data } = await (supabase.from as unknown as InstancesFrom)("whatsapp_configs")
        .select("id, notify_number, active")
        .eq("company_id", company!.id)
        .order("created_at", { ascending: false });
      const rows = (data ?? []) as Array<{ id: string; notify_number: string | null; active: boolean }>;
      const ativa = rows.find((r) => r.active) ?? null;
      setNotifyNumber(ativa?.notify_number ?? "");
      return ativa;
    },
  });

  const salvar = useMutation({
    mutationFn: async () => {
      const { error } = await instancesTable()
        .update({ config, canais: { inapp: true, whatsapp }, updated_at: new Date().toISOString() })
        .eq("id", instance.id);
      if (error) throw new Error(error.message);
      if (whatsapp && waConfig.data && notifyNumber.trim()) {
        const { error: waErr } = await (supabase.from as unknown as InstancesFrom)("whatsapp_configs")
          .update({ notify_number: notifyNumber.replace(/\D/g, "") })
          .eq("id", waConfig.data.id);
        if (waErr) throw new Error(waErr.message);
      }
    },
    onSuccess: () => {
      toast.success("Agente atualizado.");
      queryClient.invalidateQueries({ queryKey: ["agent_instances", company?.id] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(mensagemDeErro(e)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{template.nome}</DialogTitle>
          <DialogDescription>{template.descricao}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {template.campos.map((campo) => (
            <div key={campo.key} className="space-y-1.5">
              <Label>
                {campo.label}
                {campo.sufixo ? ` (${campo.sufixo})` : ""}
              </Label>
              {campo.tipo === "textarea" ? (
                <Textarea
                  rows={4}
                  value={String(config[campo.key] ?? "")}
                  onChange={(e) => setConfig((c) => ({ ...c, [campo.key]: e.target.value }))}
                  placeholder="Ex.: algum cliente concentra mais de 40% da receita? Há despesa fora do padrão?"
                />
              ) : (
                <Input
                  type="number"
                  inputMode="decimal"
                  value={String(config[campo.key] ?? "")}
                  onChange={(e) => setConfig((c) => ({ ...c, [campo.key]: Number(e.target.value) }))}
                />
              )}
            </div>
          ))}
          <div className="flex items-center justify-between rounded-md border border-border px-3 py-2.5">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs font-medium text-foreground">Avisar também no WhatsApp</p>
                <p className="text-[11px] text-muted-foreground">
                  Exige número de destino configurado em Inteligência → WhatsApp.
                </p>
              </div>
            </div>
            <Switch checked={whatsapp} onCheckedChange={setWhatsapp} aria-label="Canal WhatsApp" />
          </div>
          {whatsapp && (
            waConfig.data ? (
              <div className="space-y-1.5">
                <Label>Número que recebe os avisos (com DDI)</Label>
                <Input
                  inputMode="tel"
                  value={notifyNumber}
                  onChange={(e) => setNotifyNumber(e.target.value)}
                  placeholder="5548999999999"
                />
              </div>
            ) : (
              <p className="rounded-md border border-warning/30 bg-warning/[0.08] p-2.5 text-[11px] text-muted-foreground">
                Nenhuma instância de WhatsApp ativa. Conecte em Inteligência → WhatsApp; até lá, este agente avisa só no sino.
              </p>
            )
          )}
          <Button className="w-full" onClick={() => salvar.mutate()} disabled={salvar.isPending}>
            {salvar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TemplateCard({ template, instance }: { template: TemplateAgente; instance?: AgentInstance }) {
  const { company } = useCompany();
  const queryClient = useQueryClient();
  const [configAberta, setConfigAberta] = useState(false);
  const somenteLeitura = useSomenteLeitura();
  const invalidar = () => queryClient.invalidateQueries({ queryKey: ["agent_instances", company?.id] });

  const ativar = useMutation({
    mutationFn: async () => {
      const { error } = await instancesTable().insert({
        company_id: company!.id,
        template_key: template.key,
        nome: template.nome,
        ativo: true,
        config: template.configPadrao,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success(`${template.nome} ativado.`);
      invalidar();
    },
    onError: (e: Error) => toast.error(mensagemDeErro(e)),
  });

  const alternar = useMutation({
    mutationFn: async (ativo: boolean) => {
      const { error } = await instancesTable()
        .update({ ativo, updated_at: new Date().toISOString() })
        .eq("id", instance!.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidar,
    onError: (e: Error) => toast.error(mensagemDeErro(e)),
  });

  return (
    <div className="flex flex-col rounded-lg border border-border bg-card p-4">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <Bot className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">{template.nome}</p>
            <div className="flex items-center gap-1.5">
              {template.requerIa && <Badge variant="secondary" className="text-[10px]">IA</Badge>}
              {instance?.canais.whatsapp && <Badge variant="secondary" className="text-[10px]">WhatsApp</Badge>}
            </div>
          </div>
        </div>
        {instance ? (
          <Switch
            checked={instance.ativo}
            onCheckedChange={(v) => alternar.mutate(v)}
            disabled={somenteLeitura.bloqueado}
            title={somenteLeitura.motivo || undefined}
            aria-label={`${template.nome} ${instance.ativo ? "ativo" : "inativo"}`}
          />
        ) : null}
      </div>
      <p className="mb-3 flex-1 text-xs leading-relaxed text-muted-foreground">{template.descricao}</p>
      <div className="flex items-center justify-between gap-2">
        {instance ? (
          <>
            <span className="text-[10px] text-muted-foreground">
              {instance.last_run_at
                ? `Rodou ${new Date(instance.last_run_at).toLocaleDateString("pt-BR")} · ${instance.last_result?.enviados ?? 0} aviso(s)`
                : "Ainda não rodou"}
            </span>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setConfigAberta(true)}>
              <Settings2 className="h-3.5 w-3.5" /> Configurar
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            className="ml-auto gap-1.5"
            onClick={() => ativar.mutate()}
            disabled={ativar.isPending || somenteLeitura.bloqueado}
            title={somenteLeitura.motivo || undefined}
          >
            {ativar.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            {somenteLeitura.bloqueado ? somenteLeitura.rotulo : "Ativar"}
          </Button>
        )}
      </div>
      {instance && (
        <ConfigDialog template={template} instance={instance} open={configAberta} onOpenChange={setConfigAberta} />
      )}
    </div>
  );
}

export function GaleriaAgentes() {
  const { company } = useCompany();
  const { data: instances = [] } = useAgentInstances();
  const [rodando, setRodando] = useState(false);

  const rodarAgora = async () => {
    if (!company) return;
    setRodando(true);
    try {
      const { data, error } = await supabase.functions.invoke("agent-runner", {
        body: { company_id: company.id },
      });
      if (error) throw error;
      toast.success(`Agentes executados: ${data?.instancias ?? 0} instância(s).`);
    } catch (e) {
      toast.error(mensagemDeErro(e));
    } finally {
      setRodando(false);
    }
  };

  const ativos = instances.filter((i) => i.ativo).length;

  return (
    <section aria-label="Galeria de agentes">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold tracking-[-0.02em] text-foreground">Galeria de agentes</h2>
          <p className="text-xs text-muted-foreground">
            Ative quantos quiser; eles rodam todo dia e avisam no sino{ativos > 0 ? ` · ${ativos} ativo(s)` : ""}.
          </p>
        </div>
        {ativos > 0 && (
          <Button size="sm" variant="outline" className="gap-2" onClick={rodarAgora} disabled={rodando}>
            {rodando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Rodar agora
          </Button>
        )}
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {TEMPLATES_AGENTES.map((template) => (
          <TemplateCard
            key={template.key}
            template={template}
            instance={instances.find((i) => i.template_key === template.key)}
          />
        ))}
      </div>
    </section>
  );
}
