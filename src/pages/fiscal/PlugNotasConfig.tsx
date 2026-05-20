import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft, Eye, EyeOff, Loader2, Plug, Save, ShieldCheck, Upload, Building2,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useCompany } from "@/hooks/useCompany";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";

const SANDBOX_KEY_SUGGESTION = "2da392a6-79d2-4304-a8b7-959572c7e44d";

interface PlugConfig {
  id?: string;
  company_id: string;
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
}

const empty = (companyId: string): PlugConfig => ({
  company_id: companyId,
  api_key: "",
  environment: "sandbox",
  plugnotas_empresa_cnpj: "",
  plugnotas_empresa_id: "",
  enabled_nfe: false,
  enabled_nfse: true,
  enabled_nfce: false,
  enabled_cte: false,
  enabled_mdfe: false,
  serie_padrao: "1",
  active: true,
  last_test_at: null,
  last_test_status: null,
});

export default function PlugNotasConfigPage() {
  const { company } = useCompany();
  const qc = useQueryClient();
  const [form, setForm] = useState<PlugConfig | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["plugnotas_config", company?.id],
    enabled: !!company,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("plugnotas_config")
        .select("*")
        .eq("company_id", company!.id)
        .maybeSingle();
      return data as PlugConfig | null;
    },
  });

  useEffect(() => {
    if (!company) return;
    setForm(data ?? empty(company.id));
  }, [data, company]);

  const set = <K extends keyof PlugConfig>(k: K, v: PlugConfig[K]) =>
    setForm((f) => (f ? { ...f, [k]: v } : f));

  const handleSave = async () => {
    if (!form || !company) return;
    setSaving(true);
    try {
      const payload = { ...form, company_id: company.id };
      const { error } = await (supabase as any)
        .from("plugnotas_config")
        .upsert(payload, { onConflict: "company_id" });
      if (error) throw error;
      toast.success("Configuração salva");
      qc.invalidateQueries({ queryKey: ["plugnotas_config", company.id] });
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!company) return;
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("plugnotas-status", {
        body: { company_id: company.id, operation: "ping" },
      });
      if (error) throw error;
      if (data?.ok) toast.success("Conexão com PlugNotas OK");
      else toast.error(data?.data?.error?.message ?? "Falha na conexão");
      qc.invalidateQueries({ queryKey: ["plugnotas_config", company.id] });
    } catch (err: any) {
      toast.error(err.message ?? "Erro");
    } finally {
      setTesting(false);
    }
  };

  if (!company || isLoading || !form) {
    return (
      <AppLayout>
        <div className="space-y-4 max-w-3xl">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in max-w-3xl">
        <div className="flex items-center gap-3">
          <Link to="/fiscal">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold tracking-[-0.02em] flex items-center gap-2">
              <Plug className="h-6 w-6" /> PlugNotas
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Provedor fiscal alternativo (NFe, NFSe, NFCe, CTe, MDFe)
            </p>
          </div>
          {form.last_test_status && (
            <Badge variant={form.last_test_status === "ok" ? "default" : "destructive"}>
              {form.last_test_status === "ok" ? "Conectado" : "Falha"}
            </Badge>
          )}
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Credenciais</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">Ambiente</Label>
              <Select
                value={form.environment}
                onValueChange={(v: "sandbox" | "producao") => set("environment", v)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sandbox">Sandbox (testes)</SelectItem>
                  <SelectItem value="producao">Produção</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">API Key</Label>
              <div className="flex gap-2">
                <Input
                  type={showKey ? "text" : "password"}
                  placeholder={form.environment === "sandbox" ? SANDBOX_KEY_SUGGESTION : ""}
                  value={form.api_key}
                  onChange={(e) => set("api_key", e.target.value)}
                  className="font-mono"
                />
                <Button variant="outline" size="icon" onClick={() => setShowKey((s) => !s)}>
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              {form.environment === "sandbox" && !form.api_key && (
                <button
                  onClick={() => set("api_key", SANDBOX_KEY_SUGGESTION)}
                  className="text-xs text-primary hover:underline mt-1"
                >
                  Usar chave pública de sandbox
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">CNPJ da empresa (PlugNotas)</Label>
                <Input
                  placeholder="00.000.000/0000-00"
                  value={form.plugnotas_empresa_cnpj ?? ""}
                  onChange={(e) => set("plugnotas_empresa_cnpj", e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Série padrão</Label>
                <Input
                  value={form.serie_padrao ?? ""}
                  onChange={(e) => set("serie_padrao", e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Documentos habilitados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(
              [
                ["enabled_nfe", "NF-e (mercadorias)"],
                ["enabled_nfse", "NFS-e (serviços)"],
                ["enabled_nfce", "NFC-e (consumidor)"],
                ["enabled_cte", "CT-e (transporte)"],
                ["enabled_mdfe", "MDF-e (manifesto)"],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="flex items-center justify-between py-1">
                <Label htmlFor={key} className="text-sm">{label}</Label>
                <Switch
                  id={key}
                  checked={form[key] as boolean}
                  onCheckedChange={(v) => set(key, v as never)}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Empresa & Certificado</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <CadastrarEmpresaDialog companyId={company.id} cnpjPadrao={form.plugnotas_empresa_cnpj} />
            <EnviarCertificadoDialog companyId={company.id} cnpj={form.plugnotas_empresa_cnpj} />
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={handleTest} disabled={testing || !form.api_key}>
            {testing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
            Testar conexão
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}

function CadastrarEmpresaDialog({ companyId, cnpjPadrao }: { companyId: string; cnpjPadrao: string | null }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({
    razao_social: "",
    cnpj: cnpjPadrao ?? "",
    inscricao_municipal: "",
    regime_tributario: "1",
    endereco_logradouro: "",
    endereco_numero: "",
    endereco_bairro: "",
    endereco_municipio: "",
    endereco_uf: "",
    endereco_cep: "",
  });

  const submit = async () => {
    setLoading(true);
    try {
      const { data: res, error } = await supabase.functions.invoke("plugnotas-empresa", {
        body: {
          company_id: companyId,
          operation: "criar",
          params: data,
        },
      });
      if (error) throw error;
      if (res?.ok) {
        toast.success("Empresa cadastrada no PlugNotas");
        setOpen(false);
      } else {
        toast.error(res?.data?.error?.message ?? "Falha ao cadastrar empresa");
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Building2 className="h-4 w-4 mr-2" /> Cadastrar empresa
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Cadastrar empresa no PlugNotas</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Razão Social</Label><Input value={data.razao_social} onChange={(e) => setData({ ...data, razao_social: e.target.value })} /></div>
            <div><Label className="text-xs">CNPJ</Label><Input value={data.cnpj} onChange={(e) => setData({ ...data, cnpj: e.target.value })} /></div>
            <div><Label className="text-xs">Inscrição Municipal</Label><Input value={data.inscricao_municipal} onChange={(e) => setData({ ...data, inscricao_municipal: e.target.value })} /></div>
            <div>
              <Label className="text-xs">Regime Tributário</Label>
              <Select value={data.regime_tributario} onValueChange={(v) => setData({ ...data, regime_tributario: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Simples Nacional</SelectItem>
                  <SelectItem value="2">Simples Nacional - excesso</SelectItem>
                  <SelectItem value="3">Regime Normal</SelectItem>
                  <SelectItem value="4">MEI</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2"><Label className="text-xs">Logradouro</Label><Input value={data.endereco_logradouro} onChange={(e) => setData({ ...data, endereco_logradouro: e.target.value })} /></div>
            <div><Label className="text-xs">Número</Label><Input value={data.endereco_numero} onChange={(e) => setData({ ...data, endereco_numero: e.target.value })} /></div>
            <div><Label className="text-xs">Bairro</Label><Input value={data.endereco_bairro} onChange={(e) => setData({ ...data, endereco_bairro: e.target.value })} /></div>
            <div><Label className="text-xs">Município</Label><Input value={data.endereco_municipio} onChange={(e) => setData({ ...data, endereco_municipio: e.target.value })} /></div>
            <div><Label className="text-xs">UF</Label><Input maxLength={2} value={data.endereco_uf} onChange={(e) => setData({ ...data, endereco_uf: e.target.value.toUpperCase() })} /></div>
            <div><Label className="text-xs">CEP</Label><Input value={data.endereco_cep} onChange={(e) => setData({ ...data, endereco_cep: e.target.value })} /></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={loading || !data.razao_social || !data.cnpj}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Cadastrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EnviarCertificadoDialog({ companyId, cnpj }: { companyId: string; cnpj: string | null }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [pfxBase64, setPfxBase64] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name);
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const b64 = result.split(",")[1] ?? "";
      setPfxBase64(b64);
    };
    reader.readAsDataURL(f);
  };

  const submit = async () => {
    if (!pfxBase64 || !password) {
      toast.error("Selecione o .pfx e informe a senha");
      return;
    }
    setLoading(true);
    try {
      const { data: res, error } = await supabase.functions.invoke("plugnotas-empresa", {
        body: {
          company_id: companyId,
          operation: "enviar_certificado",
          params: { pfx_base64: pfxBase64, password, cnpj },
        },
      });
      if (error) throw error;
      if (res?.ok) {
        toast.success("Certificado enviado");
        setOpen(false);
      } else {
        toast.error(res?.data?.error?.message ?? "Falha ao enviar certificado");
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Upload className="h-4 w-4 mr-2" /> Enviar certificado A1
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Enviar certificado A1 (.pfx)</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Arquivo .pfx</Label>
            <Input type="file" accept=".pfx" onChange={onFile} />
            {fileName && <p className="text-xs text-muted-foreground mt-1">{fileName}</p>}
          </div>
          <div>
            <Label className="text-xs">Senha</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
