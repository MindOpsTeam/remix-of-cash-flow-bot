import { mensagemDeErro } from "@/lib/erros";
import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { toast } from "sonner";
import {
  Eye, EyeOff, Copy, RefreshCw, Zap, CheckCircle2, XCircle,
  ArrowLeft, Loader2, Shield, Webhook as WebhookIcon, Lock,
  Link2, List, AlertTriangle, Info, ChevronDown, ExternalLink
} from "lucide-react";
import { Link } from "react-router-dom";

const ALL_EVENTS: Record<string, { label: string; events: string[] }> = {
  payment: {
    label: "Cobranças",
    events: [
      "PAYMENT_CREATED", "PAYMENT_UPDATED", "PAYMENT_CONFIRMED", "PAYMENT_RECEIVED",
      "PAYMENT_OVERDUE", "PAYMENT_DELETED", "PAYMENT_RESTORED", "PAYMENT_REFUNDED",
      "PAYMENT_PARTIALLY_REFUNDED", "PAYMENT_REFUND_IN_PROGRESS", "PAYMENT_REFUND_DENIED",
      "PAYMENT_ANTICIPATED", "PAYMENT_AUTHORIZED",
      "PAYMENT_AWAITING_RISK_ANALYSIS", "PAYMENT_APPROVED_BY_RISK_ANALYSIS", "PAYMENT_REPROVED_BY_RISK_ANALYSIS",
      "PAYMENT_CREDIT_CARD_CAPTURE_REFUSED", "PAYMENT_RECEIVED_IN_CASH_UNDONE",
      "PAYMENT_CHARGEBACK_REQUESTED", "PAYMENT_CHARGEBACK_DISPUTE", "PAYMENT_AWAITING_CHARGEBACK_REVERSAL",
      "PAYMENT_DUNNING_RECEIVED", "PAYMENT_DUNNING_REQUESTED",
      "PAYMENT_BANK_SLIP_VIEWED", "PAYMENT_CHECKOUT_VIEWED",
      "PAYMENT_SPLIT_CANCELLED", "PAYMENT_SPLIT_DIVERGENCE_BLOCK", "PAYMENT_SPLIT_DIVERGENCE_BLOCK_FINISHED",
    ],
  },
  subscription: {
    label: "Assinaturas",
    events: [
      "SUBSCRIPTION_CREATED", "SUBSCRIPTION_UPDATED", "SUBSCRIPTION_INACTIVATED", "SUBSCRIPTION_DELETED",
      "SUBSCRIPTION_SPLIT_DISABLED", "SUBSCRIPTION_SPLIT_DIVERGENCE_BLOCK", "SUBSCRIPTION_SPLIT_DIVERGENCE_BLOCK_FINISHED",
    ],
  },
  invoice: {
    label: "Notas Fiscais",
    events: [
      "INVOICE_CREATED", "INVOICE_UPDATED", "INVOICE_SYNCHRONIZED", "INVOICE_AUTHORIZED",
      "INVOICE_PROCESSING_CANCELLATION", "INVOICE_CANCELED", "INVOICE_CANCELLATION_DENIED", "INVOICE_ERROR",
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
    label: "Pague Contas",
    events: [
      "BILL_CREATED", "BILL_PENDING", "BILL_BANK_PROCESSING", "BILL_PAID",
      "BILL_CANCELLED", "BILL_FAILED", "BILL_REFUNDED",
    ],
  },
  anticipation: {
    label: "Antecipações",
    events: [
      "RECEIVABLE_ANTICIPATION_CANCELLED", "RECEIVABLE_ANTICIPATION_SCHEDULED",
      "RECEIVABLE_ANTICIPATION_PENDING", "RECEIVABLE_ANTICIPATION_CREDITED",
      "RECEIVABLE_ANTICIPATION_DEBITED", "RECEIVABLE_ANTICIPATION_DENIED", "RECEIVABLE_ANTICIPATION_OVERDUE",
    ],
  },
  mobile: {
    label: "Recarga Celular",
    events: [
      "MOBILE_PHONE_RECHARGE_PENDING", "MOBILE_PHONE_RECHARGE_CANCELLED",
      "MOBILE_PHONE_RECHARGE_CONFIRMED", "MOBILE_PHONE_RECHARGE_REFUNDED",
    ],
  },
  account: {
    label: "Situação da Conta",
    events: [
      "ACCOUNT_STATUS_BANK_ACCOUNT_INFO_APPROVED", "ACCOUNT_STATUS_BANK_ACCOUNT_INFO_AWAITING_APPROVAL",
      "ACCOUNT_STATUS_BANK_ACCOUNT_INFO_PENDING", "ACCOUNT_STATUS_BANK_ACCOUNT_INFO_REJECTED",
      "ACCOUNT_STATUS_COMMERCIAL_INFO_APPROVED", "ACCOUNT_STATUS_COMMERCIAL_INFO_AWAITING_APPROVAL",
      "ACCOUNT_STATUS_COMMERCIAL_INFO_EXPIRED", "ACCOUNT_STATUS_COMMERCIAL_INFO_EXPIRING_SOON",
      "ACCOUNT_STATUS_COMMERCIAL_INFO_PENDING", "ACCOUNT_STATUS_COMMERCIAL_INFO_REJECTED",
      "ACCOUNT_STATUS_DOCUMENT_APPROVED", "ACCOUNT_STATUS_DOCUMENT_AWAITING_APPROVAL",
      "ACCOUNT_STATUS_DOCUMENT_PENDING", "ACCOUNT_STATUS_DOCUMENT_REJECTED",
      "ACCOUNT_STATUS_GENERAL_APPROVAL_APPROVED", "ACCOUNT_STATUS_GENERAL_APPROVAL_AWAITING_APPROVAL",
      "ACCOUNT_STATUS_GENERAL_APPROVAL_PENDING", "ACCOUNT_STATUS_GENERAL_APPROVAL_REJECTED",
    ],
  },
  checkout: {
    label: "Checkout",
    events: [
      "CHECKOUT_CREATED", "CHECKOUT_CANCELED", "CHECKOUT_EXPIRED", "CHECKOUT_PAID",
    ],
  },
  balance: {
    label: "Bloqueios de Saldo",
    events: [
      "BALANCE_VALUE_BLOCKED", "BALANCE_VALUE_UNBLOCKED",
    ],
  },
  internalTransfer: {
    label: "Movimentações Internas",
    events: [
      "INTERNAL_TRANSFER_CREDIT", "INTERNAL_TRANSFER_DEBIT",
    ],
  },
  accessToken: {
    label: "Chaves de API",
    events: [
      "ACCESS_TOKEN_CREATED", "ACCESS_TOKEN_DELETED", "ACCESS_TOKEN_DISABLED",
      "ACCESS_TOKEN_ENABLED", "ACCESS_TOKEN_EXPIRED", "ACCESS_TOKEN_EXPIRING_SOON",
    ],
  },
};

const ALL_EVENT_LIST = Object.values(ALL_EVENTS).flatMap((g) => g.events);

function maskKey(key: string | null): string {
  if (!key) return "";
  if (key.length <= 8) return "••••••••";
  return "••••••••••••" + key.slice(-4);
}

interface AsaasConfig {
  id: string;
  environment: string;
  api_key_sandbox: string | null;
  api_key_production: string | null;
  webhook_auth_token: string | null;
  webhook_id: string | null;
  webhook_url: string | null;
  webhook_email: string | null;
  webhook_status: string;
  webhook_send_type: string | null;
  notification_email: string | null;
  enabled_events: string[];
}

interface WebhookEvent {
  id: string;
  event_type: string;
  event_category: string;
  entity_id: string | null;
  processed: boolean;
  created_at: string;
}

export interface AsaasIntegrationBaseProps {
  configTable: "asaas_config" | "company_asaas_config";
  eventsTable: "asaas_webhook_events" | "company_asaas_webhook_events";
  edgeFunction: "asaas-api" | "company-asaas-api";
  webhookFunction: "asaas-webhook" | "company-asaas-webhook";
  ownerKey: "user_id" | "company_id";
  ownerId: string | undefined;
  backLink: string;
  title: string;
  securityIsolationLabel: string;
  description?: string;
  emailPlaceholder?: string;
}

export function AsaasIntegrationBase({
  configTable,
  eventsTable,
  edgeFunction,
  webhookFunction,
  ownerKey,
  ownerId,
  backLink,
  title,
  securityIsolationLabel,
  description = "Configure sua conta Asaas para sincronizar cobranças, assinaturas e transferências",
  emailPlaceholder = "alertas@email.com",
}: AsaasIntegrationBaseProps) {
  const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string)?.replace(/\/$/, "");

  const [config, setConfig] = useState<AsaasConfig | null>(null);
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [creatingWebhook, setCreatingWebhook] = useState(false);
  const [reactivating, setReactivating] = useState(false);

  const [apiKeySandbox, setApiKeySandbox] = useState("");
  const [apiKeyProduction, setApiKeyProduction] = useState("");
  const [environment, setEnvironment] = useState("sandbox");
  const [webhookAuthToken, setWebhookAuthToken] = useState("");
  const [notificationEmail, setNotificationEmail] = useState("");
  const [webhookSendType, setWebhookSendType] = useState("SEQUENTIALLY");
  const [enabledEvents, setEnabledEvents] = useState<string[]>(ALL_EVENT_LIST);

  const [editingKeyProduction, setEditingKeyProduction] = useState(false);
  const [editingKeySandbox, setEditingKeySandbox] = useState(false);
  const [showKeySandbox, setShowKeySandbox] = useState(false);
  const [showKeyProduction, setShowKeyProduction] = useState(false);
  const [ipInfoOpen, setIpInfoOpen] = useState(false);

  const loadData = useCallback(async () => {
    if (!ownerId) return;
    setLoading(true);

    const [configRes, eventsRes] = await Promise.all([
      supabase
        .from(configTable as any)
        .select("*")
        .eq(ownerKey, ownerId)
        .maybeSingle(),
      supabase
        .from(eventsTable as any)
        .select("id, event_type, event_category, entity_id, processed, created_at")
        .eq(ownerKey, ownerId)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    if (configRes.data) {
      const c = configRes.data as any;
      setConfig(c);
      setApiKeySandbox(c.api_key_sandbox || "");
      setApiKeyProduction(c.api_key_production || "");
      setEnvironment(c.environment || "sandbox");
      setWebhookAuthToken(c.webhook_auth_token || "");
      setNotificationEmail(c.notification_email || "");
      setWebhookSendType(c.webhook_send_type || "SEQUENTIALLY");
      setEnabledEvents((c.enabled_events as string[]) || ALL_EVENT_LIST);
      setEditingKeyProduction(false);
      setEditingKeySandbox(false);
    }

    setEvents((eventsRes.data || []) as unknown as WebhookEvent[]);
    setLoading(false);
  }, [ownerId, configTable, eventsTable, ownerKey]);

  useEffect(() => { loadData(); }, [loadData]);

  const saveCredentials = async () => {
    if (!ownerId) return;
    setSaving(true);

    const payload: Record<string, unknown> = {
      [ownerKey]: ownerId,
      environment,
      webhook_auth_token: webhookAuthToken || null,
      notification_email: notificationEmail || null,
      webhook_send_type: webhookSendType,
      enabled_events: enabledEvents,
    };

    if (editingKeyProduction) payload.api_key_production = apiKeyProduction || null;
    if (editingKeySandbox) payload.api_key_sandbox = apiKeySandbox || null;

    if (config) {
      const { error } = await supabase
        .from(configTable as any)
        .update(payload)
        .eq("id", config.id);
      if (error) toast.error("Erro ao salvar: " + mensagemDeErro(error));
      else toast.success("Configurações salvas com sucesso!");
    } else {
      payload.api_key_production = apiKeyProduction || null;
      payload.api_key_sandbox = apiKeySandbox || null;
      const { error } = await supabase
        .from(configTable as any)
        .insert(payload as any);
      if (error) toast.error("Erro ao salvar: " + mensagemDeErro(error));
      else toast.success("Configurações salvas com sucesso!");
    }

    await loadData();
    setSaving(false);
  };

  const invokeEdgeFunction = async (action: string) => {
    const body: Record<string, unknown> = { action };
    if (ownerKey === "company_id") body.company_id = ownerId;
    return supabase.functions.invoke(edgeFunction, { body });
  };

  const testConnection = async () => {
    setTesting(true);
    try {
      const { data, error } = await invokeEdgeFunction("test-connection");
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
    setCreatingWebhook(true);
    try {
      const { data, error } = await invokeEdgeFunction("create-webhook");
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
    setReactivating(true);
    try {
      const { data, error } = await invokeEdgeFunction("reactivate-webhook");
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

  const generateToken = () => setWebhookAuthToken(crypto.randomUUID());

  const copyWebhookUrl = () => {
    const url = `${supabaseUrl}/functions/v1/${webhookFunction}`;
    navigator.clipboard.writeText(url);
    toast.success("URL copiada!");
  };

  const toggleEvent = (event: string) =>
    setEnabledEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    );

  const toggleCategoryAll = (groupKey: string) => {
    const group = ALL_EVENTS[groupKey];
    if (!group) return;
    const allSelected = group.events.every((e) => enabledEvents.includes(e));
    if (allSelected) {
      setEnabledEvents((prev) => prev.filter((e) => !group.events.includes(e)));
    } else {
      setEnabledEvents((prev) => [...new Set([...prev, ...group.events])]);
    }
  };

  const selectAll = () => setEnabledEvents(ALL_EVENT_LIST);
  const deselectAll = () => setEnabledEvents([]);

  const connectionStatus = () => {
    if (!config) return { label: "Não configurado", variant: "secondary" as const, color: "text-muted-foreground" };
    const hasKey = environment === "production" ? !!config.api_key_production : !!config.api_key_sandbox;
    if (!hasKey) return { label: "Não configurado", variant: "secondary" as const, color: "text-muted-foreground" };
    if (config.webhook_status === "active") return { label: "Conectado", variant: "default" as const, color: "text-revenue" };
    if (config.webhook_status === "interrupted") return { label: "Interrompido", variant: "destructive" as const, color: "text-destructive" };
    return { label: "Configurado", variant: "outline" as const, color: "text-primary" };
  };

  const webhookStatusBadge = () => {
    const status = config?.webhook_status || "inactive";
    if (status === "active") return <Badge variant="default" className="bg-revenue/10 text-revenue border-revenue/30">Ativo</Badge>;
    if (status === "interrupted") return <Badge variant="default" className="bg-destructive/10 text-destructive border-destructive/30 animate-pulse">Interrompido</Badge>;
    return <Badge variant="secondary">Inativo</Badge>;
  };

  const connStatus = connectionStatus();

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
        <Link to={backLink} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4">
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar para Integrações
        </Link>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground tracking-[-0.02em]">{title}</h1>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
          </div>
          <Badge variant={connStatus.variant} className={connStatus.color}>
            {connStatus.label}
          </Badge>
        </div>
      </div>

      <div className="space-y-6">
        <div className="flex items-start gap-3 p-4 rounded-xl border border-primary/20 bg-primary/5">
          <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <div className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Segurança:</span> As API Keys são salvas de forma segura no banco de dados com isolamento por {securityIsolationLabel} via RLS.
            O webhook é autenticado via token exclusivo no header <code className="text-primary font-mono">asaas-access-token</code>.
          </div>
        </div>

        {/* Credenciais */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-primary" />
              <div>
                <CardTitle className="text-base">Credenciais</CardTitle>
                <CardDescription>Configure suas chaves de API e token de autenticação</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">API Key (Produção)</Label>
                {config?.api_key_production && !editingKeyProduction ? (
                  <div className="flex gap-2">
                    <Input readOnly value={maskKey(config.api_key_production)} className="font-mono text-xs" />
                    <Button variant="outline" size="sm" onClick={() => { setEditingKeyProduction(true); setApiKeyProduction(""); }}>
                      Alterar
                    </Button>
                  </div>
                ) : (
                  <div className="relative">
                    <Input
                      type={showKeyProduction ? "text" : "password"}
                      value={apiKeyProduction}
                      onChange={(e) => { setApiKeyProduction(e.target.value); setEditingKeyProduction(true); }}
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
                )}
              </div>
              <div>
                <Label className="text-xs">API Key (Sandbox)</Label>
                {config?.api_key_sandbox && !editingKeySandbox ? (
                  <div className="flex gap-2">
                    <Input readOnly value={maskKey(config.api_key_sandbox)} className="font-mono text-xs" />
                    <Button variant="outline" size="sm" onClick={() => { setEditingKeySandbox(true); setApiKeySandbox(""); }}>
                      Alterar
                    </Button>
                  </div>
                ) : (
                  <div className="relative">
                    <Input
                      type={showKeySandbox ? "text" : "password"}
                      value={apiKeySandbox}
                      onChange={(e) => { setApiKeySandbox(e.target.value); setEditingKeySandbox(true); }}
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
                )}
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
                  className="flex-1 font-mono text-xs"
                />
                <Button variant="outline" size="sm" onClick={generateToken} className="shrink-0">
                  <RefreshCw className="h-3.5 w-3.5 mr-1" /> Gerar
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Email de notificação</Label>
                <Input
                  type="email"
                  value={notificationEmail}
                  onChange={(e) => setNotificationEmail(e.target.value)}
                  placeholder={emailPlaceholder}
                />
              </div>
              <div>
                <Label className="text-xs">Tipo de envio do Webhook</Label>
                <Select value={webhookSendType} onValueChange={setWebhookSendType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SEQUENTIALLY">Sequencial</SelectItem>
                    <SelectItem value="NON_SEQUENTIALLY">Não sequencial</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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

        {/* Webhook */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Link2 className="h-4 w-4 text-primary" />
                <div>
                  <CardTitle className="text-base">Webhook</CardTitle>
                  <CardDescription>Receba notificações do Asaas em tempo real</CardDescription>
                </div>
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
                  value={`${supabaseUrl}/functions/v1/${webhookFunction}`}
                  className="font-mono text-xs"
                />
                <Button variant="outline" size="icon" onClick={copyWebhookUrl} aria-label="Copiar URL do webhook">
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {config?.webhook_status === "interrupted" && (
              <div className="flex items-start gap-3 p-3 rounded-lg border border-destructive/30 bg-destructive/5">
                <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                <div className="text-xs text-destructive">
                  A fila de webhook está interrompida. Clique em "Reativar fila" para retomar.
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button onClick={createWebhook} disabled={creatingWebhook || !config}>
                {creatingWebhook ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <WebhookIcon className="h-4 w-4 mr-1" />}
                {config?.webhook_id ? "Atualizar Webhook" : "Criar Webhook"}
              </Button>
              {config?.webhook_status === "interrupted" && (
                <Button variant="destructive" onClick={reactivateWebhook} disabled={reactivating}>
                  {reactivating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                  Reativar fila
                </Button>
              )}
            </div>

            <Collapsible open={ipInfoOpen} onOpenChange={setIpInfoOpen}>
              <CollapsibleTrigger asChild>
                <button className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full">
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${ipInfoOpen ? "rotate-180" : ""}`} />
                  IPs oficiais do Asaas (whitelist de firewall)
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-2 p-3 rounded-lg bg-muted/50 border border-border text-xs text-muted-foreground space-y-2">
                  <p>Se você usa firewall ou WAF, adicione os IPs oficiais do Asaas na whitelist para garantir o recebimento dos webhooks.</p>
                  <a
                    href="https://docs.asaas.com/docs/ips-oficiais-do-asaas"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    Ver lista de IPs oficiais <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {events.length > 0 && (
              <div>
                <Label className="text-xs mb-2 block">Últimas 10 notificações</Label>
                <div className="border border-border rounded-xl overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted/50">
                        <th className="text-left p-2 font-medium text-muted-foreground">Data</th>
                        <th className="text-left p-2 font-medium text-muted-foreground">Evento</th>
                        <th className="text-left p-2 font-medium text-muted-foreground">Categoria</th>
                        <th className="text-left p-2 font-medium text-muted-foreground">Entity ID</th>
                        <th className="text-right p-2 font-medium text-muted-foreground">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {events.map((ev) => (
                        <tr key={ev.id} className="border-t border-border">
                          <td className="p-2 text-muted-foreground">{new Date(ev.created_at).toLocaleString("pt-BR")}</td>
                          <td className="p-2 font-mono">{ev.event_type}</td>
                          <td className="p-2">
                            <Badge variant="outline" className="text-[10px]">{ev.event_category}</Badge>
                          </td>
                          <td className="p-2 text-muted-foreground font-mono">{ev.entity_id || "—"}</td>
                          <td className="p-2 text-right">
                            {ev.processed
                              ? <CheckCircle2 className="h-3.5 w-3.5 text-revenue inline" />
                              : <XCircle className="h-3.5 w-3.5 text-muted-foreground inline" />}
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

        {/* Eventos */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <List className="h-4 w-4 text-primary" />
                <div>
                  <CardTitle className="text-base">Eventos Ativos</CardTitle>
                  <CardDescription>Selecione quais eventos do Asaas deseja receber</CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground font-mono">{enabledEvents.length}/{ALL_EVENT_LIST.length}</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={selectAll}>Selecionar todos ({ALL_EVENT_LIST.length})</Button>
                  <Button variant="outline" size="sm" onClick={deselectAll}>Desmarcar todos</Button>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Accordion type="multiple" className="w-full">
              {Object.entries(ALL_EVENTS).map(([key, group]) => {
                const selectedCount = group.events.filter((e) => enabledEvents.includes(e)).length;
                const allSelected = selectedCount === group.events.length;
                return (
                  <AccordionItem key={key} value={key}>
                    <AccordionTrigger className="hover:no-underline py-3">
                      <div className="flex items-center gap-3 w-full">
                        <Checkbox
                          checked={allSelected}
                          onCheckedChange={() => toggleCategoryAll(key)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <span className="text-sm font-medium text-foreground">{group.label}</span>
                        <Badge variant="outline" className="text-[10px] ml-auto mr-2">
                          {selectedCount}/{group.events.length}
                        </Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 pl-8">
                        {group.events.map((event) => (
                          <label key={event} className="flex items-center gap-2 cursor-pointer py-0.5">
                            <Checkbox
                              checked={enabledEvents.includes(event)}
                              onCheckedChange={() => toggleEvent(event)}
                            />
                            <span className="text-xs text-muted-foreground font-mono">{event}</span>
                          </label>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
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
