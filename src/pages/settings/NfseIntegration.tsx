import { AppLayout } from "@/components/AppLayout";
import {
  ArrowLeft, Save, Plug, CheckCircle2, XCircle, Upload,
  FileCheck, Eye, EyeOff, ExternalLink, FileText, ShieldCheck,
  ServerCog, Cloud, Rocket,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useCompany } from "@/hooks/useCompany";
import { supabase } from "@/integrations/supabase/client";
import NfseSetupWizard from "./NfseSetupWizard";

interface NfseConfig {
  id?: string;
  company_id?: string;
  cert_pfx_base64: string;
  cert_password: string;
  cert_cnpj: string | null;
  cert_razao_social: string | null;
  cert_expires_at: string | null;
  ambiente: string;
  serie_dps: string;
  proximo_numero_dps: number;
  codigo_municipio: string;
  inscricao_municipal: string;
  active: boolean;
  nfse_via: "worker_proprio" | "provedor";
  worker_url: string;
  worker_api_key: string;
  last_test_at: string | null;
  last_test_status: string | null;
  last_emission_at: string | null;
}

// Repo público do worker + botão de deploy 1-clique (ver README do repo).
const WORKER_REPO_URL = "https://github.com/MindOpsTeam/nfse-worker";

const emptyConfig: NfseConfig = {
  cert_pfx_base64: "",
  cert_password: "",
  cert_cnpj: null,
  cert_razao_social: null,
  cert_expires_at: null,
  ambiente: "homologacao",
  serie_dps: "1",
  proximo_numero_dps: 1,
  codigo_municipio: "",
  inscricao_municipal: "",
  active: true,
  nfse_via: "worker_proprio",
  worker_url: "",
  worker_api_key: "",
  last_test_at: null,
  last_test_status: null,
  last_emission_at: null,
};

export default function NfseIntegration() {
  const { company } = useCompany();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [form, setForm] = useState<NfseConfig>(emptyConfig);
  const [showPassword, setShowPassword] = useState(false);
  // Assistente guiado por padrão enquanto a instalação não foi concluída.
  const [showWizard, setShowWizard] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testStatus, setTestStatus] = useState<"idle" | "ok" | "error">("idle");
  const [testMsg, setTestMsg] = useState("");
  const [workerTesting, setWorkerTesting] = useState(false);
  const [workerTest, setWorkerTest] = useState<{ status: "idle" | "ok" | "error"; msg: string }>({ status: "idle", msg: "" });
  const [pfxFileName, setPfxFileName] = useState<string | null>(null);
  const pfxInputRef = useRef<HTMLInputElement>(null);

  const { data: existingConfig, isLoading } = useQuery({
    queryKey: ["nfse_config", company?.id],
    enabled: !!company,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("nfse_config")
        .select("*")
        .eq("company_id", company!.id)
        .maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (existingConfig) {
      // Segredos (cert .pfx/senha/worker_api_key) NÃO são mais legíveis pelo cliente
      // (REVOKE de SELECT). Deixamos esses campos vazios no form; se o usuário não
      // subir um novo, o save preserva o que já está no servidor. O status "tem
      // certificado" vem de cert_cnpj (não-secreto).
      setForm({
        id: existingConfig.id,
        company_id: existingConfig.company_id,
        cert_cnpj: existingConfig.cert_cnpj,
        cert_razao_social: existingConfig.cert_razao_social,
        cert_expires_at: existingConfig.cert_expires_at,
        ambiente: existingConfig.ambiente,
        serie_dps: existingConfig.serie_dps,
        proximo_numero_dps: existingConfig.proximo_numero_dps,
        codigo_municipio: existingConfig.codigo_municipio ?? "",
        inscricao_municipal: existingConfig.inscricao_municipal ?? "",
        active: existingConfig.active,
        nfse_via: (existingConfig.nfse_via as "worker_proprio" | "provedor") ?? "worker_proprio",
        worker_url: existingConfig.worker_url ?? "",
        worker_api_key: "",
        last_test_at: existingConfig.last_test_at,
        last_test_status: existingConfig.last_test_status,
        last_emission_at: existingConfig.last_emission_at,
      });
      if (existingConfig.cert_cnpj) setPfxFileName("certificado.pfx");
    }
  }, [existingConfig]);

  const set = <K extends keyof NfseConfig>(key: K, value: NfseConfig[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const handlePfxFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), ""),
      );
      set("cert_pfx_base64", base64);
      setPfxFileName(file.name);
      toast({ title: `Certificado carregado: ${file.name}` });
    } catch {
      toast({ title: "Erro ao ler o arquivo .pfx", variant: "destructive" });
    }
    e.target.value = "";
  };

  const handleSave = async () => {
    if (!company) return;
    // Exige certificado só quando ainda NÃO há um configurado (cert_cnpj) e o usuário
    // também não subiu um novo agora. Assim dá para salvar série/município/worker sem
    // reenviar o .pfx (que o cliente nem consegue mais ler).
    const jaTemCert = !!existingConfig?.cert_cnpj;
    const novoCert = !!(form.cert_pfx_base64 && form.cert_password);
    if (!jaTemCert && !novoCert) {
      toast({ title: "Certificado .pfx e senha são obrigatórios", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload: Record<string, unknown> = {
      company_id: company.id,
      ambiente: form.ambiente,
      serie_dps: form.serie_dps,
      proximo_numero_dps: form.proximo_numero_dps,
      codigo_municipio: form.codigo_municipio || null,
      inscricao_municipal: form.inscricao_municipal || null,
      active: form.active,
      nfse_via: form.nfse_via,
      worker_url: form.worker_url.trim() || null,
    };
    // Só reescreve os segredos quando o usuário informa um valor novo (senão preserva).
    if (form.cert_pfx_base64) payload.cert_pfx_base64 = form.cert_pfx_base64;
    if (form.cert_password) payload.cert_password = form.cert_password;
    if (form.worker_api_key.trim()) payload.worker_api_key = form.worker_api_key.trim();

    let error;
    if (existingConfig) {
      ({ error } = await (supabase as any).from("nfse_config").update(payload).eq("id", existingConfig.id));
    } else {
      ({ error } = await (supabase as any).from("nfse_config").insert(payload));
    }

    setSaving(false);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Configuração salva!" });
      qc.invalidateQueries({ queryKey: ["nfse_config", company.id] });
    }
  };

  const handleTest = async () => {
    if (!company) return;
    if (!form.cert_pfx_base64 || !form.cert_password) {
      toast({ title: "Salve o certificado e a senha antes de testar", variant: "destructive" });
      return;
    }
    if (!existingConfig) {
      toast({ title: "Salve a configuração antes de testar", variant: "destructive" });
      return;
    }
    setTesting(true);
    setTestStatus("idle");
    try {
      const { data, error } = await supabase.functions.invoke("nfse-operations", {
        body: { company_id: company.id, operation: "parse_cert" },
      });

      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error ?? "Erro desconhecido");

      const cert = data.data as {
        cnpj: string | null;
        razaoSocial: string | null;
        expiresAt: string | null;
        validDays: number | null;
      };

      const expLabel = cert.expiresAt
        ? new Date(cert.expiresAt).toLocaleDateString("pt-BR")
        : null;
      const expiryNote = cert.validDays != null
        ? cert.validDays <= 0
          ? " — EXPIRADO"
          : cert.validDays <= 30
            ? ` — expira em ${cert.validDays} dia(s)`
            : ` — válido por ${cert.validDays} dias`
        : "";

      setTestStatus("ok");
      setTestMsg(
        [
          cert.razaoSocial && `Certificado: ${cert.razaoSocial}`,
          cert.cnpj && `CNPJ: ${cert.cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5")}`,
          expLabel && `Validade: ${expLabel}${expiryNote}`,
        ]
          .filter(Boolean)
          .join(" · ") || "Certificado lido com sucesso.",
      );

      // Refresh data to show updated status cards
      qc.invalidateQueries({ queryKey: ["nfse_config", company.id] });
    } catch (e: unknown) {
      setTestStatus("error");
      setTestMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setTesting(false);
    }
  };

  const testWorker = async () => {
    const url = form.worker_url.trim().replace(/\/+$/, "");
    if (!url) {
      setWorkerTest({ status: "error", msg: "Informe a URL do seu worker." });
      return;
    }
    setWorkerTesting(true);
    setWorkerTest({ status: "idle", msg: "" });
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 12000);
      // /health é público e libera CORS — testa só se o servidor está de pé.
      const res = await fetch(`${url}/health`, { signal: ctrl.signal });
      clearTimeout(t);
      const body = await res.json().catch(() => ({}));
      if (res.ok && body?.status === "ok") {
        setWorkerTest({ status: "ok", msg: `Servidor no ar (v${body.version ?? "?"}). Agora salve e use "Testar conexao" para validar o certificado.` });
      } else {
        setWorkerTest({ status: "error", msg: `Respondeu HTTP ${res.status}. Confirme a URL (deve terminar em .up.railway.app, sem barra final).` });
      }
    } catch (e: unknown) {
      const msg = e instanceof Error && e.name === "AbortError"
        ? "Sem resposta em 12s. O worker pode estar dormindo/fora do ar ou a URL esta errada."
        : "Nao foi possivel alcancar o worker. Confira a URL e se o deploy esta ativo.";
      setWorkerTest({ status: "error", msg });
    } finally {
      setWorkerTesting(false);
    }
  };

  const daysUntilExpiry = form.cert_expires_at
    ? Math.floor((new Date(form.cert_expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  const fmt = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString("pt-BR") : "\u2014";

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
            <h1 className="text-2xl font-bold text-foreground tracking-[-0.02em]">NFS-e Nacional</h1>
            <Badge variant={form.active && existingConfig ? "default" : "secondary"}>
              {existingConfig ? (form.active ? "Ativa" : "Inativa") : "Nao configurada"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Emissao de NFS-e via API ADN da Receita Federal (padrao nacional)
          </p>
        </div>
        <a
          href="https://www.gov.br/nfse/pt-br"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Portal NFS-e
        </a>
      </div>

      {showWizard ? (
        <div className="max-w-2xl">
          <button type="button" onClick={() => setShowWizard(false)} className="text-xs text-muted-foreground hover:text-primary mb-3 underline underline-offset-2">Prefiro a configuracao avancada</button>
          <NfseSetupWizard onFinish={() => setShowWizard(false)} />
        </div>
      ) : (
      <div className="max-w-2xl space-y-6">

        <button type="button" onClick={() => setShowWizard(true)} className="text-xs text-muted-foreground hover:text-primary underline underline-offset-2">Voltar ao assistente guiado</button>

        {/* Status cards */}
        {existingConfig && (
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-card border border-border rounded-lg p-4">
              <p className="text-xs text-muted-foreground mb-1">Certificado</p>
              {form.cert_razao_social ? (
                <>
                  <p className="text-sm font-semibold text-foreground truncate">{form.cert_razao_social}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    CNPJ: {form.cert_cnpj ? form.cert_cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5") : "\u2014"}
                  </p>
                </>
              ) : (
                <p className="text-sm font-medium text-foreground">{pfxFileName || "\u2014"}</p>
              )}
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <p className="text-xs text-muted-foreground mb-1">Validade</p>
              {daysUntilExpiry != null ? (
                <>
                  <p className={`text-lg font-semibold ${
                    daysUntilExpiry <= 0 ? "text-expense" :
                    daysUntilExpiry <= 30 ? "text-warning" : "text-foreground"
                  }`}>
                    {daysUntilExpiry <= 0 ? "Expirado" : `${daysUntilExpiry} dias`}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Expira: {new Date(form.cert_expires_at!).toLocaleDateString("pt-BR")}
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">{"\u2014"}</p>
              )}
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <p className="text-xs text-muted-foreground mb-1">Ultima emissao</p>
              <p className="text-sm font-medium text-foreground">{fmt(form.last_emission_at)}</p>
            </div>
          </div>
        )}

        {/* Como configurar */}
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
          <p className="text-xs font-semibold text-foreground mb-2">Como configurar a NFS-e Nacional</p>
          <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
            <li>Obtenha um <strong>certificado digital ICP-Brasil A1</strong> (.pfx) com uma Autoridade Certificadora credenciada</li>
            <li>O certificado deve estar vinculado ao <strong>CNPJ da empresa</strong> prestadora de servicos</li>
            <li>Faca upload do arquivo <code className="bg-muted px-1 rounded">.pfx</code> e informe a senha</li>
            <li>Comece em <strong>Homologacao</strong> para testar, depois mude para Producao</li>
          </ol>
          <div className="mt-3 pt-3 border-t border-primary/10">
            <p className="text-xs font-semibold text-foreground mb-1.5">Configuracao do MCP Server</p>
            <p className="text-[11px] text-muted-foreground mb-2">
              Para usar via Claude ou outro agente AI, adicione ao <code className="bg-muted px-1 rounded">claude_desktop_config.json</code>:
            </p>
            <pre className="text-[10px] bg-muted rounded p-2.5 overflow-x-auto text-muted-foreground">{`{
  "mcpServers": {
    "nfse-nacional": {
      "command": "node",
      "args": ["${existingConfig ? "caminho/para/" : ""}nfse-nacional-mcp/dist/index.js"],
      "env": {
        "NFSE_AMBIENTE": "${form.ambiente}",
        "NFSE_CERT_PATH": "/caminho/para/certificado.pfx",
        "NFSE_CERT_PASSWORD": "sua-senha-aqui"
      }
    }
  }
}`}</pre>
          </div>
        </div>

        {/* Servidor de emissão — escolha da via */}
        <section>
          <h2 className="text-sm font-semibold text-foreground mb-1">Servidor de emissao</h2>
          <p className="text-xs text-muted-foreground mb-3">
            Escolha como suas notas sao transmitidas ao Ambiente Nacional.
          </p>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <button
              type="button"
              onClick={() => set("nfse_via", "worker_proprio")}
              className={`text-left rounded-lg border p-4 transition-colors ${
                form.nfse_via === "worker_proprio"
                  ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                  : "border-border hover:border-primary/40"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <ServerCog className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">Servidor proprio</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Voce hospeda um worker. <strong>Notas ilimitadas, sem custo por nota.</strong> <strong>Gratis</strong> pra testar (Netlify) ou producao robusta (Cloud Run/Railway).
              </p>
            </button>

            <button
              type="button"
              onClick={() => set("nfse_via", "provedor")}
              className={`text-left rounded-lg border p-4 transition-colors ${
                form.nfse_via === "provedor"
                  ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                  : "border-border hover:border-primary/40"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Cloud className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">Provedor (SaaS)</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Sem servidor pra manter. Emissao via provedor, <strong>pago por nota</strong>. Ideal pra baixo volume.
              </p>
            </button>
          </div>

          {form.nfse_via === "worker_proprio" ? (
            <div className="bg-card border border-border rounded-lg divide-y divide-border">
              <div className="p-4 space-y-2">
                <p className="text-xs text-foreground">
                  <strong>1.</strong> Publique o seu worker (uma vez). Hospedagens no README: <strong>Netlify</strong> (gratis,
                  sem cartao, ideal pra testar) ou <strong>Cloud Run/Railway</strong> (producao). Depois copie a URL de volta pra ca.
                </p>
                <a href={WORKER_REPO_URL} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm" className="gap-2">
                    <Rocket className="h-4 w-4" /> Publicar meu worker
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                </a>
              </div>

              <div className="p-4 space-y-1.5">
                <Label>URL do worker *</Label>
                <Input
                  value={form.worker_url}
                  onChange={(e) => set("worker_url", e.target.value)}
                  placeholder="https://seu-worker.up.railway.app"
                  className="font-mono text-sm"
                />
                <p className="text-[11px] text-muted-foreground">
                  O dominio publico gerado no seu provedor de hospedagem. Sem barra no final.
                </p>
              </div>

              <div className="p-4 space-y-1.5">
                <Label>Chave do worker (X-API-Key) *</Label>
                <Input
                  type="password"
                  value={form.worker_api_key}
                  onChange={(e) => set("worker_api_key", e.target.value)}
                  placeholder="valor de NFSE_WORKER_API_KEY"
                  className="font-mono text-sm"
                />
                <p className="text-[11px] text-muted-foreground">
                  Copie de Variables no painel do seu worker (Railway/Cloud Run).
                </p>
              </div>

              <div className="p-4 flex items-center gap-3">
                <Button variant="outline" size="sm" onClick={testWorker} disabled={workerTesting} className="gap-2">
                  <Plug className="h-4 w-4" />
                  {workerTesting ? "Testando..." : "Testar servidor"}
                </Button>
                {workerTest.status !== "idle" && (
                  <span className={`flex items-start gap-1.5 text-[11px] ${workerTest.status === "ok" ? "text-income" : "text-expense"}`}>
                    {workerTest.status === "ok" ? <CheckCircle2 className="h-3.5 w-3.5 mt-px shrink-0" /> : <XCircle className="h-3.5 w-3.5 mt-px shrink-0" />}
                    {workerTest.msg}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 text-xs text-muted-foreground">
              A via <strong>provedor</strong> emite via SaaS (PlugNotas / Focus NFe), sem servidor proprio.
              Configure as credenciais do provedor em <strong>Configuracoes &gt; Integracoes &gt; PlugNotas</strong>.
              O certificado abaixo continua necessario (o provedor assina em nome da sua empresa).
            </div>
          )}
        </section>

        {/* Certificado Digital */}
        <section>
          <h2 className="text-sm font-semibold text-foreground mb-1">Certificado Digital A1</h2>
          <p className="text-xs text-muted-foreground mb-3">
            Certificado ICP-Brasil no formato PKCS#12 (.pfx). Usado para autenticacao mTLS e assinatura digital das NFS-e.
          </p>
          <div className="bg-card border border-border rounded-lg divide-y divide-border">

            {/* PFX upload */}
            <div className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <Label>Arquivo do certificado <span className="text-muted-foreground font-normal">(.pfx)</span> *</Label>
                {form.cert_pfx_base64 && (
                  <span className="flex items-center gap-1 text-[11px] text-income">
                    <FileCheck className="h-3.5 w-3.5" /> {pfxFileName || "Carregado"}
                  </span>
                )}
              </div>

              <input
                ref={pfxInputRef}
                type="file"
                accept=".pfx,.p12"
                className="hidden"
                onChange={handlePfxFile}
              />

              <div
                onClick={() => pfxInputRef.current?.click()}
                className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-lg p-5 cursor-pointer transition-colors ${
                  form.cert_pfx_base64
                    ? "border-income/40 bg-income/5"
                    : "border-border hover:border-primary/40 hover:bg-accent/40"
                }`}
              >
                {form.cert_pfx_base64 ? (
                  <>
                    <ShieldCheck className="h-6 w-6 text-income" />
                    <p className="text-xs font-medium text-foreground">{pfxFileName}</p>
                    <p className="text-[11px] text-muted-foreground">Clique para substituir</p>
                  </>
                ) : (
                  <>
                    <Upload className="h-6 w-6 text-muted-foreground" />
                    <p className="text-xs text-foreground font-medium">Clique para selecionar o certificado</p>
                    <p className="text-[11px] text-muted-foreground">.pfx ou .p12</p>
                  </>
                )}
              </div>
            </div>

            {/* Password */}
            <div className="p-4 space-y-1.5">
              <Label>Senha do certificado *</Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={form.cert_password}
                  onChange={(e) => set("cert_password", e.target.value)}
                  placeholder="Senha do arquivo .pfx"
                  className="font-mono text-sm pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

          </div>
        </section>

        {/* Configuracoes */}
        <section>
          <h2 className="text-sm font-semibold text-foreground mb-3">Configuracoes de emissao</h2>
          <div className="bg-card border border-border rounded-lg divide-y divide-border">

            <div className="flex items-center justify-between p-4">
              <div>
                <Label>Ambiente</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Use homologacao para testes (ADN producao restrita)
                </p>
              </div>
              <Select value={form.ambiente} onValueChange={(v) => set("ambiente", v)}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="homologacao">Homologacao</SelectItem>
                  <SelectItem value="producao">Producao</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="p-4 space-y-1.5">
              <Label>Serie da DPS</Label>
              <Input
                value={form.serie_dps}
                onChange={(e) => set("serie_dps", e.target.value)}
                placeholder="1"
                className="font-mono text-sm max-w-32"
              />
              <p className="text-[11px] text-muted-foreground">
                Numerica obrigatoria a partir de jan/2026
              </p>
            </div>

            <div className="p-4 space-y-1.5">
              <Label>Proximo numero da DPS</Label>
              <Input
                type="number"
                value={form.proximo_numero_dps}
                onChange={(e) => set("proximo_numero_dps", parseInt(e.target.value) || 1)}
                className="font-mono text-sm max-w-32"
                min={1}
              />
              <p className="text-[11px] text-muted-foreground">
                Incrementado automaticamente a cada emissao
              </p>
            </div>

            <div className="p-4 space-y-1.5">
              <Label>Codigo do municipio (IBGE)</Label>
              <Input
                value={form.codigo_municipio}
                onChange={(e) => set("codigo_municipio", e.target.value)}
                placeholder="3550308 (ex: Sao Paulo)"
                className="font-mono text-sm max-w-48"
                maxLength={7}
              />
            </div>

            <div className="p-4 space-y-1.5">
              <Label>Inscricao Municipal (opcional)</Label>
              <Input
                value={form.inscricao_municipal}
                onChange={(e) => set("inscricao_municipal", e.target.value)}
                placeholder="Numero da IM no municipio"
                className="font-mono text-sm max-w-48"
              />
            </div>

            <div className="flex items-center justify-between p-4">
              <div>
                <Label>Integracao ativa</Label>
              </div>
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
            {saving ? "Salvando..." : "Salvar configuracao"}
          </Button>
          <Button variant="outline" onClick={handleTest} disabled={testing} className="gap-2">
            <Plug className="h-4 w-4" />
            {testing ? "Testando..." : "Testar conexao"}
          </Button>
        </div>

        {/* Tools reference */}
        <section>
          <h2 className="text-sm font-semibold text-foreground mb-1">Tools disponiveis no MCP</h2>
          <p className="text-xs text-muted-foreground mb-3">
            O servidor MCP <code className="bg-muted px-1 rounded">nfse-nacional</code> expoe 14 tools para o agente AI:
          </p>
          <div className="bg-card border border-border rounded-lg divide-y divide-border">
            {[
              { group: "Emissao", tools: [
                { name: "nfse_emitir", desc: "Emitir NFS-e individual" },
                { name: "nfse_emitir_lote", desc: "Emitir lote de ate 50 NFS-e" },
              ]},
              { group: "Eventos", tools: [
                { name: "nfse_cancelar", desc: "Cancelar NFS-e (prazo: 35 dias)" },
                { name: "nfse_substituir", desc: "Substituir NFS-e por outra" },
              ]},
              { group: "Consultas", tools: [
                { name: "nfse_consultar_chave", desc: "Consultar NFS-e pela chave de acesso" },
                { name: "nfse_consultar_dfe", desc: "Distribuicao DFe (por NSU)" },
                { name: "nfse_consultar_lote", desc: "Resultado de lote enviado" },
              ]},
              { group: "Documentos", tools: [
                { name: "nfse_gerar_danfse", desc: "Gerar PDF (DANFSE)" },
              ]},
              { group: "Parametros", tools: [
                { name: "nfse_parametros_municipio", desc: "Parametros fiscais do municipio" },
                { name: "nfse_parametros_contribuinte", desc: "Parametros do contribuinte" },
                { name: "nfse_cnc_consultar", desc: "Cadastro Nacional de Contribuintes" },
                { name: "nfse_codigos_servico", desc: "Codigos LC 116/2003" },
              ]},
              { group: "Utilitarios", tools: [
                { name: "nfse_validar_dps", desc: "Validar DPS sem enviar" },
                { name: "nfse_status_ambiente", desc: "Status ADN + certificado" },
              ]},
            ].map((group) => (
              <div key={group.group} className="p-4">
                <p className="text-xs font-semibold text-foreground mb-2">{group.group}</p>
                <div className="space-y-1.5">
                  {group.tools.map((tool) => (
                    <div key={tool.name} className="flex items-center gap-2">
                      <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
                      <code className="text-[11px] text-primary font-mono">{tool.name}</code>
                      <span className="text-[11px] text-muted-foreground">{tool.desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

      </div>
      )}
    </AppLayout>
  );
}
