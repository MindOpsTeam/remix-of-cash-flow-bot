import { useState, useEffect, useCallback, useRef } from "react";
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
  MessageSquare, Plus, Trash2, CheckCircle2,
  ArrowDownLeft, ArrowUpRight, Phone, Activity, Loader2, QrCode, RefreshCw, Settings2,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface WhatsAppConfig {
  id: string;
  company_id: string;
  instance_name: string;
  evolution_api_url: string | null;
  evolution_api_key: string | null;
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

type ModalStep = "credentials" | "qrcode";
type ConnectionStatus = "waiting" | "connected" | "error";

export default function WhatsApp() {
  const { company } = useCompany();
  const [configs, setConfigs] = useState<WhatsAppConfig[]>([]);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [messagesDialogOpen, setMessagesDialogOpen] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState<WhatsAppConfig | null>(null);

  // Modal state
  const [step, setStep] = useState<ModalStep>("credentials");
  const [formInstance, setFormInstance] = useState("");
  const [formApiUrl, setFormApiUrl] = useState("");
  const [formApiKey, setFormApiKey] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [qrCodeBase64, setQrCodeBase64] = useState("");
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("waiting");
  const [errorMessage, setErrorMessage] = useState("");
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
  const webhookUrl = `${supabaseUrl}/functions/v1/whatsapp-webhook`;

  const loadConfigs = useCallback(async () => {
    if (!company) return;
    const { data } = await supabase
      .from("whatsapp_configs")
      .select("*")
      .eq("company_id", company.id)
      .order("created_at", { ascending: false });
    if (data) setConfigs(data as unknown as WhatsAppConfig[]);
  }, [company]);

  useEffect(() => { loadConfigs(); }, [loadConfigs]);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
  }, []);

  const resetModal = useCallback(() => {
    setStep("credentials");
    setFormInstance("");
    setFormApiUrl("");
    setFormApiKey("");
    setQrCodeBase64("");
    setConnectionStatus("waiting");
    setErrorMessage("");
    setConnecting(false);
    stopPolling();
  }, [stopPolling]);

  useEffect(() => { if (!dialogOpen) resetModal(); }, [dialogOpen, resetModal]);
  useEffect(() => () => stopPolling(), [stopPolling]);

  const getCleanUrl = () => formApiUrl.trim().replace(/\/$/, "");
  const getHeaders = () => ({ apikey: formApiKey.trim(), "Content-Type": "application/json" });

  const fetchInstancePhone = async (url: string, headers: Record<string, string>, instanceName: string): Promise<string> => {
    try {
      const infoRes = await fetch(`${url}/instance/fetchInstances`, { headers });
      if (!infoRes.ok) return "";
      const instances = await infoRes.json();
      const inst = Array.isArray(instances)
        ? instances.find((i: any) => i.instance?.instanceName === instanceName || i.instanceName === instanceName)
        : instances;
      let phone = inst?.instance?.owner || inst?.owner || "";
      return phone.replace("@s.whatsapp.net", "").replace(/\D/g, "");
    } catch (e) {
      console.warn("Could not fetch instance phone:", e);
      return "";
    }
  };

  const fetchQrCode = async (url: string, headers: Record<string, string>, instanceName: string): Promise<string | null> => {
    const res = await fetch(`${url}/instance/connect/${instanceName}`, { headers });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.base64 || data?.qrcode?.base64 || null;
  };

  const startPolling = (url: string, headers: Record<string, string>, instanceName: string) => {
    stopPolling();

    pollingRef.current = setInterval(async () => {
      try {
      const res = await fetch(`${url}/instance/connectionState/${instanceName}`, { headers });
        if (!res.ok) return;
        const data = await res.json();
        const state = data?.instance?.state || data?.state;
        if (state === "open") {
          setConnectionStatus("connected");
          stopPolling();
          const connectedPhone = await fetchInstancePhone(url, headers, instanceName);
          await saveConfig(connectedPhone);
        }
      } catch { /* ignore */ }
    }, 5000);

    timeoutRef.current = setTimeout(() => {
      if (connectionStatus !== "connected") {
        stopPolling();
        setConnectionStatus("error");
        setErrorMessage("Tempo esgotado. Clique em 'Gerar novo QR' para tentar novamente.");
      }
    }, 120_000);
  };

  const saveConfig = async (phoneNumber?: string) => {
    if (!company) return;
    const { error } = await supabase.from("whatsapp_configs").insert({
      company_id: company.id,
      instance_name: formInstance.trim(),
      evolution_api_url: getCleanUrl(),
      evolution_api_key: formApiKey.trim(),
      phone_number: phoneNumber || null,
    } as any);
    if (error) {
      toast.error("Erro ao salvar: " + error.message);
    } else {
      toast.success("WhatsApp conectado com sucesso!");
      loadConfigs();
      setTimeout(() => setDialogOpen(false), 1500);
    }
  };

  const handleConnect = async () => {
    if (!formInstance.trim() || !formApiUrl.trim() || !formApiKey.trim()) return;
    setConnecting(true);
    setErrorMessage("");
    const url = getCleanUrl();
    const headers = getHeaders();
    const instanceName = formInstance.trim();

    try {
      // Try to create instance with QR + webhook
      const createRes = await fetch(`${url}/instance/create`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          instanceName,
          integration: "WHATSAPP-BAILEYS",
          qrcode: true,
          webhook: {
            url: webhookUrl,
            webhook_by_events: false,
            events: ["MESSAGES_UPSERT"],
          },
        }),
      });

      let qr: string | null = null;

      if (createRes.ok) {
        const createData = await createRes.json();
        qr = createData?.qrcode?.base64 || createData?.base64 || null;
      }

      // If instance already exists (409) or no QR from create, try connect + set webhook
      if (!qr) {
        // Ensure webhook is configured on existing instance
        await configureWebhook(url, headers, instanceName);
        qr = await fetchQrCode(url, headers, instanceName);
      }

      if (!qr) {
        // Maybe already connected — check state
        const stateRes = await fetch(`${url}/instance/connectionState/${instanceName}`, { headers });
        if (stateRes.ok) {
          const stateData = await stateRes.json();
          const state = stateData?.instance?.state || stateData?.state;
           if (state === "open") {
            setConnectionStatus("connected");
            setStep("qrcode");
            const connectedPhone = await fetchInstancePhone(url, headers, instanceName);
            await saveConfig(connectedPhone);
            return;
          }
        }
        setErrorMessage("Não foi possível obter o QR Code. Verifique as credenciais e o nome da instância.");
        return;
      }

      // Ensure base64 has data URI prefix
      const qrSrc = qr.startsWith("data:") ? qr : `data:image/png;base64,${qr}`;
      setQrCodeBase64(qrSrc);
      setStep("qrcode");
      setConnectionStatus("waiting");
      startPolling(url, headers, instanceName);
    } catch {
      setErrorMessage("Não foi possível conectar ao servidor Evolution. Verifique a URL.");
    } finally {
      setConnecting(false);
    }
  };

  const handleRefreshQr = async () => {
    setConnecting(true);
    setConnectionStatus("waiting");
    setErrorMessage("");
    const url = getCleanUrl();
    const headers = getHeaders();
    const instanceName = formInstance.trim();
    try {
      const qr = await fetchQrCode(url, headers, instanceName);
      if (qr) {
        const qrSrc = qr.startsWith("data:") ? qr : `data:image/png;base64,${qr}`;
        setQrCodeBase64(qrSrc);
        startPolling(url, headers, instanceName);
      } else {
        setErrorMessage("Não foi possível gerar um novo QR Code.");
      }
    } catch {
      setErrorMessage("Erro ao gerar novo QR Code.");
    } finally {
      setConnecting(false);
    }
  };

  const configureWebhook = async (url: string, headers: Record<string, string>, instanceName: string) => {
    try {
      // Evolution API v2: POST /webhook/set/{instance}
      const res = await fetch(`${url}/webhook/set/${instanceName}`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          webhook: {
            url: webhookUrl,
            webhook_by_events: false,
            events: ["MESSAGES_UPSERT"],
            enabled: true,
          },
        }),
      });
      if (res.ok) {
        console.log("Webhook configured for", instanceName);
      } else {
        // Fallback: try Evolution API v1 format
        const res2 = await fetch(`${url}/instance/setWebhook/${instanceName}`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            url: webhookUrl,
            webhook_by_events: false,
            events: ["MESSAGES_UPSERT"],
            enabled: true,
          }),
        });
        if (res2.ok) console.log("Webhook configured (v1) for", instanceName);
        else console.warn("Could not configure webhook:", await res2.text());
      }
    } catch (err) {
      console.warn("Webhook config error:", err);
    }
  };

  const handleConfigureWebhook = async (c: WhatsAppConfig) => {
    if (!c.evolution_api_url || !c.evolution_api_key) {
      toast.error("Credenciais da Evolution API não encontradas nesta instância.");
      return;
    }
    const url = c.evolution_api_url.replace(/\/$/, "");
    const headers = { apikey: c.evolution_api_key, "Content-Type": "application/json" };
    toast.loading("Configurando webhook...", { id: "webhook-config" });
    await configureWebhook(url, headers, c.instance_name);
    // Also fetch and save phone number if missing
    const phone = await fetchInstancePhone(url, headers, c.instance_name);
    if (phone) {
      await supabase.from("whatsapp_configs").update({ phone_number: phone } as any).eq("id", c.id);
      loadConfigs();
    }
    toast.success("Webhook configurado! Envie uma mensagem de teste.", { id: "webhook-config" });
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

  const formValid = formInstance.trim() && formApiUrl.trim() && formApiKey.trim();

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
              <DialogTitle>
                {step === "credentials" ? "Conectar Instância Evolution" : "Escaneie o QR Code"}
              </DialogTitle>
            </DialogHeader>

            {step === "credentials" && (
              <div className="space-y-4 mt-2">
                <div>
                  <Label>URL do Servidor Evolution *</Label>
                  <Input
                    placeholder="https://evolution.suaempresa.com"
                    value={formApiUrl}
                    onChange={(e) => setFormApiUrl(e.target.value)}
                  />
                </div>
                <div>
                  <Label>API Key *</Label>
                  <Input
                    type="password"
                    placeholder="Sua chave de API global"
                    value={formApiKey}
                    onChange={(e) => setFormApiKey(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Nome da Instância *</Label>
                  <Input
                    placeholder="Ex: minha-empresa"
                    value={formInstance}
                    onChange={(e) => setFormInstance(e.target.value)}
                  />
                </div>

                {errorMessage && (
                  <div className="text-xs px-3 py-2 rounded-lg bg-destructive/10 text-destructive">
                    {errorMessage}
                  </div>
                )}

                <Button
                  className="w-full gap-2"
                  onClick={handleConnect}
                  disabled={!formValid || connecting}
                >
                  {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
                  Gerar QR Code
                </Button>
              </div>
            )}

            {step === "qrcode" && (
              <div className="flex flex-col items-center gap-4 mt-2">
                {connectionStatus === "connected" ? (
                  <div className="flex flex-col items-center gap-3 py-8">
                    <div className="p-3 rounded-full bg-revenue/10">
                      <CheckCircle2 className="h-8 w-8 text-revenue" />
                    </div>
                    <h3 className="text-sm font-semibold text-foreground">WhatsApp conectado!</h3>
                    <p className="text-xs text-muted-foreground text-center">
                      A instância <strong>{formInstance}</strong> está pronta para uso.
                    </p>
                  </div>
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground text-center">
                      Abra o WhatsApp no celular → Dispositivos conectados → Conectar dispositivo
                    </p>
                    {qrCodeBase64 && (
                      <div className="bg-card border border-border rounded-xl p-4">
                        <img
                          src={qrCodeBase64}
                          alt="QR Code WhatsApp"
                          className="w-64 h-64 object-contain"
                        />
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Aguardando leitura do QR Code...
                    </div>

                    {connectionStatus === "error" && errorMessage && (
                      <div className="text-xs px-3 py-2 rounded-lg bg-destructive/10 text-destructive text-center">
                        {errorMessage}
                      </div>
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={handleRefreshQr}
                      disabled={connecting}
                    >
                      {connecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                      Gerar novo QR
                    </Button>
                  </>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
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
                    <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                      {c.evolution_api_url || "Servidor global"} · {new Date(c.created_at).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button variant="ghost" size="icon" onClick={() => handleConfigureWebhook(c)} title="Configurar webhook" aria-label="Configurar webhook">
                    <Settings2 className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => viewMessages(c)} title="Ver mensagens" aria-label="Ver mensagens">
                    <Activity className="h-4 w-4" />
                  </Button>
                  <Switch checked={c.active} onCheckedChange={() => toggleActive(c)} />
                  <Button variant="ghost" size="icon" onClick={() => deleteConfig(c.id)} title="Remover" aria-label="Remover configuração">
                    <Trash2 className="h-4 w-4 text-destructive" />
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
