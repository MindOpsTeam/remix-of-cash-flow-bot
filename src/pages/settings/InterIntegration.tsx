import { AppLayout } from "@/components/AppLayout";
import {
  ArrowLeft, Save, Plug, RefreshCw, CheckCircle2,
  XCircle, ExternalLink, Eye, EyeOff, Upload, FileCheck,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useCompany } from "@/hooks/useCompany";
import { supabase } from "@/integrations/supabase/client";

interface InterConfig {
  id?: string;
  company_id?: string;
  bank_account_id: string | null;
  client_id: string;
  client_secret: string;
  cert_pem: string;
  key_pem: string;
  account_number: string;
  environment: string;
  active: boolean;
  last_sync_at: string | null;
  last_balance: number | null;
  last_balance_at: string | null;
}

const emptyConfig: InterConfig = {
  bank_account_id: null,
  client_id: "",
  client_secret: "",
  cert_pem: "",
  key_pem: "",
  account_number: "",
  environment: "production",
  active: true,
  last_sync_at: null,
  last_balance: null,
  last_balance_at: null,
};

export default function InterIntegration() {
  const { company } = useCompany();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [form, setForm] = useState<InterConfig>(emptyConfig);
  const [showSecret, setShowSecret] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [testStatus, setTestStatus] = useState<"idle" | "ok" | "error">("idle");
  const [testMsg, setTestMsg] = useState("");
  const certInputRef = useRef<HTMLInputElement>(null);
  const keyInputRef = useRef<HTMLInputElement>(null);

  const readFile = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = () => reject(new Error("Erro ao ler arquivo"));
      reader.readAsText(file);
    });

  const handleCertFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const content = await readFile(file);
      set("cert_pem", content.trim());
      toast({ title: `Certificado carregado: ${file.name}` });
    } catch {
      toast({ title: "Erro ao ler o arquivo .crt", variant: "destructive" });
    }
    e.target.value = "";
  };

  const handleKeyFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const content = await readFile(file);
      set("key_pem", content.trim());
      setShowKey(false);
      toast({ title: `Chave carregada: ${file.name}` });
    } catch {
      toast({ title: "Erro ao ler o arquivo .key", variant: "destructive" });
    }
    e.target.value = "";
  };
  const [syncStartDate, setSyncStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [syncEndDate, setSyncEndDate] = useState(() => new Date().toISOString().slice(0, 10));

  // Load existing config
  const { data: existingConfig, isLoading } = useQuery({
    queryKey: ["inter_config", company?.id],
    enabled: !!company,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("inter_config")
        .select("*")
        .eq("company_id", company!.id)
        .maybeSingle();
      return data;
    },
  });

  // Bank accounts for selector
  const { data: bankAccounts = [] } = useQuery({
    queryKey: ["bank_accounts", company?.id],
    enabled: !!company,
    queryFn: async () => {
      const { data } = await supabase
        .from("bank_accounts")
        .select("id, name, bank_name")
        .eq("company_id", company!.id)
        .order("name");
      return data ?? [];
    },
  });

  useEffect(() => {
    if (existingConfig) {
      setForm({
        id: existingConfig.id,
        company_id: existingConfig.company_id,
        bank_account_id: existingConfig.bank_account_id,
        client_id: existingConfig.client_id,
        client_secret: existingConfig.client_secret,
        cert_pem: existingConfig.cert_pem,
        key_pem: existingConfig.key_pem,
        account_number: existingConfig.account_number ?? "",
        environment: existingConfig.environment,
        active: existingConfig.active,
        last_sync_at: existingConfig.last_sync_at,
        last_balance: existingConfig.last_balance,
        last_balance_at: existingConfig.last_balance_at,
      });
    }
  }, [existingConfig]);

  const set = <K extends keyof InterConfig>(key: K, value: InterConfig[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const handleSave = async () => {
    if (!company) return;
    if (!form.client_id || !form.client_secret || !form.cert_pem || !form.key_pem) {
      toast({ title: "Preencha todos os campos obrigatórios", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      company_id: company.id,
      bank_account_id: form.bank_account_id,
      client_id: form.client_id.trim(),
      client_secret: form.client_secret.trim(),
      cert_pem: form.cert_pem.trim(),
      key_pem: form.key_pem.trim(),
      account_number: form.account_number.trim() || null,
      environment: form.environment,
      active: form.active,
    };

    let error;
    if (existingConfig) {
      ({ error } = await (supabase as any).from("inter_config").update(payload).eq("id", existingConfig.id));
    } else {
      ({ error } = await (supabase as any).from("inter_config").insert(payload));
    }

    setSaving(false);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Configuração salva!" });
      qc.invalidateQueries({ queryKey: ["inter_config", company.id] });
    }
  };

  const callFn = async (action: string, extra?: Record<string, string>) => {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await supabase.functions.invoke("inter-banking", {
      body: { action, company_id: company!.id, ...extra },
    });
    if (res.error) throw new Error(res.error.message);
    if (res.data?.error) throw new Error(res.data.error);
    return res.data;
  };

  const handleTest = async () => {
    if (!existingConfig && !form.client_id) {
      toast({ title: "Salve a configuração antes de testar", variant: "destructive" });
      return;
    }
    setTesting(true);
    setTestStatus("idle");
    try {
      const data = await callFn("test");
      setTestStatus("ok");
      setTestMsg(`Conexão OK! Saldo disponível: R$ ${Number(data.disponivel ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`);
    } catch (e: unknown) {
      setTestStatus("error");
      setTestMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setTesting(false);
    }
  };

  const handleSync = async () => {
    if (!existingConfig) {
      toast({ title: "Salve e teste a configuração antes de sincronizar", variant: "destructive" });
      return;
    }
    setSyncing(true);
    try {
      const data = await callFn("sync", { start_date: syncStartDate, end_date: syncEndDate });
      toast({
        title: "Sincronização concluída",
        description: `${data.synced} transações importadas, ${data.skipped} já existiam.`,
      });
      qc.invalidateQueries({ queryKey: ["inter_config", company?.id] });
    } catch (e: unknown) {
      toast({ title: "Erro na sincronização", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  const fmt = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString("pt-BR") : "—";

  const fmtMoney = (v: number | null) =>
    v != null ? `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—";

  if (isLoading) {
    return <AppLayout><div className="text-sm text-muted-foreground py-8">Carregando...</div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="mb-6 flex items-center gap-3">
        <Link to="/settings/integrations" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-foreground tracking-[-0.02em]">Banco Inter</h1>
            <Badge variant={form.active && existingConfig ? "default" : "secondary"}>
              {existingConfig ? (form.active ? "Ativa" : "Inativa") : "Não configurada"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Sincronize extrato, saldo e pagamentos via API oficial
          </p>
        </div>
        <a
          href="https://developers.inter.co/docs/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Documentação Inter
        </a>
      </div>

      <div className="max-w-2xl space-y-6">

        {/* Status cards */}
        {existingConfig && (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-card border border-border rounded-lg p-4">
              <p className="text-xs text-muted-foreground mb-1">Último saldo</p>
              <p className="text-lg font-semibold text-foreground">{fmtMoney(form.last_balance)}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{fmt(form.last_balance_at)}</p>
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <p className="text-xs text-muted-foreground mb-1">Última sincronização</p>
              <p className="text-sm font-medium text-foreground">{fmt(form.last_sync_at)}</p>
            </div>
          </div>
        )}

        {/* Como obter credenciais */}
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
          <p className="text-xs font-semibold text-foreground mb-2">Como obter as credenciais</p>
          <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
            <li>Acesse o <strong>Internet Banking Inter PJ</strong> → Conta Digital → Aplicações → Nova Aplicação</li>
            <li>Escolha os escopos necessários (ex: <code className="bg-muted px-1 rounded">extrato.read</code>)</li>
            <li>Baixe os arquivos <code className="bg-muted px-1 rounded">certificado.crt</code> e <code className="bg-muted px-1 rounded">certificado.key</code></li>
            <li>Os arquivos já estão em formato PEM — cole-os diretamente nos campos abaixo</li>
          </ol>
          <p className="text-[11px] text-muted-foreground mt-2">
            Se receber um <code className="bg-muted px-1 rounded">.pfx</code>, converta com openssl:
          </p>
          <pre className="mt-1.5 text-[10px] bg-muted rounded p-2 overflow-x-auto text-muted-foreground">
{`# Extrair certificado:
openssl pkcs12 -in cert.pfx -clcerts -nokeys -out certificado.crt
# Extrair chave privada (sem senha):
openssl pkcs12 -in cert.pfx -nocerts -nodes -out certificado.key`}
          </pre>
        </div>

        {/* Credenciais */}
        <section>
          <h2 className="text-sm font-semibold text-foreground mb-3">Credenciais OAuth2</h2>
          <div className="bg-card border border-border rounded-lg divide-y divide-border">

            <div className="p-4 space-y-1.5">
              <Label>Client ID *</Label>
              <Input
                value={form.client_id}
                onChange={(e) => set("client_id", e.target.value)}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                className="font-mono text-sm"
              />
            </div>

            <div className="p-4 space-y-1.5">
              <Label>Client Secret *</Label>
              <div className="relative">
                <Input
                  type={showSecret ? "text" : "password"}
                  value={form.client_secret}
                  onChange={(e) => set("client_secret", e.target.value)}
                  placeholder="Seu client secret"
                  className="font-mono text-sm pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowSecret(!showSecret)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="p-4 space-y-1.5">
              <Label>Número da conta (opcional)</Label>
              <Input
                value={form.account_number}
                onChange={(e) => set("account_number", e.target.value)}
                placeholder="Apenas para conta com múltiplos acessos"
                className="font-mono text-sm"
              />
            </div>

            <div className="flex items-center justify-between p-4">
              <div>
                <Label>Ambiente</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Use sandbox para testes</p>
              </div>
              <Select value={form.environment} onValueChange={(v) => set("environment", v)}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="production">Produção</SelectItem>
                  <SelectItem value="sandbox">Sandbox</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between p-4">
              <div>
                <Label>Integração ativa</Label>
              </div>
              <Switch checked={form.active} onCheckedChange={(v) => set("active", v)} />
            </div>

          </div>
        </section>

        {/* Certificados */}
        <section>
          <h2 className="text-sm font-semibold text-foreground mb-1">Certificado mTLS</h2>
          <p className="text-xs text-muted-foreground mb-3">
            Faça upload dos arquivos baixados no portal Inter ou cole o conteúdo manualmente.
          </p>
          <div className="bg-card border border-border rounded-lg divide-y divide-border">

            {/* cert.crt / cert.pem */}
            <div className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <Label>Certificado <span className="text-muted-foreground font-normal">(certificado.crt)</span> *</Label>
                {form.cert_pem && (
                  <span className="flex items-center gap-1 text-[11px] text-income">
                    <FileCheck className="h-3.5 w-3.5" /> Carregado
                  </span>
                )}
              </div>

              {/* hidden file input */}
              <input
                ref={certInputRef}
                type="file"
                accept=".crt,.pem,.cer"
                className="hidden"
                onChange={handleCertFile}
              />

              <div
                onClick={() => certInputRef.current?.click()}
                className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-lg p-5 cursor-pointer transition-colors ${
                  form.cert_pem
                    ? "border-income/40 bg-income/5"
                    : "border-border hover:border-primary/40 hover:bg-accent/40"
                }`}
              >
                {form.cert_pem ? (
                  <>
                    <FileCheck className="h-6 w-6 text-income" />
                    <p className="text-xs text-muted-foreground">Clique para substituir</p>
                  </>
                ) : (
                  <>
                    <Upload className="h-6 w-6 text-muted-foreground" />
                    <p className="text-xs text-foreground font-medium">Clique para selecionar</p>
                    <p className="text-[11px] text-muted-foreground">.crt · .pem · .cer</p>
                  </>
                )}
              </div>

              {/* Fallback: paste manual */}
              <details className="group">
                <summary className="text-[11px] text-muted-foreground cursor-pointer hover:text-foreground list-none flex items-center gap-1">
                  <span className="group-open:hidden">▶ Ou colar conteúdo manualmente</span>
                  <span className="hidden group-open:inline">▼ Fechar</span>
                </summary>
                <Textarea
                  value={form.cert_pem}
                  onChange={(e) => set("cert_pem", e.target.value)}
                  placeholder={"-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----"}
                  className="font-mono text-xs min-h-28 resize-y mt-2"
                />
              </details>
            </div>

            {/* certificado.key */}
            <div className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <Label>Chave Privada <span className="text-muted-foreground font-normal">(certificado.key)</span> *</Label>
                {form.key_pem && (
                  <span className="flex items-center gap-1 text-[11px] text-income">
                    <FileCheck className="h-3.5 w-3.5" /> Carregada
                  </span>
                )}
              </div>

              {/* hidden file input */}
              <input
                ref={keyInputRef}
                type="file"
                accept=".key,.pem"
                className="hidden"
                onChange={handleKeyFile}
              />

              <div
                onClick={() => keyInputRef.current?.click()}
                className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-lg p-5 cursor-pointer transition-colors ${
                  form.key_pem
                    ? "border-income/40 bg-income/5"
                    : "border-border hover:border-primary/40 hover:bg-accent/40"
                }`}
              >
                {form.key_pem ? (
                  <>
                    <FileCheck className="h-6 w-6 text-income" />
                    <p className="text-xs text-muted-foreground">Clique para substituir</p>
                  </>
                ) : (
                  <>
                    <Upload className="h-6 w-6 text-muted-foreground" />
                    <p className="text-xs text-foreground font-medium">Clique para selecionar</p>
                    <p className="text-[11px] text-muted-foreground">.key · .pem</p>
                  </>
                )}
              </div>

              {/* Fallback: paste manual (oculto por padrão) */}
              <details className="group">
                <summary className="text-[11px] text-muted-foreground cursor-pointer hover:text-foreground list-none flex items-center gap-1">
                  <span className="group-open:hidden">▶ Ou colar conteúdo manualmente</span>
                  <span className="hidden group-open:inline">▼ Fechar</span>
                </summary>
                <div className="mt-2">
                  <div className="flex justify-end mb-1">
                    <button
                      type="button"
                      onClick={() => setShowKey(!showKey)}
                      className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1"
                    >
                      {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      {showKey ? "Ocultar" : "Mostrar"}
                    </button>
                  </div>
                  <Textarea
                    value={showKey ? form.key_pem : (form.key_pem ? "•".repeat(40) : "")}
                    onChange={(e) => showKey && set("key_pem", e.target.value)}
                    onFocus={() => setShowKey(true)}
                    placeholder={"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"}
                    className="font-mono text-xs min-h-28 resize-y"
                    readOnly={!showKey && !!form.key_pem}
                  />
                </div>
              </details>
            </div>

          </div>
        </section>

        {/* Conta vinculada */}
        <section>
          <h2 className="text-sm font-semibold text-foreground mb-3">Conta vinculada</h2>
          <div className="bg-card border border-border rounded-lg p-4">
            <Label className="mb-2 block">Conta bancária (para sincronização)</Label>
            <Select
              value={form.bank_account_id ?? "__none__"}
              onValueChange={(v) => set("bank_account_id", v === "__none__" ? null : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a conta Inter no sistema" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Sem conta vinculada</SelectItem>
                {bankAccounts.map((ba) => (
                  <SelectItem key={ba.id} value={ba.id}>
                    {ba.name}{ba.bank_name ? ` — ${ba.bank_name}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-2">
              Transações sincronizadas serão associadas a esta conta nos lançamentos.{" "}
              <Link to="/settings/bank-accounts" className="text-primary hover:underline">
                Gerenciar contas
              </Link>
            </p>
          </div>
        </section>

        {/* Test status */}
        {testStatus !== "idle" && (
          <div className={`flex items-start gap-2 p-3 rounded-lg text-sm ${
            testStatus === "ok"
              ? "bg-income/10 text-income border border-income/20"
              : "bg-expense/10 text-expense border border-expense/20"
          }`}>
            {testStatus === "ok"
              ? <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
              : <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
            }
            {testMsg}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-wrap gap-3">
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            <Save className="h-4 w-4" />
            {saving ? "Salvando..." : "Salvar configuração"}
          </Button>
          <Button variant="outline" onClick={handleTest} disabled={testing} className="gap-2">
            <Plug className="h-4 w-4" />
            {testing ? "Testando..." : "Testar conexão"}
          </Button>
        </div>

        {/* Sync */}
        {existingConfig && (
          <section>
            <h2 className="text-sm font-semibold text-foreground mb-1">Sincronizar extrato</h2>
            <p className="text-xs text-muted-foreground mb-3">
              Importa transações do período selecionado para Lançamentos (máx. 90 dias).
              Transações já importadas são ignoradas.
            </p>
            <div className="bg-card border border-border rounded-lg p-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Data inicial</Label>
                  <Input
                    type="date"
                    value={syncStartDate}
                    onChange={(e) => setSyncStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Data final</Label>
                  <Input
                    type="date"
                    value={syncEndDate}
                    onChange={(e) => setSyncEndDate(e.target.value)}
                  />
                </div>
              </div>
              <Button variant="outline" onClick={handleSync} disabled={syncing} className="gap-2">
                <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
                {syncing ? "Sincronizando..." : "Sincronizar agora"}
              </Button>
            </div>
          </section>
        )}

      </div>
    </AppLayout>
  );
}
