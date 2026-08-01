import { mensagemDeErro } from "@/lib/erros";
import { useState, useEffect, useCallback, useRef } from "react";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { edgeAuthHeaders, edgeUrl } from "@/lib/edge";

/** Base do proxy que injeta a key da Evolution no servidor (issue #27). */
const evolutionProxyBase = (configId: string) => `${edgeUrl("evolution-proxy")}/${configId}`;
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import {
  MessageSquare, Plus, Trash2, CheckCircle2,
  ArrowDownLeft, ArrowUpRight, Phone, Activity, Loader2, QrCode, RefreshCw, Settings2,
  Search, AlertCircle, Check, Users,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface WhatsAppConfig {
  id: string;
  company_id: string;
  instance_name: string;
  evolution_api_url: string | null;
  evolution_api_key: string | null;
  phone_number: string | null;
  group_jid: string | null;
  group_name: string | null;
  webhook_secret: string | null;
  active: boolean;
  created_at: string;
}

interface WhatsAppGroup {
  id: string;
  subject: string;
  size: number;
  pictureUrl?: string | null;
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
type ReconnectState = {
  config: WhatsAppConfig;
  qrCodeBase64: string;
  status: ConnectionStatus;
  error: string;
  loading: boolean;
} | null;

export default function WhatsApp() {
  const { company } = useCompany();
  const [configs, setConfigs] = useState<WhatsAppConfig[]>([]);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [messagesDialogOpen, setMessagesDialogOpen] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState<WhatsAppConfig | null>(null);
  const [groupDialogConfig, setGroupDialogConfig] = useState<WhatsAppConfig | null>(null);
  const [availableGroups, setAvailableGroups] = useState<WhatsAppGroup[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [fetchingPictures, setFetchingPictures] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [groupSearch, setGroupSearch] = useState("");
  const [addingManual, setAddingManual] = useState(false);
  const [manualGroupName, setManualGroupName] = useState("");
  const [manualGroupJid, setManualGroupJid] = useState("");
  const hasFetchedPictures = useRef(false);

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
  const webhookBaseUrl = `${supabaseUrl}/functions/v1/whatsapp-webhook`;

  // O webhook só aceita chamadas autenticadas via secret na query string.
  // Este builder anexa ?token=<webhook_secret> à URL configurada na Evolution.
  const buildWebhookUrl = (secret: string | null | undefined) =>
    secret ? `${webhookBaseUrl}?token=${encodeURIComponent(secret)}` : webhookBaseUrl;

  // Secret gerado pré-conexão e usado consistentemente no webhook URL e no INSERT
  const [formWebhookSecret, setFormWebhookSecret] = useState("");

  const [reconnect, setReconnect] = useState<ReconnectState>(null);
  const reconnectPollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoFixPhoneRef = useRef<Set<string>>(new Set());

  const loadConfigs = useCallback(async () => {
    if (!company) return;
    // A evolution_api_key NUNCA desce ao browser: toda operação em instância
    // salva passa pelo evolution-proxy, que injeta a key no servidor.
    const { data } = await supabase
      .from("whatsapp_configs")
      .select("id, company_id, instance_name, group_jid, group_name, phone_number, webhook_secret, active, created_at, evolution_api_url, notify_number")
      .eq("company_id", company.id)
      .order("created_at", { ascending: false });
    if (data) {
      setConfigs(data as unknown as WhatsAppConfig[]);
      // Auto-fix: fetch phone_number for configs missing it
      for (const c of data as any[]) {
        if (!c.phone_number && c.evolution_api_url && !autoFixPhoneRef.current.has(c.id)) {
          autoFixPhoneRef.current.add(c.id);
          const url = evolutionProxyBase(c.id);
          const headers = await edgeAuthHeaders();
          try {
            const infoRes = await fetch(`${url}/instance/fetchInstances`, { headers });
            if (infoRes.ok) {
              const instances = await infoRes.json();
              const inst = Array.isArray(instances)
                ? instances.find((i: any) => i.instance?.instanceName === c.instance_name || i.instanceName === c.instance_name)
                : instances;
              let phone = inst?.instance?.owner || inst?.owner || "";
              phone = phone.replace("@s.whatsapp.net", "").replace(/\D/g, "");
              if (phone) {
                await supabase.from("whatsapp_configs").update({ phone_number: phone } as any).eq("id", c.id);
                console.log(`Auto-fixed phone_number for ${c.instance_name}: ${phone}`);
              }
            }
          } catch (e) {
            console.warn("Auto-fix phone failed for", c.instance_name, e);
          }
        }
      }
    }
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
      const phone = inst?.instance?.owner || inst?.owner || "";
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
      webhook_secret: formWebhookSecret,
    } as any);
    if (error) {
      toast.error("Erro ao salvar: " + mensagemDeErro(error));
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

    // Gera o webhook_secret antes da criação para usá-lo tanto na Evolution
    // (webhook URL com ?token=) quanto no INSERT em whatsapp_configs.
    const secret = formWebhookSecret || crypto.randomUUID();
    if (!formWebhookSecret) setFormWebhookSecret(secret);
    const webhookUrl = buildWebhookUrl(secret);

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
            webhook_base64: true,
          },
          settings: {
            rejectCall: false,
            groupsIgnore: false,
            alwaysOnline: false,
            readMessages: false,
            readStatus: false,
            syncFullHistory: false,
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
        await configureWebhook(url, headers, instanceName, secret);
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

  const configureInstanceSettings = async (url: string, headers: Record<string, string>, instanceName: string) => {
    try {
      const res = await fetch(`${url}/settings/set/${instanceName}`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          rejectCall: false,
          groupsIgnore: false,
          alwaysOnline: false,
          readMessages: false,
          readStatus: false,
          syncFullHistory: false,
        }),
      });
      if (res.ok) {
        console.log("Instance settings configured (fromMe enabled) for", instanceName);
      } else {
        console.warn("Could not configure instance settings:", await res.text());
      }
    } catch (err) {
      console.warn("Instance settings error:", err);
    }
  };

  const configureWebhook = async (
    url: string,
    headers: Record<string, string>,
    instanceName: string,
    secret: string | null | undefined,
  ) => {
    const targetUrl = buildWebhookUrl(secret);
    try {
      // Evolution API v2: POST /webhook/set/{instance}
      const res = await fetch(`${url}/webhook/set/${instanceName}`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          webhook: {
            url: targetUrl,
            webhook_by_events: false,
            events: ["MESSAGES_UPSERT"],
            enabled: true,
            webhook_base64: true,
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
            url: targetUrl,
            webhook_by_events: false,
            events: ["MESSAGES_UPSERT"],
            enabled: true,
            webhook_base64: true,
          }),
        });
        if (res2.ok) console.log("Webhook configured (v1) for", instanceName);
        else console.warn("Could not configure webhook:", await res2.text());
      }
      // Always configure instance settings to receive fromMe messages
      await configureInstanceSettings(url, headers, instanceName);
    } catch (err) {
      console.warn("Webhook config error:", err);
    }
  };

  const handleConfigureWebhook = async (c: WhatsAppConfig) => {
    if (!c.evolution_api_url) {
      toast.error("URL da Evolution API não encontrada nesta instância.");
      return;
    }
    const url = evolutionProxyBase(c.id);
    const headers = await edgeAuthHeaders();
    toast.loading("Configurando webhook...", { id: "webhook-config" });
    await configureWebhook(url, headers, c.instance_name, c.webhook_secret);
    // Also fetch and save phone number if missing
    const phone = await fetchInstancePhone(url, headers, c.instance_name);
    if (phone) {
      await supabase.from("whatsapp_configs").update({ phone_number: phone } as any).eq("id", c.id);
      loadConfigs();
    }
    toast.success("Webhook configurado! Envie uma mensagem de teste.", { id: "webhook-config" });
  };

  const stopReconnectPolling = useCallback(() => {
    if (reconnectPollingRef.current) { clearInterval(reconnectPollingRef.current); reconnectPollingRef.current = null; }
    if (reconnectTimeoutRef.current) { clearTimeout(reconnectTimeoutRef.current); reconnectTimeoutRef.current = null; }
  }, []);

  useEffect(() => () => stopReconnectPolling(), [stopReconnectPolling]);

  const handleReconnect = async (c: WhatsAppConfig) => {
    if (!c.evolution_api_url) {
      toast.error("URL da Evolution API não encontrada.");
      return;
    }
    const url = evolutionProxyBase(c.id);
    const headers = await edgeAuthHeaders();

    setReconnect({ config: c, qrCodeBase64: "", status: "waiting", error: "", loading: true });
    stopReconnectPolling();

    try {
      // Try to disconnect first so a new QR is generated
      await fetch(`${url}/instance/logout/${c.instance_name}`, { method: "DELETE", headers }).catch(() => {});

      // Get new QR
      const qr = await fetchQrCode(url, headers, c.instance_name);
      if (!qr) {
        // Maybe already connected
        const stateRes = await fetch(`${url}/instance/connectionState/${c.instance_name}`, { headers });
        if (stateRes.ok) {
          const st = await stateRes.json();
          if ((st?.instance?.state || st?.state) === "open") {
            setReconnect(prev => prev ? { ...prev, status: "connected", loading: false } : null);
            toast.success("Instância já está conectada!");
            return;
          }
        }
        setReconnect(prev => prev ? { ...prev, error: "Não foi possível gerar o QR Code.", loading: false } : null);
        return;
      }

      const qrSrc = qr.startsWith("data:") ? qr : `data:image/png;base64,${qr}`;
      setReconnect(prev => prev ? { ...prev, qrCodeBase64: qrSrc, loading: false } : null);

      // Poll for connection
      reconnectPollingRef.current = setInterval(async () => {
        try {
          const res = await fetch(`${url}/instance/connectionState/${c.instance_name}`, { headers });
          if (!res.ok) return;
          const data = await res.json();
          if ((data?.instance?.state || data?.state) === "open") {
            stopReconnectPolling();
            setReconnect(prev => prev ? { ...prev, status: "connected" } : null);
            const phone = await fetchInstancePhone(url, headers, c.instance_name);
            if (phone) {
              await supabase.from("whatsapp_configs").update({ phone_number: phone } as any).eq("id", c.id);
            }
            await configureWebhook(url, headers, c.instance_name, c.webhook_secret);
            loadConfigs();
            toast.success("WhatsApp reconectado!");
          }
        } catch { /* ignore */ }
      }, 5000);

      reconnectTimeoutRef.current = setTimeout(() => {
        stopReconnectPolling();
        setReconnect(prev => prev ? { ...prev, status: "error", error: "Tempo esgotado. Tente novamente." } : null);
      }, 120_000);
    } catch {
      setReconnect(prev => prev ? { ...prev, error: "Erro ao conectar ao servidor Evolution.", loading: false } : null);
    }
  };

  const handleReconnectRefreshQr = async () => {
    if (!reconnect) return;
    const c = reconnect.config;
    const url = evolutionProxyBase(c.id);
    const headers = await edgeAuthHeaders();
    setReconnect(prev => prev ? { ...prev, loading: true, status: "waiting", error: "" } : null);
    stopReconnectPolling();
    try {
      const qr = await fetchQrCode(url, headers, c.instance_name);
      if (qr) {
        const qrSrc = qr.startsWith("data:") ? qr : `data:image/png;base64,${qr}`;
        setReconnect(prev => prev ? { ...prev, qrCodeBase64: qrSrc, loading: false } : null);
        // Re-poll
        reconnectPollingRef.current = setInterval(async () => {
          try {
            const res = await fetch(`${url}/instance/connectionState/${c.instance_name}`, { headers });
            if (!res.ok) return;
            const data = await res.json();
            if ((data?.instance?.state || data?.state) === "open") {
              stopReconnectPolling();
              setReconnect(prev => prev ? { ...prev, status: "connected" } : null);
              await configureWebhook(url, headers, c.instance_name, c.webhook_secret);
              loadConfigs();
              toast.success("WhatsApp reconectado!");
            }
          } catch { /* ignore */ }
        }, 5000);
        reconnectTimeoutRef.current = setTimeout(() => {
          stopReconnectPolling();
          setReconnect(prev => prev ? { ...prev, status: "error", error: "Tempo esgotado." } : null);
        }, 120_000);
      } else {
        setReconnect(prev => prev ? { ...prev, error: "Não foi possível gerar QR Code.", loading: false } : null);
      }
    } catch {
      setReconnect(prev => prev ? { ...prev, error: "Erro ao gerar QR Code.", loading: false } : null);
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

  const handleSelectGroup = async (c: WhatsAppConfig) => {
    // A listagem de grupos já roda na edge (list-whatsapp-groups), que lê a
    // key no servidor; o browser só precisa saber que existe URL configurada.
    if (!c.evolution_api_url) {
      toast.error("URL da Evolution API não encontrada.");
      return;
    }
    setGroupDialogConfig(c);
    setLoadingGroups(true);
    setAvailableGroups([]);
    setFetchError(null);
    setGroupSearch("");
    hasFetchedPictures.current = false;
    try {
      const { data, error } = await supabase.functions.invoke('list-whatsapp-groups', {
        body: { config_id: c.id },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro desconhecido');
      setAvailableGroups(data.groups || []);
      // Fetch pictures in background
      fetchGroupPictures(c.id);
    } catch (err: any) {
      console.error("Fetch groups error:", err);
      setFetchError(err.message || "Não foi possível buscar os grupos.");
    } finally {
      setLoadingGroups(false);
    }
  };

  const fetchGroupPictures = async (configId: string) => {
    if (hasFetchedPictures.current) return;
    hasFetchedPictures.current = true;
    setFetchingPictures(true);
    try {
      const { data, error } = await supabase.functions.invoke('list-whatsapp-groups', {
        body: { config_id: configId, include_pictures: true },
      });
      if (error || !data?.success) return;
      setAvailableGroups(data.groups || []);
    } catch {
      // silently fail for pictures
    } finally {
      setFetchingPictures(false);
    }
  };

  const handleSaveGroup = async (groupJid: string, groupName: string) => {
    if (!groupDialogConfig) return;
    const { error } = await supabase
      .from("whatsapp_configs")
      .update({ group_jid: groupJid, group_name: groupName } as any)
      .eq("id", groupDialogConfig.id);
    if (error) {
      toast.error("Erro ao salvar grupo: " + mensagemDeErro(error));
    } else {
      toast.success(`Grupo "${groupName}" configurado com sucesso!`);
      setAvailableGroups([]);
      setGroupDialogConfig(null);
      loadConfigs();
    }
  };

  const handleManualGroupAdd = async () => {
    if (!groupDialogConfig || !manualGroupJid.trim()) return;
    await handleSaveGroup(manualGroupJid.trim(), manualGroupName.trim() || manualGroupJid.trim());
    setManualGroupJid("");
    setManualGroupName("");
    setAddingManual(false);
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
          <h1 className="text-2xl font-bold text-foreground tracking-[-0.02em]">CFO Digital via WhatsApp</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Assistente estratégico financeiro via WhatsApp (Evolution API)
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

      <Tabs defaultValue="instances" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="instances" className="gap-1.5">
            <Phone className="h-3.5 w-3.5" /> Instâncias
          </TabsTrigger>
          <TabsTrigger value="groups" className="gap-1.5">
            <Users className="h-3.5 w-3.5" /> Grupo
          </TabsTrigger>
        </TabsList>

        {/* ── Tab: Instâncias ─────────────────────────────── */}
        <TabsContent value="instances">
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
                        {c.group_jid ? (
                          <p className="text-xs text-revenue font-medium mt-0.5">
                            👥 Grupo: {c.group_name || c.group_jid.split("@")[0]}
                          </p>
                        ) : (
                          <p className="text-[11px] text-destructive font-medium mt-0.5">
                            ⚠️ Sem grupo — vá na aba "Grupo" para configurar
                          </p>
                        )}
                        <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                          {c.evolution_api_url || "Servidor global"} · {new Date(c.created_at).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button variant="ghost" size="icon" onClick={() => handleReconnect(c)} title="Reconectar / QR Code" aria-label="Reconectar">
                        <QrCode className="h-4 w-4" />
                      </Button>
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
              <h3 className="text-sm font-semibold text-foreground mb-1">Aprovação no grupo</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Aprove as ações dos agentes de IA (cobrança, alertas) respondendo "aprovar 1" no grupo.
              </p>
            </div>
            <div className="bg-card border border-border rounded-lg p-5">
              <ArrowUpRight className="h-5 w-5 text-primary mb-3" />
              <h3 className="text-sm font-semibold text-foreground mb-1">Consultas Instantâneas</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Pergunte "Qual meu saldo?" e receba um resumo financeiro no grupo.
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
        </TabsContent>

        {/* ── Tab: Grupo ──────────────────────────────────── */}
        <TabsContent value="groups">
          {configs.length === 0 ? (
            <div className="bg-card border border-border rounded-lg p-12 text-center">
              <Users className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-sm font-semibold text-foreground mb-1">Conecte uma instância primeiro</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Vá na aba "Instâncias" e conecte sua instância Evolution API antes de configurar o grupo.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-card border border-border rounded-lg p-5">
                <h3 className="text-sm font-semibold text-foreground mb-2">Como funciona</h3>
                <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
                  <li>Crie um grupo no WhatsApp e adicione o número da instância conectada</li>
                  <li>Selecione a instância abaixo e clique em "Buscar Grupos"</li>
                  <li>Escolha o grupo onde a IA deve operar</li>
                  <li>Pronto! A IA responderá apenas nesse grupo</li>
                </ol>
              </div>

              {configs.map((c) => {
                const isSelected = groupDialogConfig?.id === c.id;
                const filteredGroups = availableGroups.filter(g =>
                  g.subject.toLowerCase().includes(groupSearch.toLowerCase()) ||
                  g.id.toLowerCase().includes(groupSearch.toLowerCase())
                );

                return (
                  <div key={c.id} className="bg-card border border-border rounded-lg p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <Phone className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-foreground">{c.instance_name}</h3>
                          {c.group_jid ? (
                            <p className="text-xs text-revenue font-medium mt-0.5">
                              ✅ Grupo ativo: {c.group_name || c.group_jid.split("@")[0]}
                            </p>
                          ) : (
                            <p className="text-xs text-muted-foreground mt-0.5">Nenhum grupo selecionado</p>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => handleSelectGroup(c)}
                        disabled={loadingGroups && isSelected}
                      >
                        {loadingGroups && isSelected ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Users className="h-3.5 w-3.5" />
                        )}
                        Buscar Grupos
                      </Button>
                    </div>

                    {/* Inline group selection area */}
                    {isSelected && (
                      <div className="border-t border-border pt-4 space-y-3">
                        {/* Search + Refresh */}
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              value={groupSearch}
                              onChange={(e) => setGroupSearch(e.target.value)}
                              placeholder="Buscar grupo..."
                              className="pl-9"
                            />
                          </div>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => handleSelectGroup(c)}
                            disabled={loadingGroups}
                          >
                            <RefreshCw className={`h-4 w-4 ${loadingGroups ? 'animate-spin' : ''}`} />
                          </Button>
                        </div>

                        {/* Error state */}
                        {fetchError && (
                          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                            <div className="flex items-start gap-3">
                              <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                              <div>
                                <p className="text-sm text-foreground font-medium mb-1">Não foi possível buscar grupos</p>
                                <p className="text-xs text-muted-foreground">{fetchError}</p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Loading state */}
                        {loadingGroups && availableGroups.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-10 gap-3">
                            <Loader2 className="h-6 w-6 text-primary animate-spin" />
                            <p className="text-sm text-muted-foreground">Buscando grupos da instância...</p>
                          </div>
                        ) : filteredGroups.length > 0 ? (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <p className="text-xs text-muted-foreground">{filteredGroups.length} grupo(s) encontrados</p>
                              {fetchingPictures && <Loader2 className="h-3 w-3 text-muted-foreground animate-spin" />}
                            </div>
                            {filteredGroups.map((g) => {
                              const isCurrentGroup = c.group_jid === g.id;
                              const initials = g.subject.slice(0, 2).toUpperCase();
                              return (
                                <button
                                  key={g.id}
                                  onClick={() => handleSaveGroup(g.id, g.subject)}
                                  className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors text-left ${
                                    isCurrentGroup
                                      ? 'border-primary/30 bg-primary/5'
                                      : 'border-border hover:bg-accent/50'
                                  }`}
                                >
                                  <div className="flex items-center gap-3 min-w-0">
                                    <Avatar className="h-9 w-9 shrink-0">
                                      {g.pictureUrl && <AvatarImage src={g.pictureUrl} alt={g.subject} />}
                                      <AvatarFallback className={`text-xs font-medium ${isCurrentGroup ? 'bg-primary/10 text-primary' : ''}`}>
                                        {initials}
                                      </AvatarFallback>
                                    </Avatar>
                                    <div className="min-w-0">
                                      <p className="text-sm font-medium text-foreground truncate">{g.subject}</p>
                                      <p className="text-xs text-muted-foreground">{g.size} participantes</p>
                                    </div>
                                  </div>
                                  {isCurrentGroup && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20 shrink-0">
                                      <Check className="h-3 w-3" /> Selecionado
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        ) : !loadingGroups && !fetchError && availableGroups.length === 0 && (
                          <div className="text-center py-8 text-muted-foreground">
                            <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">Nenhum grupo encontrado na instância</p>
                            <p className="text-xs mt-1">Verifique se a instância está conectada e participa de grupos</p>
                          </div>
                        )}

                        {/* Manual add fallback */}
                        <div className="border-t border-border pt-4 mt-2">
                          {!addingManual ? (
                            <Button onClick={() => setAddingManual(true)} variant="ghost" className="gap-2 text-muted-foreground">
                              <Plus className="h-4 w-4" /> Adicionar manualmente
                            </Button>
                          ) : (
                            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                              <h4 className="text-sm font-semibold text-foreground">Adicionar Manualmente</h4>
                              <div>
                                <Label className="text-xs">Nome do Grupo</Label>
                                <Input
                                  value={manualGroupName}
                                  onChange={(e) => setManualGroupName(e.target.value)}
                                  placeholder="Ex: Financeiro IA"
                                />
                              </div>
                              <div>
                                <Label className="text-xs">ID do Grupo (JID)</Label>
                                <Input
                                  value={manualGroupJid}
                                  onChange={(e) => setManualGroupJid(e.target.value)}
                                  placeholder="Ex: 120363001234567890@g.us"
                                />
                              </div>
                              <div className="flex gap-2">
                                <Button onClick={handleManualGroupAdd} size="sm" className="gap-1" disabled={!manualGroupJid.trim()}>
                                  <Check className="h-3.5 w-3.5" /> Salvar
                                </Button>
                                <Button onClick={() => setAddingManual(false)} size="sm" variant="outline">
                                  Cancelar
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

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

      {/* Reconnect QR Dialog */}
      <Dialog open={!!reconnect} onOpenChange={(open) => { if (!open) { stopReconnectPolling(); setReconnect(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reconectar — {reconnect?.config.instance_name}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 mt-2">
            {reconnect?.status === "connected" ? (
              <div className="flex flex-col items-center gap-3 py-8">
                <div className="p-3 rounded-full bg-revenue/10">
                  <CheckCircle2 className="h-8 w-8 text-revenue" />
                </div>
                <h3 className="text-sm font-semibold text-foreground">WhatsApp reconectado!</h3>
                <p className="text-xs text-muted-foreground text-center">
                  A instância está pronta para uso.
                </p>
              </div>
            ) : reconnect?.loading ? (
              <div className="flex flex-col items-center gap-3 py-8">
                <Loader2 className="h-8 w-8 text-primary animate-spin" />
                <p className="text-sm text-muted-foreground">Gerando QR Code...</p>
              </div>
            ) : (
              <>
                <p className="text-xs text-muted-foreground text-center">
                  Abra o WhatsApp no celular → Dispositivos conectados → Conectar dispositivo
                </p>
                {reconnect?.qrCodeBase64 && (
                  <div className="bg-card border border-border rounded-xl p-4">
                    <img src={reconnect.qrCodeBase64} alt="QR Code WhatsApp" className="w-64 h-64 object-contain" />
                  </div>
                )}
                {reconnect?.status === "waiting" && reconnect.qrCodeBase64 && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Aguardando leitura do QR Code...
                  </div>
                )}
                {reconnect?.error && (
                  <div className="text-xs px-3 py-2 rounded-lg bg-destructive/10 text-destructive text-center">
                    {reconnect.error}
                  </div>
                )}
                <Button variant="outline" size="sm" className="gap-1.5" onClick={handleReconnectRefreshQr} disabled={reconnect?.loading}>
                  {reconnect?.loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  Gerar novo QR
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

    </AppLayout>
  );
}
