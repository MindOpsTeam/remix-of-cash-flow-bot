import { mensagemDeErro } from "@/lib/erros";
import { AppLayout } from "@/components/AppLayout";
import { Shield, ChevronRight, Landmark, Webhook, Plus, ArrowDownLeft, ArrowUpRight, Copy, Trash2, Eye, EyeOff, Activity, CheckCircle2, XCircle, Clock, FileText, Layers, Receipt, PlugZap } from "lucide-react";
import { Link } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { CATALOGO_INTEGRACOES, type CategoriaIntegracao, type Integracao } from "@/lib/integracoes-catalogo";
import { carregarConfiguradas } from "@/lib/integracoes-io";
import { DialogIntegracao } from "@/components/integracoes/ConfiguracaoIntegracao";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

/**
 * Ícone por CATEGORIA, não por integração.
 *
 * A lista de cards deixou de ser escrita à mão: ela vem de CATALOGO_INTEGRACOES,
 * a mesma fonte que alimenta a central de configuração e o wizard. Antes eram
 * duas listas, e elas divergiram — o Stripe e o WhatsApp existiam no catálogo e
 * simplesmente não apareciam aqui, sem nenhum erro que denunciasse isso.
 */
const ICONE_POR_CATEGORIA: Record<CategoriaIntegracao, typeof Shield> = {
  banco: Landmark,
  cobranca: Receipt,
  fiscal: FileText,
  comunicacao: PlugZap,
  dados: Layers,
};

/** Só telas de configuração de verdade viram link; o resto abre o formulário aqui. */
function telaDeConfiguracao(i: Integracao): string | null {
  return i.telaDedicada?.startsWith("/settings/") ? i.telaDedicada : null;
}

interface WebhookConfig {
  id: string;
  name: string;
  direction: "inbound" | "outbound";
  url: string | null;
  secret_token: string;
  auto_create_transaction: boolean;
  default_type: string | null;
  default_account_id: string | null;
  default_cost_center_id: string | null;
  active: boolean;
  created_at: string;
}

interface WebhookLog {
  id: string;
  direction: string;
  payload: Record<string, unknown>;
  status: string;
  error_message: string | null;
  created_at: string;
}

interface Account { id: string; name: string; code: string | null; type: string }
interface CostCenter { id: string; name: string }

export default function IntegrationsPage() {
  const { company } = useCompany();
  // "Configurado" vem da MESMA função que a central de configuração usa, para os
  // dois lugares nunca discordarem sobre o que já está ligado.
  const [configuradas, setConfiguradas] = useState<string[]>([]);
  const [selecionada, setSelecionada] = useState<Integracao | null>(null);
  const conectados = configuradas.length;

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
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [logsDialogOpen, setLogsDialogOpen] = useState(false);
  const [selectedWebhook, setSelectedWebhook] = useState<WebhookConfig | null>(null);
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [showTokens, setShowTokens] = useState<Record<string, boolean>>({});

  const [formName, setFormName] = useState("");
  const [formDirection, setFormDirection] = useState<"inbound" | "outbound">("inbound");
  const [formUrl, setFormUrl] = useState("");
  const [formAutoCreate, setFormAutoCreate] = useState(false);
  const [formDefaultType, setFormDefaultType] = useState("expense");
  const [formDefaultAccount, setFormDefaultAccount] = useState("");
  const [formDefaultCC, setFormDefaultCC] = useState("");

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;

  const loadData = useCallback(async () => {
    if (!company) return;
    const [wh, acc, cc] = await Promise.all([
      supabase.from("webhooks").select("*").eq("company_id", company.id).order("created_at", { ascending: false }),
      supabase.from("chart_of_accounts").select("id, name, code, type").eq("company_id", company.id).order("code"),
      supabase.from("cost_centers").select("id, name").eq("company_id", company.id).eq("active", true),
    ]);
    if (wh.data) setWebhooks(wh.data as WebhookConfig[]);
    if (acc.data) setAccounts(acc.data);
    if (cc.data) setCostCenters(cc.data);
  }, [company]);

  useEffect(() => { loadData(); }, [loadData]);

  const createWebhook = async () => {
    if (!company || !formName) return;
    const payload: Record<string, unknown> = {
      company_id: company.id,
      name: formName,
      direction: formDirection,
      auto_create_transaction: formAutoCreate,
      default_type: formDefaultType || null,
      default_account_id: formDefaultAccount || null,
      default_cost_center_id: formDefaultCC || null,
    };
    if (formDirection === "outbound" && formUrl) payload.url = formUrl;

    const { error } = await supabase.from("webhooks").insert(payload as any);
    if (error) {
      toast.error("Erro ao criar webhook: " + mensagemDeErro(error));
    } else {
      toast.success("Webhook criado com sucesso!");
      resetForm();
      setDialogOpen(false);
      loadData();
    }
  };

  const toggleActive = async (wh: WebhookConfig) => {
    await supabase.from("webhooks").update({ active: !wh.active }).eq("id", wh.id);
    loadData();
  };

  const deleteWebhook = async (id: string) => {
    await supabase.from("webhooks").delete().eq("id", id);
    toast.success("Webhook removido");
    loadData();
  };

  const viewLogs = async (wh: WebhookConfig) => {
    setSelectedWebhook(wh);
    const { data } = await supabase
      .from("webhook_logs")
      .select("*")
      .eq("webhook_id", wh.id)
      .order("created_at", { ascending: false })
      .limit(20);
    setLogs((data || []) as WebhookLog[]);
    setLogsDialogOpen(true);
  };

  const copyUrl = (wh: WebhookConfig) => {
    const url = `https://${projectId}.supabase.co/functions/v1/webhook-receiver/${wh.id}`;
    navigator.clipboard.writeText(url);
    toast.success("URL copiada!");
  };

  const copyToken = (token: string) => {
    navigator.clipboard.writeText(token);
    toast.success("Token copiado!");
  };

  const resetForm = () => {
    setFormName("");
    setFormDirection("inbound");
    setFormUrl("");
    setFormAutoCreate(false);
    setFormDefaultType("expense");
    setFormDefaultAccount("");
    setFormDefaultCC("");
  };

  const statusIcon = (s: string) => {
    if (s === "processed" || s === "sent") return <CheckCircle2 className="h-3.5 w-3.5 text-revenue" />;
    if (s === "failed") return <XCircle className="h-3.5 w-3.5 text-expense" />;
    return <Clock className="h-3.5 w-3.5 text-muted-foreground" />;
  };

  return (
    <AppLayout>
      {/* Integration Cards */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground tracking-[-0.02em]">Integrações — Empresa</h1>
        <p className="text-sm text-muted-foreground mt-1 mb-6">
          Conecte as contas da empresa para automatizar o financeiro
        </p>
        <p className="text-sm mt-1">
          <span className="font-medium text-foreground">{conectados}</span>
          <span className="text-muted-foreground"> de {CATALOGO_INTEGRACOES.length} serviços conectados nesta empresa</span>
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {CATALOGO_INTEGRACOES.map((item) => {
            const Icone = ICONE_POR_CATEGORIA[item.categoria];
            const configurada = configuradas.includes(item.id);
            const tela = telaDeConfiguracao(item);

            const corpo = (
              <div className="bg-card border border-border rounded-lg p-5 hover:border-primary/40 hover:shadow-card-hover transition-all cursor-pointer h-full text-left w-full">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Icone className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex items-center gap-2">
                    {configurada ? (
                      <Badge className="gap-1 text-[10px]">
                        <CheckCircle2 className="h-3 w-3" />
                        Conectado
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">
                        Não configurado
                      </Badge>
                    )}
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
                <h3 className="text-sm font-semibold text-foreground">{item.nome}</h3>
                <p className="text-xs text-muted-foreground mt-1">{item.ganho}</p>
              </div>
            );

            // Quem tem tela de configuração própria continua indo para ela; quem
            // não tem abre o formulário do catálogo aqui mesmo, em vez de não
            // aparecer em lugar nenhum — que era o caso do Stripe.
            return tela ? (
              <Link key={item.id} to={tela} className="block">{corpo}</Link>
            ) : (
              <button key={item.id} type="button" onClick={() => setSelecionada(item)} className="block">
                {corpo}
              </button>
            );
          })}
        </div>
      </div>

      <DialogIntegracao
        integracao={selecionada}
        companyId={company?.id}
        aberto={!!selecionada}
        onFechar={() => setSelecionada(null)}
        onSalvou={(id) => setConfiguradas((p) => (p.includes(id) ? p : [...p, id]))}
      />

      {/* Webhooks section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Webhooks genéricos</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Configure webhooks customizados para qualquer plataforma
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" onClick={resetForm}>
              <Plus className="h-4 w-4" /> Novo Webhook
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Criar Webhook</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div>
                <Label>Nome</Label>
                <Input placeholder="Ex: Stripe Pagamentos" value={formName} onChange={(e) => setFormName(e.target.value)} />
              </div>
              <div>
                <Label>Direção</Label>
                <Select value={formDirection} onValueChange={(v) => setFormDirection(v as "inbound" | "outbound")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inbound">Entrada (receber dados)</SelectItem>
                    <SelectItem value="outbound">Saída (enviar dados)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {formDirection === "outbound" && (
                <div>
                  <Label>URL de destino</Label>
                  <Input placeholder="https://api.exemplo.com/webhook" value={formUrl} onChange={(e) => setFormUrl(e.target.value)} />
                </div>
              )}
              <div className="flex items-center justify-between">
                <Label>Criar lançamento automaticamente</Label>
                <Switch checked={formAutoCreate} onCheckedChange={setFormAutoCreate} />
              </div>
              {formAutoCreate && (
                <>
                  <div>
                    <Label>Tipo padrão</Label>
                    <Select value={formDefaultType} onValueChange={setFormDefaultType}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="revenue">Receita</SelectItem>
                        <SelectItem value="expense">Despesa</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Conta contábil padrão</Label>
                    <Select value={formDefaultAccount} onValueChange={setFormDefaultAccount}>
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        {accounts.filter((a) => a.type === formDefaultType).map((a) => (
                          <SelectItem key={a.id} value={a.id}>{a.code} - {a.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Centro de custo padrão</Label>
                    <Select value={formDefaultCC} onValueChange={setFormDefaultCC}>
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        {costCenters.map((cc) => (
                          <SelectItem key={cc.id} value={cc.id}>{cc.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
              <Button className="w-full" onClick={createWebhook} disabled={!formName}>
                Criar Webhook
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {webhooks.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-12 text-center">
          <Webhook className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-sm font-semibold text-foreground mb-1">Nenhum webhook configurado</h3>
          <p className="text-xs text-muted-foreground">
            Crie um webhook para conectar com plataformas externas como Stripe ou qualquer sistema com API.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {webhooks.map((wh) => (
            <div key={wh.id} className="bg-card border border-border rounded-lg p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  {wh.direction === "inbound" ? (
                    <div className="p-2 rounded-lg bg-primary/10">
                      <ArrowDownLeft className="h-4 w-4 text-primary" />
                    </div>
                  ) : (
                    <div className="p-2 rounded-lg bg-accent">
                      <ArrowUpRight className="h-4 w-4 text-foreground" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-foreground truncate">{wh.name}</h3>
                      <Badge variant={wh.active ? "default" : "secondary"} className="text-[10px]">
                        {wh.active ? "Ativo" : "Inativo"}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        {wh.direction === "inbound" ? "Entrada" : "Saída"}
                      </Badge>
                    </div>
                    {wh.direction === "inbound" && (
                      <div className="flex items-center gap-2 mt-1.5">
                        <code className="text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded truncate max-w-xs">
                          https://{projectId}.supabase.co/functions/v1/webhook-receiver/{wh.id}
                        </code>
                        <button onClick={() => copyUrl(wh)} className="text-muted-foreground hover:text-foreground">
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[11px] text-muted-foreground">Token:</span>
                      <code className="text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                        {showTokens[wh.id] ? wh.secret_token : "••••••••••••"}
                      </code>
                      <button onClick={() => setShowTokens((p) => ({ ...p, [wh.id]: !p[wh.id] }))} className="text-muted-foreground hover:text-foreground">
                        {showTokens[wh.id] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      </button>
                      <button onClick={() => copyToken(wh.secret_token)} className="text-muted-foreground hover:text-foreground">
                        <Copy className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button variant="ghost" size="icon" onClick={() => viewLogs(wh)} title="Ver logs"><Activity className="h-4 w-4" /></Button>
                  <Switch checked={wh.active} onCheckedChange={() => toggleActive(wh)} />
                  <Button variant="ghost" size="icon" onClick={() => deleteWebhook(wh.id)} title="Excluir"><Trash2 className="h-4 w-4 text-expense" /></Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Logs dialog */}
      <Dialog open={logsDialogOpen} onOpenChange={setLogsDialogOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Logs — {selectedWebhook?.name}</DialogTitle>
          </DialogHeader>
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum log registrado ainda.</p>
          ) : (
            <div className="space-y-2 mt-2">
              {logs.map((log) => (
                <div key={log.id} className="border border-border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      {statusIcon(log.status)}
                      <span className="text-xs font-medium capitalize">{log.status}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(log.created_at).toLocaleString("pt-BR")}
                    </span>
                  </div>
                  {log.error_message && <p className="text-[11px] text-expense mt-1">{log.error_message}</p>}
                  <details className="mt-2">
                    <summary className="text-[11px] text-muted-foreground cursor-pointer hover:text-foreground">
                      Ver payload
                    </summary>
                    <pre className="text-[10px] bg-muted p-2 rounded mt-1 overflow-x-auto max-h-32">
                      {JSON.stringify(log.payload, null, 2)}
                    </pre>
                  </details>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
