import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import {
  Eye, EyeOff, Copy, RefreshCw, Zap, CheckCircle2, XCircle, AlertTriangle,
  ArrowLeft, Loader2, Shield, Webhook as WebhookIcon
} from "lucide-react";
import { Link } from "react-router-dom";

const ALL_EVENTS: Record<string, { label: string; events: string[] }> = {
  payment: {
    label: "Cobranças",
    events: [
      "PAYMENT_CREATED", "PAYMENT_UPDATED", "PAYMENT_CONFIRMED", "PAYMENT_RECEIVED",
      "PAYMENT_OVERDUE", "PAYMENT_DELETED", "PAYMENT_RESTORED", "PAYMENT_REFUNDED",
      "PAYMENT_RECEIVED_IN_CASH_UNDONE", "PAYMENT_CHARGEBACK_REQUESTED",
      "PAYMENT_CHARGEBACK_DISPUTE", "PAYMENT_AWAITING_CHARGEBACK_REVERSAL",
      "PAYMENT_DUNNING_RECEIVED", "PAYMENT_DUNNING_REQUESTED",
      "PAYMENT_BANK_SLIP_VIEWED", "PAYMENT_CHECKOUT_VIEWED", "PAYMENT_DUEDATE_WARNING",
    ],
  },
  transfer: {
    label: "Transferências",
    events: [
      "TRANSFER_CREATED", "TRANSFER_PENDING", "TRANSFER_IN_BANK_PROCESSING",
      "TRANSFER_BLOCKED", "TRANSFER_DONE", "TRANSFER_FAILED", "TRANSFER_CANCELLED",
    ],
  },
  bill: {
    label: "Contas a Pagar",
    events: [
      "BILL_CREATED", "BILL_PENDING", "BILL_BANK_PROCESSING", "BILL_PAID",
      "BILL_CANCELLED", "BILL_FAILED", "BILL_REFUNDED",
    ],
  },
  invoice: {
    label: "Notas Fiscais",
    events: [
      "INVOICE_CREATED", "INVOICE_UPDATED", "INVOICE_SYNCHRONIZED",
      "INVOICE_AUTHORIZED", "INVOICE_PROCESSING_CANCELLATION", "INVOICE_CANCELLED",
      "INVOICE_CANCELLATION_DENIED", "INVOICE_ERROR",
    ],
  },
  anticipation: {
    label: "Antecipações",
    events: [
      "ANTICIPATION_CREATED", "ANTICIPATION_APPROVED", "ANTICIPATION_DENIED",
      "ANTICIPATION_CREDITED", "ANTICIPATION_OVERDUE", "ANTICIPATION_DEBITED",
    ],
  },
  mobile: {
    label: "Recarga Celular",
    events: ["MOBILE_PHONE_RECHARGE_CONFIRMED", "MOBILE_PHONE_RECHARGE_CANCELLED"],
  },
  account: {
    label: "Status da Conta",
    events: [
      "ACCOUNT_STATUS_INITIAL_ALERT", "ACCOUNT_STATUS_FINAL_ALERT",
      "ACCOUNT_STATUS_AWAITING_ACTION_AUTHORIZATION",
    ],
  },
};

const ALL_EVENT_LIST = Object.values(ALL_EVENTS).flatMap((g) => g.events);

interface AsaasConfig {
  id: string;
  company_id: string;
  environment: string;
  api_key_sandbox: string | null;
  api_key_production: string | null;
  webhook_auth_token: string | null;
  webhook_id: string | null;
  webhook_status: string;
  notification_email: string | null;
  enabled_events: string[];
}

interface WebhookLog {
  id: string;
  asaas_event: string;
  entity_id: string | null;
  http_status_returned: number;
  created_at: string;
}

export default function AsaasIntegrationPage() {
  const { company } = useCompany();
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;

  const [config, setConfig] = useState<AsaasConfig | null>(null);
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [creatingWebhook, setCreatingWebhook] = useState(false);
  const [reactivating, setReactivating] = useState(false);

  // Form state
  const [apiKeySandbox, setApiKeySandbox] = useState("");
  const [apiKeyProduction, setApiKeyProduction] = useState("");
  const [environment, setEnvironment] = useState("sandbox");
  const [webhookAuthToken, setWebhookAuthToken] = useState("");
  const [notificationEmail, setNotificationEmail] = useState("");
  const [enabledEvents, setEnabledEvents] = useState<string[]>(ALL_EVENT_LIST);

  const [showKeySandbox, setShowKeySandbox] = useState(false);
  const [showKeyProduction, setShowKeyProduction] = useState(false);

  const loadData = useCallback(async () => {
    if (!company) return;
    setLoading(true);

    const [configRes, logsRes] = await Promise.all([
      supabase
        .from("asaas_config")
        .select("*")
        .eq("company_id", company.id)
        .maybeSingle(),
      supabase
        .from("asaas_webhook_logs")
        .select("id, asaas_event, entity_id, http_status_returned, created_at")
        .eq("company_id", company.id)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    if (configRes.data) {
      const c = configRes.data as any;
      setConfig(c);
      setApiKeySandbox(c.api_key_sandbox || "");
      setApiKeyProduction(c.api_key_production || "");
      setEnvironment(c.environment || "sandbox");
      setWebhookAuthToken(c.webhook_auth_token || "");
      setNotificationEmail(c.notification_email || "");
      setEnabledEvents((c.enabled_events as string[]) || ALL_EVENT_LIST);
    }

    setLogs((logsRes.data || []) as WebhookLog[]);
    setLoading(false);
  }, [company]);

  useEffect(() => { loadData(); }, [loadData]);

  const saveCredentials = async () => {
    if (!company) return;
    setSaving(true);

    const payload = {
      company_id: company.id,
      environment,
      api_key_sandbox: apiKeySandbox || null,
      api_key_production: apiKeyProduction || null,
      webhook_auth_token: webhookAuthToken || null,
      notification_email: notificationEmail || null,
      enabled_events: enabledEvents,
    };

    if (config) {
      const { error } = await supabase
        .from("asaas_config")
        .update(payload)
        .eq("id", config.id);
      if (error) toast.error("Erro ao salvar: " + error.message);
      else toast.success("Credenciais salvas!");
    } else {
      const { error } = await supabase
        .from("asaas_config")
        .insert(payload as any);
      if (error) toast.error("Erro ao salvar: " + error.message);
      else toast.success("Credenciais salvas!");
    }

    await loadData();
    setSaving(false);
  };

  const testConnection = async () => {
    if (!company) return;
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("asaas-api", {
        body: { action: "test-connection", company_id: company.id },
      });
      if (error) throw error;
      if (data?.data?.balance !== undefined) {
        toast.success(`Conexão OK! Saldo: R$ ${Number(data.data.balance).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`);
      } else if (data?.error) {
        toast.error("Erro da API Asaas: " + JSON.stringify(data.error));
      } else {
        toast.success("Conexão estabelecida!");
      }
    } catch (err: any) {
      toast.error("Erro ao testar: " + (err.message || String(err)));
    }
    setTesting(false);
  };

  const createWebhook = async () => {
    if (!company) return;
    setCreatingWebhook(true);
    try {
      const { data, error } = await supabase.functions.invoke("asaas-api", {
        body: { action: "create-webhook", company_id: company.id },
      });
      if (error) throw error;
      if (data?.ok) {
        toast.success("Webhook criado/atualizado no Asaas!");
        await loadData();
      } else {
        toast.error("Erro: " + JSON.stringify(data?.error || data));
      }
    } catch (err: any) {
      toast.error("Erro: " + (err.message || String(err)));
    }
    setCreatingWebhook(false);
  };

  const reactivateWebhook = async () => {
    if (!company) return;
    setReactivating(true);
    try {
      const { data, error } = await supabase.functions.invoke("asaas-api", {
        body: { action: "reactivate-webhook", company_id: company.id },
      });
      if (error) throw error;
      if (data?.ok) {
        toast.success("Fila reativada!");
        await loadData();
      } else {
        toast.error("Erro: " + JSON.stringify(data?.error || data));
      }
    } catch (err: any) {
      toast.error("Erro: " + (err.message || String(err)));
    }
    setReactivating(false);
  };

  const generateToken = () => {
    setWebhookAuthToken(crypto.randomUUID());
  };

  const copyWebhookUrl = () => {
    const url = `https://${projectId}.supabase.co/functions/v1/asaas-webhook`;
    navigator.clipboard.writeText(url);
    toast.success("URL copiada!");
  };

  const toggleEvent = (event: string) => {
    setEnabledEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    );
  };

  const selectAll = () => setEnabledEvents(ALL_EVENT_LIST);
  const deselectAll = () => setEnabledEvents([]);

  const webhookStatusBadge = () => {
    const status = config?.webhook_status || "inactive";
    if (status === "active") return <Badge variant="default" className="bg-revenue/10 text-revenue border-revenue/30">Ativo</Badge>;
    if (status === "interrupted") return <Badge variant="default" className="bg-warning/10 text-warning border-warning/30">Interrompido</Badge>;
    return <Badge variant="secondary">Inativo</Badge>;
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mb-8">
        <Link to="/settings/integrations" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4">
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar para Integrações
        </Link>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-[-0.02em]">Asaas</h1>
            <p className="text-sm text-muted-foreground">Configure a integração com a plataforma de pagamentos Asaas</p>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* Seção 1: Credenciais */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Credenciais</CardTitle>
            <CardDescription>Configure suas chaves de API e token de autenticação</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">API Key (Produção)</Label>
                <div className="relative">
                  <Input
                    type={showKeyProduction ? "text" : "password"}
                    value={apiKeyProduction}
                    onChange={(e) => setApiKeyProduction(e.target.value)}
                    placeholder="$aact_..."
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKeyProduction(!showKeyProduction)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showKeyProduction ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div>
                <Label className="text-xs">API Key (Sandbox)</Label>
                <div className="relative">
                  <Input
                    type={showKeySandbox ? "text" : "password"}
                    value={apiKeySandbox}
                    onChange={(e) => setApiKeySandbox(e.target.value)}
                    placeholder="$aact_..."
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKeySandbox(!showKeySandbox)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showKeySandbox ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Label className="text-xs">Ambiente</Label>
              <div className="flex items-center gap-2">
                <span className={`text-xs ${environment === "sandbox" ? "text-foreground font-medium" : "text-muted-foreground"}`}>Sandbox</span>
                <Switch
                  checked={environment === "production"}
                  onCheckedChange={(checked) => setEnvironment(checked ? "production" : "sandbox")}
                />
                <span className={`text-xs ${environment === "production" ? "text-foreground font-medium" : "text-muted-foreground"}`}>Produção</span>
              </div>
            </div>

            <div>
              <Label className="text-xs">Webhook Auth Token</Label>
              <div className="flex gap-2">
                <Input
                  value={webhookAuthToken}
                  onChange={(e) => setWebhookAuthToken(e.target.value)}
                  placeholder="Token de autenticação do webhook"
                  className="flex-1"
                />
                <Button variant="outline" size="sm" onClick={generateToken} className="shrink-0">
                  <RefreshCw className="h-3.5 w-3.5 mr-1" /> Gerar
                </Button>
              </div>
            </div>

            <div>
              <Label className="text-xs">Email de notificação</Label>
              <Input
                type="email"
                value={notificationEmail}
                onChange={(e) => setNotificationEmail(e.target.value)}
                placeholder="alertas@suaempresa.com"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button onClick={saveCredentials} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                Salvar credenciais
              </Button>
              <Button variant="outline" onClick={testConnection} disabled={testing || !config}>
                {testing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Zap className="h-4 w-4 mr-1" />}
                Testar conexão
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Seção 2: Webhook */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Webhook</CardTitle>
                <CardDescription>Receba notificações do Asaas em tempo real</CardDescription>
              </div>
              {webhookStatusBadge()}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-xs">URL do Webhook</Label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={`https://${projectId}.supabase.co/functions/v1/asaas-webhook`}
                  className="font-mono text-xs"
                />
                <Button variant="outline" size="icon" onClick={copyWebhookUrl}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={createWebhook} disabled={creatingWebhook || !config}>
                {creatingWebhook ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <WebhookIcon className="h-4 w-4 mr-1" />}
                {config?.webhook_id ? "Atualizar Webhook" : "Criar Webhook"}
              </Button>
              {config?.webhook_status === "interrupted" && (
                <Button variant="outline" onClick={reactivateWebhook} disabled={reactivating}>
                  {reactivating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                  Reativar fila
                </Button>
              )}
            </div>

            {/* Logs */}
            {logs.length > 0 && (
              <div>
                <Label className="text-xs mb-2 block">Últimas notificações</Label>
                <div className="border border-border rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted/50">
                        <th className="text-left p-2 font-medium text-muted-foreground">Data</th>
                        <th className="text-left p-2 font-medium text-muted-foreground">Evento</th>
                        <th className="text-left p-2 font-medium text-muted-foreground">Entity ID</th>
                        <th className="text-right p-2 font-medium text-muted-foreground">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map((log) => (
                        <tr key={log.id} className="border-t border-border">
                          <td className="p-2 text-muted-foreground">
                            {new Date(log.created_at).toLocaleString("pt-BR")}
                          </td>
                          <td className="p-2 font-mono">{log.asaas_event}</td>
                          <td className="p-2 text-muted-foreground font-mono">{log.entity_id || "—"}</td>
                          <td className="p-2 text-right">
                            {log.http_status_returned === 200 ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-revenue inline" />
                            ) : (
                              <XCircle className="h-3.5 w-3.5 text-expense inline" />
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Seção 3: Eventos */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Eventos Ativos</CardTitle>
                <CardDescription>Selecione quais eventos do Asaas deseja receber</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={selectAll}>Selecionar todos</Button>
                <Button variant="outline" size="sm" onClick={deselectAll}>Desmarcar todos</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Object.entries(ALL_EVENTS).map(([key, group]) => (
                <div key={key}>
                  <h4 className="text-xs font-semibold text-foreground mb-2">{group.label}</h4>
                  <div className="space-y-1.5">
                    {group.events.map((event) => (
                      <label key={event} className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={enabledEvents.includes(event)}
                          onCheckedChange={() => toggleEvent(event)}
                        />
                        <span className="text-xs text-muted-foreground">{event}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="pt-4">
              <Button onClick={saveCredentials} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                Salvar eventos
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
