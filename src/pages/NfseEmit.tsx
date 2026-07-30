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
  ArrowLeft, Send, FileCheck, Building2, User, DollarSign, Loader2, Layers,
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

  // Detect PlugNotas as alternative provider so the user can switch
  const { data: plugnotasConfig } = useQuery({
    queryKey: ["plugnotas_config", company?.id],
    enabled: !!company,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("plugnotas_config")
        .select("active, enabled_nfse")
        .eq("company_id", company!.id)
        .maybeSingle();
      return data as { active: boolean; enabled_nfse: boolean } | null;
    },
  });

  const plugnotasAvailable = plugnotasConfig?.active && plugnotasConfig?.enabled_nfse;

  // Focus NFe: terceiro provedor possível para a mesma NFS-e
  const { data: focusConfig } = useQuery({
    queryKey: ["focus_config", company?.id],
    enabled: !!company?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("focus_config" as never)
        .select("active, enabled_nfse, environment, token_homologacao_preview, token_producao_preview")
        .eq("company_id", company!.id)
        .maybeSingle();
      return data as {
        active: boolean; enabled_nfse: boolean; environment: string;
        token_homologacao_preview: string | null; token_producao_preview: string | null;
      } | null;
    },
  });
  const focusAvailable = !!focusConfig?.active && !!focusConfig?.enabled_nfse &&
    !!(focusConfig?.environment === "producao" ? focusConfig?.token_producao_preview : focusConfig?.token_homologacao_preview);

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
      const { data, error } = await supabase.functions.invoke("nfse-proxy", {
        body: {
          operation: "emit",
          companyId: company!.id,
          // A tela de pedidos manda sales_order_id na URL e este arquivo
          // descartava o parâmetro, então invoices.sales_order_id era sempre
          // nulo e a nota nunca sabia de qual pedido tinha nascido. nfse-proxy
          // já aceitava salesOrderId; faltava alguém mandar.
          salesOrderId: searchParams.get("sales_order_id") ?? undefined,
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
            valores: {
              valorServicos: valor,
            },
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
    } catch (err: any) {
      toast.error(err.message || "Erro de comunicacao com o servidor");
    } finally {
      setEmitting(false);
    }
  };

  const isConfigured = nfseConfig?.active && nfseConfig?.cert_pfx_base64;

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

        {/* Provider selector — only shown when PlugNotas is also available */}
        {plugnotasAvailable && (
          <Card className="border-primary/30 bg-primary/[0.08] dark:bg-primary/[0.08] dark:border-primary/30">
            <CardContent className="py-3 px-4 flex items-center justify-between gap-3">
              <div className="flex items-start gap-2">
                <Layers className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-medium text-primary dark:text-primary">
                    PlugNotas também está habilitado para NFSe nessa empresa
                  </p>
                  <p className="text-[11px] text-primary dark:text-primary/80 mt-0.5">
                    Use o provedor que melhor atende o município ou tipo de operação.
                  </p>
                </div>
              </div>
              <Link to="/fiscal/plugnotas/emit">
                <Button size="sm" variant="outline" className="shrink-0">
                  Emitir via PlugNotas
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Focus NFe como provedor alternativo */}
        {focusAvailable && (
          <Card className="border-primary/30 bg-primary/[0.08] dark:bg-primary/[0.08] dark:border-primary/30">
            <CardContent className="py-3 px-4 flex items-center justify-between gap-3">
              <div className="flex items-start gap-2">
                <Layers className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-medium text-primary dark:text-primary">
                    Focus NFe também está habilitada para NFS-e nessa empresa
                    {focusConfig?.environment === "homologacao" && " (ambiente de teste)"}
                  </p>
                  <p className="text-[11px] text-primary dark:text-primary/80 mt-0.5">
                    Busca o tomador pelo CNPJ e devolve PDF e XML na mesma tela.
                  </p>
                </div>
              </div>
              <Link to="/fiscal/focus/emit">
                <Button size="sm" variant="outline" className="shrink-0">
                  Emitir via Focus
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Not configured: guia de ativação em 3 passos */}
        {!configLoading && !isConfigured && (
          <Card className="border-warning/30 bg-warning/[0.08] dark:bg-warning/[0.08] dark:border-warning/30">
            <CardContent className="py-4 px-5">
              <p className="text-sm font-medium text-warning dark:text-warning">
                Ative a emissão NFS-e Nacional em 3 passos
              </p>
              <p className="text-xs text-warning dark:text-warning mt-1">
                A partir de <strong>01/09/2026</strong> o Emissor Nacional é obrigatório para
                empresas do Simples Nacional (Resolução CGSN 189/2026). Emitindo por aqui você
                já fica em conformidade — sem custo por nota.
              </p>
              <ol className="mt-3 space-y-1.5 text-xs text-warning dark:text-warning">
                <li className="flex gap-2">
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-warning/[0.08] text-[10px] font-bold text-warning dark:bg-warning/[0.08] dark:text-warning">1</span>
                  Envie o certificado digital A1 (.pfx) da empresa e a senha
                </li>
                <li className="flex gap-2">
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-warning/[0.08] text-[10px] font-bold text-warning dark:bg-warning/[0.08] dark:text-warning">2</span>
                  Confirme inscrição municipal e código de serviço padrão
                </li>
                <li className="flex gap-2">
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-warning/[0.08] text-[10px] font-bold text-warning dark:bg-warning/[0.08] dark:text-warning">3</span>
                  Teste a conexão e emita a primeira nota nesta tela
                </li>
              </ol>
              <Link to="/settings/integrations/nfse">
                <Button variant="outline" size="sm" className="mt-3">
                  Começar configuração
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Success result */}
        {result?.success && (
          <Card className="border-success/30 bg-success/[0.08] dark:bg-success/[0.08] dark:border-success/30">
            <CardContent className="py-5 px-5">
              <div className="flex items-start gap-3">
                <FileCheck className="h-5 w-5 text-success mt-0.5" />
                <div className="space-y-2">
                  <p className="text-sm font-medium text-success dark:text-success">
                    NFS-e emitida com sucesso!
                  </p>
                  {result.chaveAcesso && (
                    <p className="text-xs font-mono text-success dark:text-success">
                      Chave: {result.chaveAcesso}
                    </p>
                  )}
                  {result.idDPS && (
                    <p className="text-xs font-mono text-success dark:text-success">
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
              <Card className="border-destructive/30 bg-destructive/[0.08] dark:bg-destructive/[0.08] dark:border-destructive/30">
                <CardContent className="py-4 px-5">
                  <p className="text-sm font-medium text-destructive dark:text-destructive">
                    Erro na emissao
                  </p>
                  <p className="text-xs text-destructive dark:text-destructive mt-1 font-mono">
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
