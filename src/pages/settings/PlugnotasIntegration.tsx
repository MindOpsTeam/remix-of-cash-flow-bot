import { AppLayout } from "@/components/AppLayout";
import {
  ArrowLeft, Save, Plug, CheckCircle2, XCircle, Eye, EyeOff,
  ExternalLink, FileText, Upload, ShieldCheck, FileCheck, Loader2, Building2,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useCompany } from "@/hooks/useCompany";
import { supabase } from "@/integrations/supabase/client";

interface PlugnotasConfig {
  id?: string;
  company_id?: string;
  api_key: string;
  environment: "sandbox" | "producao";
  plugnotas_empresa_cnpj: string | null;
  plugnotas_empresa_id: string | null;
  enabled_nfe: boolean;
  enabled_nfse: boolean;
  enabled_nfce: boolean;
  enabled_cte: boolean;
  enabled_mdfe: boolean;
  serie_padrao: string | null;
  active: boolean;
  last_test_at: string | null;
  last_test_status: string | null;
  last_emission_at: string | null;
}

const SANDBOX_KEY = "2da392a6-79d2-4304-a8b7-959572c7e44d";

const emptyConfig: PlugnotasConfig = {
  api_key: "",
  environment: "producao",
  plugnotas_empresa_cnpj: null,
  plugnotas_empresa_id: null,
  enabled_nfe: false,
  enabled_nfse: true,
  enabled_nfce: false,
  enabled_cte: false,
  enabled_mdfe: false,
  serie_padrao: "1",
  active: true,
  last_test_at: null,
  last_test_status: null,
  last_emission_at: null,
};

export default function PlugnotasIntegration() {
  const { company } = useCompany();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [form, setForm] = useState<PlugnotasConfig>(emptyConfig);
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testStatus, setTestStatus] = useState<"idle" | "ok" | "error">("idle");
  const [testMsg, setTestMsg] = useState("");

  // Empresa dialog
  const [empDialogOpen, setEmpDialogOpen] = useState(false);
  const [empBusy, setEmpBusy] = useState(false);
  const [empForm, setEmpForm] = useState({ cnpj: "", razaoSocial: "", nomeFantasia: "", email: "" });

  // Certificado dialog
  const [certDialogOpen, setCertDialogOpen] = useState(false);
  const [certBusy, setCertBusy] = useState(false);
  const [certFile, setCertFile] = useState<File | null>(null);
  const [certPassword, setCertPassword] = useState("");
  const pfxInputRef = useRef<HTMLInputElement>(null);

  const { data: existingConfig, isLoading } = useQuery({
    queryKey: ["plugnotas_config", company?.id],
    enabled: !!company,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("plugnotas_config")
        .select("*")
        .eq("company_id", company!.id)
        .maybeSingle();
      return data as PlugnotasConfig | null;
    },
  });

  useEffect(() => {
    if (existingConfig) setForm(existingConfig);
  }, [existingConfig]);

  const set = <K extends keyof PlugnotasConfig>(key: K, value: PlugnotasConfig[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const fmt = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString("pt-BR") : "—";

  const handleSave = async () => {
    if (!company) return;
    if (!form.api_key) {
      toast({ title: "Informe a API Key do PlugNotas", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      company_id: company.id,
      api_key: form.api_key,
      environment: form.environment,
      plugnotas_empresa_cnpj: form.plugnotas_empresa_cnpj,
      enabled_nfe: form.enabled_nfe,
      enabled_nfse: form.enabled_nfse,
      enabled_nfce: form.enabled_nfce,
      enabled_cte: form.enabled_cte,
      enabled_mdfe: form.enabled_mdfe,
      serie_padrao: form.serie_padrao,
      active: form.active,
      updated_at: new Date().toISOString(),
    };

    let error;
    if (existingConfig?.id) {
      ({ error } = await (supabase as any)
        .from("plugnotas_config")
        .update(payload)
        .eq("id", existingConfig.id));
    } else {
      ({ error } = await (supabase as any).from("plugnotas_config").insert(payload));
    }

    setSaving(false);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Configuração salva" });
      qc.invalidateQueries({ queryKey: ["plugnotas_config", company.id] });
    }
  };

  const handleTest = async () => {
    if (!company) return;
    if (!existingConfig?.id) {
      toast({ title: "Salve a configuração antes de testar", variant: "destructive" });
      return;
    }
    setTesting(true);
    setTestStatus("idle");
    try {
      const { data, error } = await supabase.functions.invoke("plugnotas-status", {
        body: { company_id: company.id, operation: "ping" },
      });
      if (error) throw new Error(error.message);

      if (data?.ok) {
        setTestStatus("ok");
        setTestMsg(`Conexão OK — ambiente: ${data.environment}`);
      } else {
        setTestStatus("error");
        const apiMsg = (data?.data as any)?.error?.message ?? (data?.data as any)?.message ?? "Erro desconhecido";
        setTestMsg(`HTTP ${data?.status ?? "?"} — ${apiMsg}`);
      }
      qc.invalidateQueries({ queryKey: ["plugnotas_config", company.id] });
    } catch (e: unknown) {
      setTestStatus("error");
      setTestMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setTesting(false);
    }
  };

  const handleCreateEmpresa = async () => {
    if (!company) return;
    if (!empForm.cnpj || !empForm.razaoSocial) {
      toast({ title: "CNPJ e Razão Social são obrigatórios", variant: "destructive" });
      return;
    }
    setEmpBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("plugnotas-empresa", {
        body: {
          company_id: company.id,
          operation: "criar",
          params: {
            cpfCnpj: empForm.cnpj.replace(/\D/g, ""),
            razaoSocial: empForm.razaoSocial,
            nomeFantasia: empForm.nomeFantasia || undefined,
            email: empForm.email || undefined,
          },
        },
      });
      if (error) throw new Error(error.message);
      if (!data?.ok) {
        const apiMsg = (data?.data as any)?.error?.message ?? "Erro ao cadastrar empresa";
        throw new Error(apiMsg);
      }
      toast({ title: "Empresa cadastrada no PlugNotas" });
      setEmpDialogOpen(false);
      qc.invalidateQueries({ queryKey: ["plugnotas_config", company.id] });
    } catch (e: unknown) {
      toast({
        title: "Falha ao cadastrar",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setEmpBusy(false);
    }
  };

  const handleUploadCert = async () => {
    if (!company || !certFile || !certPassword) {
      toast({ title: "Selecione o arquivo .pfx e informe a senha", variant: "destructive" });
      return;
    }
    setCertBusy(true);
    try {
      const buffer = await certFile.arrayBuffer();
      const pfx_base64 = btoa(
        new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), ""),
      );
      const { data, error } = await supabase.functions.invoke("plugnotas-empresa", {
        body: {
          company_id: company.id,
          operation: "enviar_certificado",
          params: { pfx_base64, password: certPassword },
        },
      });
      if (error) throw new Error(error.message);
      if (!data?.ok) {
        const apiMsg = (data?.data as any)?.error?.message ?? "Erro ao enviar certificado";
        throw new Error(apiMsg);
      }
      toast({ title: "Certificado enviado ao PlugNotas" });
      setCertDialogOpen(false);
      setCertFile(null);
      setCertPassword("");
    } catch (e: unknown) {
      toast({
        title: "Falha no upload",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setCertBusy(false);
    }
  };

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
            <h1 className="text-2xl font-bold text-foreground tracking-[-0.02em]">PlugNotas</h1>
            <Badge variant={form.active && existingConfig ? "default" : "secondary"}>
              {existingConfig ? (form.active ? "Ativa" : "Inativa") : "Não configurada"}
            </Badge>
            <Badge variant="outline" className="capitalize">{form.environment}</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Emissão de NF-e, NFS-e, NFC-e, CT-e e MDF-e via PlugNotas. Certificado A1 hospedado pelo provedor.
          </p>
        </div>
        <a
          href="https://plugnotas.com.br/docs/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Docs PlugNotas
        </a>
      </div>

      <div className="max-w-2xl space-y-6">

        {/* Status */}
        {existingConfig && (
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-card border border-border rounded-lg p-4">
              <p className="text-xs text-muted-foreground mb-1">CNPJ vinculado</p>
              <p className="text-sm font-medium text-foreground">
                {form.plugnotas_empresa_cnpj
                  ? form.plugnotas_empresa_cnpj.replace(
                      /(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,
                      "$1.$2.$3/$4-$5",
                    )
                  : "—"}
              </p>
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <p className="text-xs text-muted-foreground mb-1">Último teste</p>
              <p className="text-sm font-medium text-foreground">{fmt(form.last_test_at)}</p>
              {form.last_test_status && (
                <p className={`text-[11px] mt-0.5 ${
                  form.last_test_status === "ok" ? "text-income" : "text-expense"
                }`}>
                  {form.last_test_status}
                </p>
              )}
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <p className="text-xs text-muted-foreground mb-1">Última emissão</p>
              <p className="text-sm font-medium text-foreground">{fmt(form.last_emission_at)}</p>
            </div>
          </div>
        )}

        {/* Setup steps */}
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
          <p className="text-xs font-semibold text-foreground mb-2">Passos para começar a emitir</p>
          <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
            <li>Cadastre-se em <a className="text-primary underline" target="_blank" rel="noopener noreferrer" href="https://plugnotas.com.br">plugnotas.com.br</a> e obtenha sua chave de produção</li>
            <li>Cole a chave abaixo, mantenha o ambiente em <strong>Produção</strong></li>
            <li>Cadastre a empresa emissora (CNPJ, razão social, endereço fiscal)</li>
            <li>Envie o certificado digital A1 (.pfx) — fica hospedado no PlugNotas</li>
            <li>Habilite os tipos de documento que você emite</li>
            <li>Clique em <strong>Testar conexão</strong> e comece a emitir em <Link to="/fiscal/plugnotas/emit" className="text-primary hover:underline">Fiscal → Emitir</Link></li>
          </ol>
          <p className="text-[11px] text-muted-foreground mt-3 pt-3 border-t border-primary/10">
            Para integrações iniciais ou QA, use ambiente <strong>Sandbox</strong> — só serve para validar o fluxo, não emite documento real.
          </p>
        </div>

        {/* Credenciais */}
        <section>
          <h2 className="text-sm font-semibold text-foreground mb-3">Credenciais</h2>
          <div className="bg-card border border-border rounded-lg divide-y divide-border">
            <div className="flex items-center justify-between p-4">
              <div>
                <Label>Ambiente</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Sandbox para testes, Produção para emissão real
                </p>
              </div>
              <Select value={form.environment} onValueChange={(v) => set("environment", v as "sandbox" | "producao")}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sandbox">Sandbox</SelectItem>
                  <SelectItem value="producao">Produção</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="p-4 space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>API Key *</Label>
                {form.environment === "sandbox" && form.api_key !== SANDBOX_KEY && (
                  <button
                    type="button"
                    className="text-[11px] text-muted-foreground hover:text-primary hover:underline"
                    onClick={() => set("api_key", SANDBOX_KEY)}
                  >
                    Preencher com chave de teste (sandbox)
                  </button>
                )}
              </div>
              <div className="relative">
                <Input
                  type={showKey ? "text" : "password"}
                  value={form.api_key}
                  onChange={(e) => set("api_key", e.target.value)}
                  placeholder={form.environment === "producao"
                    ? "Cole sua chave de produção do PlugNotas"
                    : "Cole a chave do ambiente sandbox"}
                  className="font-mono text-sm pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                A chave fica armazenada com isolamento por empresa (RLS). Nunca exibimos em logs ou histórico.
              </p>
            </div>
          </div>
        </section>

        {/* Empresa fiscal */}
        <section>
          <h2 className="text-sm font-semibold text-foreground mb-1">Empresa fiscal no PlugNotas</h2>
          <p className="text-xs text-muted-foreground mb-3">
            O PlugNotas hospeda o certificado e gerencia a numeração das notas — diferente do NFS-e Nacional onde o cert fica no nosso banco.
          </p>
          <div className="bg-card border border-border rounded-lg divide-y divide-border">
            <div className="p-4 space-y-1.5">
              <Label>CNPJ vinculado</Label>
              <Input
                value={form.plugnotas_empresa_cnpj ?? ""}
                onChange={(e) => set("plugnotas_empresa_cnpj", e.target.value || null)}
                placeholder="00.000.000/0000-00"
                className="font-mono text-sm max-w-64"
              />
              <p className="text-[11px] text-muted-foreground">
                CNPJ usado nas chamadas. Deixe vazio até cadastrar a empresa.
              </p>
            </div>

            <div className="p-4 flex flex-wrap gap-3">
              <Dialog open={empDialogOpen} onOpenChange={setEmpDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2" disabled={!existingConfig}>
                    <Building2 className="h-4 w-4" />
                    Cadastrar empresa no PlugNotas
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Cadastrar empresa</DialogTitle>
                    <DialogDescription>
                      Cria a empresa fiscal no PlugNotas (POST /empresa).
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label>CNPJ *</Label>
                      <Input
                        placeholder="00000000000000"
                        value={empForm.cnpj}
                        onChange={(e) => setEmpForm((f) => ({ ...f, cnpj: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Razão social *</Label>
                      <Input
                        value={empForm.razaoSocial}
                        onChange={(e) => setEmpForm((f) => ({ ...f, razaoSocial: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Nome fantasia</Label>
                      <Input
                        value={empForm.nomeFantasia}
                        onChange={(e) => setEmpForm((f) => ({ ...f, nomeFantasia: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Email</Label>
                      <Input
                        type="email"
                        value={empForm.email}
                        onChange={(e) => setEmpForm((f) => ({ ...f, email: e.target.value }))}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setEmpDialogOpen(false)}>Cancelar</Button>
                    <Button onClick={handleCreateEmpresa} disabled={empBusy} className="gap-2">
                      {empBusy && <Loader2 className="h-4 w-4 animate-spin" />}
                      Cadastrar
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Dialog open={certDialogOpen} onOpenChange={setCertDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2" disabled={!existingConfig}>
                    <ShieldCheck className="h-4 w-4" />
                    Enviar certificado A1
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Enviar certificado A1</DialogTitle>
                    <DialogDescription>
                      O certificado fica armazenado no PlugNotas e nunca mais sai do servidor deles.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3">
                    <input
                      ref={pfxInputRef}
                      type="file"
                      accept=".pfx,.p12"
                      className="hidden"
                      onChange={(e) => setCertFile(e.target.files?.[0] ?? null)}
                    />
                    <div
                      onClick={() => pfxInputRef.current?.click()}
                      className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-lg p-5 cursor-pointer transition-colors ${
                        certFile
                          ? "border-income/40 bg-income/5"
                          : "border-border hover:border-primary/40 hover:bg-accent/40"
                      }`}
                    >
                      {certFile ? (
                        <>
                          <FileCheck className="h-6 w-6 text-income" />
                          <p className="text-xs font-medium">{certFile.name}</p>
                          <p className="text-[11px] text-muted-foreground">Clique para substituir</p>
                        </>
                      ) : (
                        <>
                          <Upload className="h-6 w-6 text-muted-foreground" />
                          <p className="text-xs font-medium">Selecionar .pfx</p>
                        </>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label>Senha do certificado</Label>
                      <Input
                        type="password"
                        value={certPassword}
                        onChange={(e) => setCertPassword(e.target.value)}
                        className="font-mono text-sm"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setCertDialogOpen(false)}>Cancelar</Button>
                    <Button onClick={handleUploadCert} disabled={certBusy || !certFile || !certPassword} className="gap-2">
                      {certBusy && <Loader2 className="h-4 w-4 animate-spin" />}
                      Enviar
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </section>

        {/* Tipos de documento */}
        <section>
          <h2 className="text-sm font-semibold text-foreground mb-1">Tipos de documento</h2>
          <p className="text-xs text-muted-foreground mb-3">
            Ative apenas os tipos que você realmente emite. Cada um chama uma edge function diferente.
          </p>
          <div className="bg-card border border-border rounded-lg divide-y divide-border">
            {([
              { key: "enabled_nfse", label: "NFSe", desc: "Nota Fiscal de Serviço Eletrônica", fn: "plugnotas-nfse" },
              { key: "enabled_nfe",  label: "NFe",  desc: "Nota Fiscal Eletrônica (modelo 55)", fn: "plugnotas-nfe" },
              { key: "enabled_nfce", label: "NFCe", desc: "Nota Fiscal de Consumidor (modelo 65)", fn: "plugnotas-nfce" },
              { key: "enabled_cte",  label: "CTe",  desc: "Conhecimento de Transporte (sandbox indisponível)", fn: "plugnotas-cte" },
              { key: "enabled_mdfe", label: "MDFe", desc: "Manifesto Eletrônico de Documentos Fiscais", fn: "plugnotas-mdfe" },
            ] as const).map((row) => (
              <div key={row.key} className="flex items-center justify-between p-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Label>{row.label}</Label>
                    <code className="text-[10px] bg-muted px-1 py-0.5 rounded text-muted-foreground">{row.fn}</code>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{row.desc}</p>
                </div>
                <Switch
                  checked={Boolean(form[row.key])}
                  onCheckedChange={(v) => set(row.key, v as never)}
                />
              </div>
            ))}
          </div>
        </section>

        {/* Configurações */}
        <section>
          <h2 className="text-sm font-semibold text-foreground mb-3">Configurações</h2>
          <div className="bg-card border border-border rounded-lg divide-y divide-border">
            <div className="p-4 space-y-1.5">
              <Label>Série padrão</Label>
              <Input
                value={form.serie_padrao ?? ""}
                onChange={(e) => set("serie_padrao", e.target.value)}
                placeholder="1"
                className="font-mono text-sm max-w-32"
              />
            </div>
            <div className="flex items-center justify-between p-4">
              <Label>Integração ativa</Label>
              <Switch checked={form.active} onCheckedChange={(v) => set("active", v)} />
            </div>
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
            <span className="text-xs">{testMsg}</span>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-wrap gap-3">
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            <Save className="h-4 w-4" />
            {saving ? "Salvando..." : "Salvar configuração"}
          </Button>
          <Button variant="outline" onClick={handleTest} disabled={testing || !existingConfig} className="gap-2">
            <Plug className="h-4 w-4" />
            {testing ? "Testando..." : "Testar conexão"}
          </Button>
          {existingConfig && (
            <Link to="/fiscal/plugnotas/emit">
              <Button variant="outline" className="gap-2">
                <FileText className="h-4 w-4" />
                Ir para emissão
              </Button>
            </Link>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
