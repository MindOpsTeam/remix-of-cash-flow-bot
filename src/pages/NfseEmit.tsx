import { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, Send, FileCheck, Building2, User, DollarSign, Loader2,
} from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useCompany } from "@/hooks/useCompany";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const serviceCodes = [
  { code: "010101", label: "01.01.01 - Analise e desenvolvimento de sistemas" },
  { code: "010102", label: "01.01.02 - Programacao" },
  { code: "010103", label: "01.01.03 - Processamento de dados" },
  { code: "010104", label: "01.01.04 - Elaboracao de programas de computador" },
  { code: "010105", label: "01.01.05 - Licenciamento de software" },
  { code: "010601", label: "01.06.01 - Assessoria e consultoria em informatica" },
  { code: "010701", label: "01.07.01 - Suporte tecnico em informatica" },
  { code: "010801", label: "01.08.01 - Planejamento e manutencao de paginas web" },
  { code: "170101", label: "17.01.01 - Assessoria ou consultoria de qualquer natureza" },
];

interface EmitForm {
  // Tomador
  tomadorCpfCnpj: string;
  tomadorRazaoSocial: string;
  tomadorEmail: string;
  // Servico
  codigoServico: string;
  descricao: string;
  // Valores
  valorServicos: string;
  // Competencia
  competencia: string;
  // Observacoes
  observacoes: string;
}

const emptyForm: EmitForm = {
  tomadorCpfCnpj: "",
  tomadorRazaoSocial: "",
  tomadorEmail: "",
  codigoServico: "",
  descricao: "",
  valorServicos: "",
  competencia: new Date().toISOString().substring(0, 7), // YYYY-MM
  observacoes: "",
};

export default function NfseEmitPage() {
  const { company } = useCompany();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState<EmitForm>(emptyForm);
  const [emitting, setEmitting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const providerKey = company ? `nfse_provider_${company.id}` : "nfse_provider";
  const [provider, setProvider] = useState<"nacional" | "plugnotas">(() => {
    if (typeof window === "undefined") return "nacional";
    return (localStorage.getItem(providerKey) as any) || "nacional";
  });
  useEffect(() => {
    if (company) {
      const stored = localStorage.getItem(`nfse_provider_${company.id}`);
      if (stored === "plugnotas" || stored === "nacional") setProvider(stored);
    }
  }, [company]);
  const changeProvider = (v: "nacional" | "plugnotas") => {
    setProvider(v);
    if (company) localStorage.setItem(`nfse_provider_${company.id}`, v);
  };

  // Pre-fill from sales order query params
  useEffect(() => {
    const valor = searchParams.get("valor");
    const contactId = searchParams.get("contact_id");

    if (valor) {
      setForm((f) => ({ ...f, valorServicos: valor }));
    }

    if (contactId && company) {
      supabase
        .from("contacts")
        .select("name, document, email")
        .eq("id", contactId)
        .single()
        .then(({ data }) => {
          if (data) {
            setForm((f) => ({
              ...f,
              tomadorCpfCnpj: data.document || "",
              tomadorRazaoSocial: data.name || "",
              tomadorEmail: data.email || "",
            }));
          }
        });
    }
  }, [searchParams, company]);

  const set = <K extends keyof EmitForm>(key: K, value: EmitForm[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  // Load NFS-e config to check if configured
  const { data: nfseConfig, isLoading: configLoading } = useQuery({
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

  const { data: plugConfig } = useQuery({
    queryKey: ["plugnotas_config", company?.id],
    enabled: !!company,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("plugnotas_config")
        .select("api_key, enabled_nfse, serie_padrao, active")
        .eq("company_id", company!.id)
        .maybeSingle();
      return data;
    },
  });

  // Load contacts for autocomplete
  const { data: contacts = [] } = useQuery({
    queryKey: ["contacts", company?.id],
    enabled: !!company,
    queryFn: async () => {
      const { data } = await supabase
        .from("contacts")
        .select("id, name, document, email")
        .eq("company_id", company!.id)
        .eq("active", true)
        .order("name");
      return data || [];
    },
  });

  const handleContactSelect = (doc: string) => {
    const c = contacts.find((ct: any) => ct.document === doc);
    if (c) {
      set("tomadorCpfCnpj", c.document || "");
      set("tomadorRazaoSocial", c.name || "");
      set("tomadorEmail", c.email || "");
    }
  };

  const handleEmit = async () => {
    if (!form.tomadorCpfCnpj || !form.codigoServico || !form.valorServicos || !form.descricao) {
      toast.error("Preencha todos os campos obrigatorios");
      return;
    }

    const valor = parseFloat(form.valorServicos.replace(/\./g, "").replace(",", "."));
    if (isNaN(valor) || valor <= 0) {
      toast.error("Valor dos servicos deve ser maior que zero");
      return;
    }

    setEmitting(true);
    setResult(null);

    try {
      if (provider === "plugnotas") {
        const { data, error } = await supabase.functions.invoke("plugnotas-nfse", {
          body: {
            company_id: company!.id,
            operation: "emitir",
            params: {
              idIntegracao: `nfse-${Date.now()}`,
              serie: plugConfig?.serie_padrao ?? "1",
              competencia: form.competencia,
              tomador: {
                cpfCnpj: form.tomadorCpfCnpj.replace(/\D/g, ""),
                razaoSocial: form.tomadorRazaoSocial,
                email: form.tomadorEmail,
              },
              servico: {
                codigo: form.codigoServico,
                discriminacao: form.descricao,
                valor: valor,
              },
              observacoes: form.observacoes,
            },
          },
        });
        if (error) throw error;
        if (data?.ok) {
          setResult({ success: true, ...(data.data ?? {}) });
          toast.success("NFS-e enviada via PlugNotas!");
        } else {
          const msg = data?.data?.error?.message ?? "Erro ao emitir via PlugNotas";
          toast.error(msg);
          setResult({ success: false, error: msg, raw: data });
        }
      } else {
        const { data, error } = await supabase.functions.invoke("nfse-proxy", {
          body: {
            operation: "emit",
            companyId: company!.id,
            data: {
              tomador: {
                cpfCnpj: form.tomadorCpfCnpj.replace(/\D/g, ""),
                razaoSocial: form.tomadorRazaoSocial,
                email: form.tomadorEmail,
              },
              servico: {
                codigoTribNac: form.codigoServico,
                descricao: form.descricao,
              },
              valores: { valorServicos: valor },
              competencia: form.competencia,
              observacoes: form.observacoes,
            },
          },
        });
        if (error) throw error;
        if (data?.success) {
          setResult(data);
          toast.success("NFS-e emitida com sucesso!");
        } else {
          toast.error(data?.error || "Erro ao emitir NFS-e");
          setResult(data);
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Erro de comunicacao com o servidor");
    } finally {
      setEmitting(false);
    }
  };

  const isConfigured =
    provider === "plugnotas"
      ? !!(plugConfig?.active && plugConfig?.api_key && plugConfig?.enabled_nfse)
      : !!(nfseConfig?.active && nfseConfig?.cert_pfx_base64);

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in max-w-3xl">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link to="/fiscal">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-[-0.02em] flex items-center gap-2">
              <FileCheck className="h-6 w-6" /> Emitir NFS-e
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Emissao de Nota Fiscal de Servico Eletronica
            </p>
          </div>
        </div>

        {/* Provider selector */}
        <Card>
          <CardContent className="py-4 px-5 flex items-center gap-3">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider shrink-0">
              Provedor
            </Label>
            <Select value={provider} onValueChange={(v: any) => changeProvider(v)}>
              <SelectTrigger className="max-w-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="nacional">NFS-e Nacional (gov.br)</SelectItem>
                <SelectItem value="plugnotas" disabled={!plugConfig?.enabled_nfse}>
                  PlugNotas {!plugConfig?.enabled_nfse && "(NFS-e desabilitado)"}
                </SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Not configured warning */}
        {!configLoading && !isConfigured && (
          <Card className="border-amber-200 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-800">
            <CardContent className="py-4 px-5">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-400">
                Configuração {provider === "plugnotas" ? "PlugNotas" : "NFS-e Nacional"} pendente
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-500 mt-1">
                {provider === "plugnotas"
                  ? "Configure a API key e habilite NFS-e antes de emitir."
                  : "Antes de emitir, configure o certificado digital e os dados fiscais."}
              </p>
              <Link to={provider === "plugnotas" ? "/fiscal/plugnotas/config" : "/settings/integrations/nfse"}>
                <Button variant="outline" size="sm" className="mt-3">
                  Configurar
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Success result */}
        {result?.success && (
          <Card className="border-emerald-200 bg-emerald-50 dark:bg-emerald-900/10 dark:border-emerald-800">
            <CardContent className="py-5 px-5">
              <div className="flex items-start gap-3">
                <FileCheck className="h-5 w-5 text-emerald-600 mt-0.5" />
                <div className="space-y-2">
                  <p className="text-sm font-medium text-emerald-800 dark:text-emerald-400">
                    NFS-e emitida com sucesso!
                  </p>
                  {result.chaveAcesso && (
                    <p className="text-xs font-mono text-emerald-700 dark:text-emerald-500">
                      Chave: {result.chaveAcesso}
                    </p>
                  )}
                  {result.idDPS && (
                    <p className="text-xs font-mono text-emerald-700 dark:text-emerald-500">
                      ID DPS: {result.idDPS}
                    </p>
                  )}
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" variant="outline" onClick={() => { setResult(null); setForm(emptyForm); }}>
                      Emitir outra
                    </Button>
                    <Link to="/fiscal">
                      <Button size="sm">Ver notas emitidas</Button>
                    </Link>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Form */}
        {!result?.success && (
          <div className="space-y-4">
            {/* Competencia */}
            <Card>
              <CardContent className="py-4 px-5 space-y-3">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Competencia
                </Label>
                <Input
                  type="month"
                  value={form.competencia}
                  onChange={(e) => set("competencia", e.target.value)}
                />
              </CardContent>
            </Card>

            {/* Tomador */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <User className="h-4 w-4" /> Tomador do Servico
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {contacts.length > 0 && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Selecionar contato</Label>
                    <Select onValueChange={handleContactSelect}>
                      <SelectTrigger>
                        <SelectValue placeholder="Buscar contato cadastrado..." />
                      </SelectTrigger>
                      <SelectContent>
                        {contacts.filter((c: any) => c.document).map((c: any) => (
                          <SelectItem key={c.id} value={c.document}>
                            {c.name} ({c.document})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">CPF/CNPJ *</Label>
                    <Input
                      placeholder="00.000.000/0000-00"
                      value={form.tomadorCpfCnpj}
                      onChange={(e) => set("tomadorCpfCnpj", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Razao Social *</Label>
                    <Input
                      placeholder="Nome do tomador"
                      value={form.tomadorRazaoSocial}
                      onChange={(e) => set("tomadorRazaoSocial", e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">E-mail</Label>
                  <Input
                    type="email"
                    placeholder="email@empresa.com"
                    value={form.tomadorEmail}
                    onChange={(e) => set("tomadorEmail", e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Servico */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Building2 className="h-4 w-4" /> Servico Prestado
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Codigo de Tributacao Nacional *</Label>
                  <Select value={form.codigoServico} onValueChange={(v) => set("codigoServico", v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o codigo do servico..." />
                    </SelectTrigger>
                    <SelectContent>
                      {serviceCodes.map((s) => (
                        <SelectItem key={s.code} value={s.code}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Descricao do Servico *</Label>
                  <Textarea
                    placeholder="Descreva o servico prestado..."
                    rows={3}
                    value={form.descricao}
                    onChange={(e) => set("descricao", e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Valores */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <DollarSign className="h-4 w-4" /> Valores
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Valor dos Servicos (R$) *</Label>
                  <Input
                    type="text"
                    placeholder="0,00"
                    value={form.valorServicos}
                    onChange={(e) => set("valorServicos", e.target.value)}
                    className="font-mono text-lg"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Observacoes */}
            <Card>
              <CardContent className="py-4 px-5">
                <Label className="text-xs text-muted-foreground">Observacoes</Label>
                <Textarea
                  placeholder="Informacoes complementares (opcional)"
                  rows={2}
                  value={form.observacoes}
                  onChange={(e) => set("observacoes", e.target.value)}
                />
              </CardContent>
            </Card>

            {/* Error result */}
            {result && !result.success && (
              <Card className="border-red-200 bg-red-50 dark:bg-red-900/10 dark:border-red-800">
                <CardContent className="py-4 px-5">
                  <p className="text-sm font-medium text-red-800 dark:text-red-400">
                    Erro na emissao
                  </p>
                  <p className="text-xs text-red-700 dark:text-red-500 mt-1 font-mono">
                    {result.error || JSON.stringify(result)}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Submit */}
            <div className="flex justify-end gap-3 pt-2">
              <Link to="/fiscal">
                <Button variant="outline">Cancelar</Button>
              </Link>
              <Button
                onClick={handleEmit}
                disabled={emitting || !isConfigured}
                className="min-w-[160px]"
              >
                {emitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Emitindo...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Emitir NFS-e
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
