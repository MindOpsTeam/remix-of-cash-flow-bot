import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  MessageSquare, Plus, Trash2, Copy, CheckCircle2,
  ArrowDownLeft, ArrowUpRight, Phone, Settings2, Activity,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface WhatsAppConfig {
  id: string;
  company_id: string;
  instance_name: string;
  active: boolean;
  created_at: string;
}

interface WhatsAppMessage {
  id: string;
  phone_number: string;
  direction: string;
  message_text: string | null;
  message_type: string;
  processed: boolean;
  classification: Record<string, unknown>;
  created_at: string;
}

export default function WhatsApp() {
  const { company } = useCompany();
  const [configs, setConfigs] = useState<WhatsAppConfig[]>([]);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [messagesDialogOpen, setMessagesDialogOpen] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState<WhatsAppConfig | null>(null);
  const [formInstance, setFormInstance] = useState("");

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const webhookUrl = `https://${projectId}.supabase.co/functions/v1/whatsapp-webhook`;

  const loadConfigs = useCallback(async () => {
    if (!company) return;
    const { data } = await supabase
      .from("whatsapp_configs")
      .select("*")
      .eq("company_id", company.id)
      .order("created_at", { ascending: false });
    if (data) setConfigs(data);
  }, [company]);

  useEffect(() => { loadConfigs(); }, [loadConfigs]);

  const createConfig = async () => {
    if (!company || !formInstance.trim()) return;
    const { error } = await supabase.from("whatsapp_configs").insert({
      company_id: company.id,
      instance_name: formInstance.trim(),
    });
    if (error) {
      toast.error("Erro: " + error.message);
    } else {
      toast.success("Instância conectada!");
      setFormInstance("");
      setDialogOpen(false);
      loadConfigs();
    }
  };

  const toggleActive = async (c: WhatsAppConfig) => {
    await supabase.from("whatsapp_configs").update({ active: !c.active }).eq("id", c.id);
    loadConfigs();
  };

  const deleteConfig = async (id: string) => {
    await supabase.from("whatsapp_configs").delete().eq("id", id);
    toast.success("Instância removida");
    loadConfigs();
  };

  const viewMessages = async (c: WhatsAppConfig) => {
    setSelectedConfig(c);
    const { data } = await supabase
      .from("whatsapp_messages")
      .select("*")
      .eq("config_id", c.id)
      .order("created_at", { ascending: false })
      .limit(30);
    setMessages((data || []) as WhatsAppMessage[]);
    setMessagesDialogOpen(true);
  };

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast.success("URL do webhook copiada!");
  };

  return (
    <AppLayout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-[-0.02em]">Agente WhatsApp</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Assistente financeiro inteligente via WhatsApp (Evolution API)
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" /> Conectar Instância
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Conectar Instância Evolution</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div>
                <Label>Nome da Instância</Label>
                <Input
                  placeholder="Ex: minha-empresa"
                  value={formInstance}
                  onChange={(e) => setFormInstance(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  O nome da instância configurada no seu Evolution API
                </p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <h4 className="text-xs font-semibold text-foreground">Configuração do Webhook</h4>
                <p className="text-xs text-muted-foreground">
                  Configure esta URL como webhook na sua instância Evolution API:
                </p>
                <div className="flex items-center gap-2">
                  <code className="text-[11px] text-foreground bg-muted px-2 py-1 rounded break-all flex-1">
                    {webhookUrl}
                  </code>
                  <button onClick={copyWebhookUrl} className="text-muted-foreground hover:text-foreground shrink-0">
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Evento necessário: <code className="bg-muted px-1 rounded">MESSAGES_UPSERT</code>
                </p>
              </div>
              <Button className="w-full" onClick={createConfig} disabled={!formInstance.trim()}>
                Conectar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Webhook URL info card */}
      <div className="bg-card border border-border rounded-lg p-5 mb-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Settings2 className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">URL do Webhook</h3>
            <p className="text-xs text-muted-foreground">Configure no painel da Evolution API</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <code className="text-xs text-muted-foreground bg-muted px-3 py-1.5 rounded flex-1 truncate">
            {webhookUrl}
          </code>
          <Button variant="outline" size="sm" onClick={copyWebhookUrl} className="gap-1.5 shrink-0">
            <Copy className="h-3.5 w-3.5" /> Copiar
          </Button>
        </div>
      </div>

      {/* Connected instances */}
      {configs.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-12 text-center">
          <MessageSquare className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-sm font-semibold text-foreground mb-1">Nenhuma instância conectada</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Conecte sua instância do Evolution API para começar a receber e processar mensagens do WhatsApp automaticamente.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {configs.map((c) => (
            <div key={c.id} className="bg-card border border-border rounded-lg p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-lg bg-revenue/10">
                    <Phone className="h-4 w-4 text-revenue" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-foreground">{c.instance_name}</h3>
                      <Badge variant={c.active ? "default" : "secondary"} className="text-[10px]">
                        {c.active ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Conectado em {new Date(c.created_at).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button variant="ghost" size="icon" onClick={() => viewMessages(c)} title="Ver mensagens" aria-label="Ver mensagens">
                    <Activity className="h-4 w-4" />
                  </Button>
                  <Switch checked={c.active} onCheckedChange={() => toggleActive(c)} />
                  <Button variant="ghost" size="icon" onClick={() => deleteConfig(c.id)} title="Remover" aria-label="Remover configuração">
                    <Trash2 className="h-4 w-4 text-expense" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Feature cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
        <div className="bg-card border border-border rounded-lg p-5">
          <ArrowDownLeft className="h-5 w-5 text-revenue mb-3" />
          <h3 className="text-sm font-semibold text-foreground mb-1">Lançamento Automático</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Envie "Despesa R$ 150 Almoço" e o sistema cria o lançamento automaticamente.
          </p>
        </div>
        <div className="bg-card border border-border rounded-lg p-5">
          <ArrowUpRight className="h-5 w-5 text-primary mb-3" />
          <h3 className="text-sm font-semibold text-foreground mb-1">Consultas Instantâneas</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Pergunte "Qual meu saldo?" e receba um resumo financeiro no WhatsApp.
          </p>
        </div>
        <div className="bg-card border border-border rounded-lg p-5">
          <MessageSquare className="h-5 w-5 text-accent-foreground mb-3" />
          <h3 className="text-sm font-semibold text-foreground mb-1">IA Classificadora</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Inteligência artificial classifica automaticamente conta contábil e centro de custo.
          </p>
        </div>
      </div>

      {/* Messages dialog */}
      <Dialog open={messagesDialogOpen} onOpenChange={setMessagesDialogOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Mensagens — {selectedConfig?.instance_name}</DialogTitle>
          </DialogHeader>
          {messages.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma mensagem registrada ainda.</p>
          ) : (
            <div className="space-y-2 mt-2">
              {messages.map((m) => (
                <div key={m.id} className="border border-border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      {m.direction === "inbound" ? (
                        <ArrowDownLeft className="h-3.5 w-3.5 text-primary" />
                      ) : (
                        <ArrowUpRight className="h-3.5 w-3.5 text-revenue" />
                      )}
                      <span className="text-xs font-medium">{m.phone_number}</span>
                      {m.processed && <CheckCircle2 className="h-3 w-3 text-revenue" />}
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(m.created_at).toLocaleString("pt-BR")}
                    </span>
                  </div>
                  {m.message_text && (
                    <p className="text-xs text-foreground mt-1">{m.message_text}</p>
                  )}
                  {m.classification && Object.keys(m.classification).length > 0 && (
                    <details className="mt-2">
                      <summary className="text-[11px] text-muted-foreground cursor-pointer">Ver classificação</summary>
                      <pre className="text-[10px] bg-muted p-2 rounded mt-1 overflow-x-auto max-h-24">
                        {JSON.stringify(m.classification, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
