import { mensagemDeErro } from "@/lib/erros";
import { AppLayout } from "@/components/AppLayout";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Bot, RefreshCw, Check, X, MessageCircle, Loader2, Inbox,
  HandCoins, CalendarCheck, BellRing,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { ConfiguracaoAgentes } from "@/components/agentes/ConfiguracaoAgentes";
import { GaleriaAgentes } from "@/components/agentes/GaleriaAgentes";
import { useAuth } from "@/hooks/useAuth";

interface AgentAction {
  id: string;
  agent: "collections" | "close" | "alerts";
  action_type: string;
  title: string;
  description: string | null;
  suggested_message: string | null;
  amount: number | null;
  due_date: string | null;
  contact_whatsapp: string | null;
  status: string;
  created_at: string;
}

const AGENT_META: Record<AgentAction["agent"], { label: string; icon: typeof HandCoins }> = {
  collections: { label: "Cobrança", icon: HandCoins },
  close: { label: "Fechamento", icon: CalendarCheck },
  alerts: { label: "Alertas", icon: BellRing },
};

function formatBRL(v: number | null): string {
  if (v == null) return "";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function ActionCard({ action, onDecide }: {
  action: AgentAction;
  onDecide: (id: string, status: "approved" | "rejected" | "executed") => void;
}) {
  const meta = AGENT_META[action.agent];
  const Icon = meta.icon;
  const isPending = action.status === "pending";
  const isApproved = action.status === "approved";

  // Sem telefone não existe link de WhatsApp: montar wa.me/ vazio abria uma
  // conversa sem destinatário e o botão marcava a ação como enviada. Enquanto
  // o agente não trouxer o contato, o caminho honesto é copiar a mensagem.
  const telefone = (action.contact_whatsapp ?? "").replace(/\D/g, "");
  const whatsappHref =
    action.suggested_message && telefone.length >= 10
      ? `https://wa.me/${telefone}?text=${encodeURIComponent(action.suggested_message)}`
      : null;

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <Icon className="h-4 w-4 text-primary" />
          </div>
          <div>
            <div className="text-sm font-medium">{action.title}</div>
            <div className="text-xs text-muted-foreground">
              Agente de {meta.label} · {new Date(action.created_at).toLocaleDateString("pt-BR")}
              {action.amount != null && <> · {formatBRL(action.amount)}</>}
            </div>
          </div>
        </div>
        <Badge variant={isPending ? "default" : "secondary"}>
          {isPending ? "Aguardando aprovação" : action.status === "approved" ? "Aprovada" :
            action.status === "executed" ? "Executada" : action.status === "rejected" ? "Recusada" : action.status}
        </Badge>
      </div>

      {action.description && (
        <p className="mb-2 text-sm text-muted-foreground">{action.description}</p>
      )}

      {action.suggested_message && (
        <div className="mb-3 rounded-md border border-border bg-muted/40 p-3 text-sm">
          <div className="mb-1 text-xs font-medium text-muted-foreground">Mensagem sugerida pelo agente</div>
          {action.suggested_message}
        </div>
      )}

      {isPending && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" className="gap-1" onClick={() => onDecide(action.id, "approved")}>
            <Check className="h-4 w-4" /> Aprovar
          </Button>
          <Button size="sm" variant="outline" className="gap-1" onClick={() => onDecide(action.id, "rejected")}>
            <X className="h-4 w-4" /> Recusar
          </Button>
        </div>
      )}

      {isApproved && (
        <div className="flex flex-wrap gap-2">
          {whatsappHref ? (
            <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
              <Button size="sm" className="gap-1" onClick={() => onDecide(action.id, "executed")}>
                <MessageCircle className="h-4 w-4" /> Enviar no WhatsApp
              </Button>
            </a>
          ) : action.suggested_message ? (
            <Button
              size="sm"
              className="gap-1"
              onClick={() => {
                navigator.clipboard.writeText(action.suggested_message ?? "");
                toast.success("Mensagem copiada. Cole no WhatsApp do cliente.");
              }}
            >
              <MessageCircle className="h-4 w-4" /> Copiar mensagem
            </Button>
          ) : null}
          <Button size="sm" variant="outline" className="gap-1" onClick={() => onDecide(action.id, "executed")}>
            <Check className="h-4 w-4" /> Marcar como enviada
          </Button>
        </div>
      )}
    </div>
  );
}

export default function Agents() {
  const { company } = useCompany();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [scanning, setScanning] = useState(false);
  const [tab, setTab] = useState<"pending" | "done">("pending");

  const { data: actions = [], isLoading } = useQuery({
    queryKey: ["agent_actions", company?.id, tab],
    enabled: !!company,
    queryFn: async () => {
      let q = (supabase as any)
        .from("agent_actions")
        .select("*")
        .eq("company_id", company!.id)
        .order("created_at", { ascending: false })
        .limit(100);
      q = tab === "pending" ? q.in("status", ["pending", "approved"]) : q.in("status", ["executed", "rejected", "failed", "expired"]);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as AgentAction[];
    },
  });

  const decide = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const patch: Record<string, unknown> = { status };
      if (status === "approved" || status === "rejected") {
        patch.decided_at = new Date().toISOString();
        patch.decided_by = user?.id ?? null;
      }
      if (status === "executed") patch.executed_at = new Date().toISOString();
      const { error } = await (supabase as any).from("agent_actions").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agent_actions", company?.id] }),
    onError: (e: Error) => toast.error("Erro ao atualizar ação: " + mensagemDeErro(e)),
  });

  const handleScan = async () => {
    if (!company) return;
    setScanning(true);
    try {
      const { data, error } = await supabase.functions.invoke("agent-collections", {
        body: { company_id: company.id },
      });
      if (error) throw error;
      toast.success(`Varredura concluída: ${data?.created ?? 0} nova(s) ação(ões)`);
      qc.invalidateQueries({ queryKey: ["agent_actions", company.id] });
    } catch (e) {
      toast.error("Erro na varredura: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setScanning(false);
    }
  };

  return (
    <AppLayout>
      <div className="animate-fade-in">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              <h1 className="text-[28px] font-semibold tracking-[-0.02em]">Agentes</h1>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Ações propostas pelos agentes de IA — nada é executado sem a sua aprovação.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ConfiguracaoAgentes />
            <Button onClick={handleScan} disabled={scanning} variant="outline" className="gap-2">
              {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Varrer cobranças agora
            </Button>
          </div>
        </div>

        <div className="mb-8">
          <GaleriaAgentes />
        </div>

        <div className="mb-3">
          <h2 className="text-lg font-semibold tracking-[-0.02em] text-foreground">Fila de aprovação</h2>
          <p className="text-xs text-muted-foreground">Propostas dos agentes que esperam a sua decisão.</p>
        </div>
        <div className="mb-4 flex gap-2">
          <Button size="sm" variant={tab === "pending" ? "default" : "outline"} onClick={() => setTab("pending")}>
            Em aberto
          </Button>
          <Button size="sm" variant={tab === "done" ? "default" : "outline"} onClick={() => setTab("done")}>
            Histórico
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : actions.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-10 text-center">
            <Inbox className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">
              {tab === "pending" ? "Nenhuma ação aguardando você" : "Nenhuma ação no histórico"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {tab === "pending"
                ? "O Agente de Cobrança varre as cobranças Asaas automaticamente. Você também pode varrer agora."
                : "Ações aprovadas, enviadas ou recusadas aparecem aqui."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {actions.map((a) => (
              <ActionCard key={a.id} action={a} onDecide={(id, status) => decide.mutate({ id, status })} />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
