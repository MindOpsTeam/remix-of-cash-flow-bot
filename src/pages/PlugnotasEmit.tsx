import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import {
  ArrowLeft, FileText, Loader2, RefreshCw, ExternalLink, Send, Settings as SettingsIcon, AlertTriangle,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { toast } from "sonner";

type DocType = "nfse" | "nfe" | "nfce" | "cte" | "mdfe";

const FN_BY_TYPE: Record<DocType, string> = {
  nfse: "plugnotas-nfse",
  nfe: "plugnotas-nfe",
  nfce: "plugnotas-nfce",
  cte: "plugnotas-cte",
  mdfe: "plugnotas-mdfe",
};

const LABELS: Record<DocType, string> = {
  nfse: "NFSe",
  nfe: "NFe",
  nfce: "NFCe",
  cte: "CTe",
  mdfe: "MDFe",
};

interface PlugnotasConfig {
  enabled_nfe: boolean;
  enabled_nfse: boolean;
  enabled_nfce: boolean;
  enabled_cte: boolean;
  enabled_mdfe: boolean;
  active: boolean;
  environment: "sandbox" | "producao";
  plugnotas_empresa_cnpj: string | null;
}

interface PlugnotasDocument {
  id: string;
  doc_type: DocType;
  plugnotas_id: string | null;
  chave_acesso: string | null;
  numero: string | null;
  serie: string | null;
  status: string;
  status_message: string | null;
  xml_url: string | null;
  pdf_url: string | null;
  payload_response: unknown;
  emitted_at: string | null;
  created_at: string;
}

const statusColors: Record<string, string> = {
  enviado: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  processando: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  autorizado: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  cancelado: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
  rejeitado: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  erro: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

function fmtCNPJ(s: string | null | undefined) {
  if (!s) return "";
  const d = s.replace(/\D/g, "");
  return d.length === 14
    ? d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5")
    : s;
}

export default function PlugnotasEmitPage() {
  const { company } = useCompany();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<DocType>("nfse");
  const [emitting, setEmitting] = useState(false);
  const [rawJson, setRawJson] = useState("");
  const [lastResult, setLastResult] = useState<unknown>(null);

  const { data: config, isLoading: configLoading } = useQuery({
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

  const { data: documents = [], isLoading: docsLoading } = useQuery({
    queryKey: ["plugnotas_documents", company?.id],
    enabled: !!company,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("plugnotas_documents")
        .select("*")
        .eq("company_id", company!.id)
        .order("created_at", { ascending: false })
        .limit(50);
      return (data || []) as PlugnotasDocument[];
    },
  });

  const isEnabled = (t: DocType): boolean => {
    if (!config) return false;
    switch (t) {
      case "nfse": return config.enabled_nfse;
      case "nfe":  return config.enabled_nfe;
      case "nfce": return config.enabled_nfce;
      case "cte":  return config.enabled_cte;
      case "mdfe": return config.enabled_mdfe;
    }
  };

  const handleEmit = async () => {
    if (!company) return;
    let params: unknown;
    try {
      params = JSON.parse(rawJson);
    } catch (e) {
      toast.error("JSON inválido: " + (e instanceof Error ? e.message : String(e)));
      return;
    }

    setEmitting(true);
    setLastResult(null);
    try {
      const { data, error } = await supabase.functions.invoke(FN_BY_TYPE[activeTab], {
        body: { company_id: company.id, operation: "emitir", params },
      });
      if (error) throw new Error(error.message);
      setLastResult(data);
      if (data?.ok) {
        toast.success(`${LABELS[activeTab]} enviada — aguardando autorização`);
      } else {
        const apiMsg = (data?.data as any)?.error?.message ?? `HTTP ${data?.status}`;
        toast.error(`Falha na emissão: ${apiMsg}`);
      }
      qc.invalidateQueries({ queryKey: ["plugnotas_documents", company.id] });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setEmitting(false);
    }
  };

  const handleRefreshDoc = async (doc: PlugnotasDocument) => {
    if (!company || !doc.plugnotas_id) {
      toast.error("Documento sem id PlugNotas");
      return;
    }
    try {
      const { data, error } = await supabase.functions.invoke("plugnotas-status", {
        body: {
          company_id: company.id,
          operation: "consultar",
          params: { doc_type: doc.doc_type, id: doc.plugnotas_id },
        },
      });
      if (error) throw new Error(error.message);
      if (data?.ok) {
        toast.success("Status atualizado");
        qc.invalidateQueries({ queryKey: ["plugnotas_documents", company.id] });
      } else {
        const apiMsg = (data?.data as any)?.error?.message ?? `HTTP ${data?.status}`;
        toast.error(apiMsg);
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  if (configLoading) {
    return <AppLayout><div className="text-sm text-muted-foreground py-8">Carregando...</div></AppLayout>;
  }

  if (!config) {
    return (
      <AppLayout>
        <div className="space-y-6 animate-fade-in max-w-2xl">
          <div className="flex items-center gap-3">
            <Link to="/fiscal">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <h1 className="text-2xl font-bold tracking-[-0.02em] flex items-center gap-2">
              <FileText className="h-6 w-6" /> PlugNotas
            </h1>
          </div>
          <Card className="border-amber-200 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-800">
            <CardContent className="py-5 px-5">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-2">
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-400">
                    PlugNotas não configurado
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-500">
                    Configure a integração antes de emitir documentos fiscais por aqui.
                  </p>
                  <Link to="/settings/integrations/plugnotas">
                    <Button size="sm" variant="outline" className="mt-1 gap-2">
                      <SettingsIcon className="h-4 w-4" /> Configurar PlugNotas
                    </Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  const availableTabs: DocType[] = (["nfse", "nfe", "nfce", "cte", "mdfe"] as DocType[]).filter(isEnabled);

  // Adjust active tab if currently selected is not enabled
  useEffect(() => {
    if (availableTabs.length > 0 && !availableTabs.includes(activeTab)) {
      setActiveTab(availableTabs[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableTabs.join(",")]);

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in max-w-4xl">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link to="/fiscal">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-[-0.02em] flex items-center gap-2">
                <FileText className="h-6 w-6" /> PlugNotas
              </h1>
              <Badge variant="outline" className="capitalize">{config.environment}</Badge>
              {config.plugnotas_empresa_cnpj && (
                <Badge variant="secondary" className="font-mono text-[11px]">
                  {fmtCNPJ(config.plugnotas_empresa_cnpj)}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              Emissão de documentos fiscais via PlugNotas
            </p>
          </div>
          <Link to="/settings/integrations/plugnotas">
            <Button variant="outline" size="sm" className="gap-2">
              <SettingsIcon className="h-4 w-4" /> Configurações
            </Button>
          </Link>
        </div>

        {availableTabs.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center">
              <p className="text-sm text-muted-foreground">
                Nenhum tipo de documento habilitado.{" "}
                <Link to="/settings/integrations/plugnotas" className="text-primary hover:underline">
                  Habilite ao menos um nas configurações
                </Link>.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as DocType)}>
            <TabsList>
              {availableTabs.map((t) => (
                <TabsTrigger key={t} value={t}>{LABELS[t]}</TabsTrigger>
              ))}
            </TabsList>

            {availableTabs.map((t) => (
              <TabsContent key={t} value={t}>
                <Card>
                  <CardContent className="py-5 px-5 space-y-4">
                    {t === "cte" && config.environment === "sandbox" && (
                      <div className="flex items-start gap-2 p-3 rounded-lg text-xs bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800">
                        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                        <span className="text-amber-800 dark:text-amber-400">
                          CTe não está disponível no sandbox do PlugNotas. Use em produção.
                        </span>
                      </div>
                    )}
                    <div>
                      <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Payload de emissão ({LABELS[t]})
                      </Label>
                      <p className="text-xs text-muted-foreground mt-1 mb-2">
                        JSON do documento. Será enviado para <code className="bg-muted px-1 rounded">{FN_BY_TYPE[t]}</code> com <code className="bg-muted px-1 rounded">operation: "emitir"</code>.{" "}
                        <a
                          href={`https://plugnotas.com.br/docs/#tag/${t.toUpperCase()}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline inline-flex items-center gap-1"
                        >
                          Schema oficial <ExternalLink className="h-3 w-3" />
                        </a>
                      </p>
                      <Textarea
                        value={rawJson}
                        onChange={(e) => setRawJson(e.target.value)}
                        placeholder={JSON.stringify(getExamplePayload(t, config.plugnotas_empresa_cnpj), null, 2)}
                        className="font-mono text-xs min-h-[260px]"
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <Button onClick={handleEmit} disabled={emitting || !rawJson.trim()} className="gap-2">
                        {emitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        {emitting ? "Emitindo..." : `Emitir ${LABELS[t]}`}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setRawJson(JSON.stringify(getExamplePayload(t, config.plugnotas_empresa_cnpj), null, 2))}
                      >
                        Carregar exemplo
                      </Button>
                    </div>

                    {lastResult !== null && (
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-muted-foreground">Resposta do PlugNotas</Label>
                        <pre className="text-[11px] bg-muted rounded p-3 overflow-x-auto max-h-64">
                          {JSON.stringify(lastResult, null, 2)}
                        </pre>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            ))}
          </Tabs>
        )}

        {/* Histórico */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold">Histórico de emissões</h2>
              <p className="text-xs text-muted-foreground">Últimas 50 chamadas para qualquer tipo de documento</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => qc.invalidateQueries({ queryKey: ["plugnotas_documents", company?.id] })}
              className="gap-2"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Atualizar
            </Button>
          </div>

          {docsLoading ? (
            <div className="text-sm text-muted-foreground text-center py-8">Carregando...</div>
          ) : documents.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center">
                <FileText className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">Nenhuma emissão registrada ainda.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="bg-card border border-border rounded-lg divide-y divide-border">
              {documents.map((d) => (
                <div key={d.id} className="flex items-center gap-4 px-4 py-3 hover:bg-muted/30 transition-colors">
                  <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{LABELS[d.doc_type]}</span>
                      <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${statusColors[d.status] ?? ""}`}>
                        {d.status}
                      </Badge>
                      {d.numero && <span className="text-xs text-muted-foreground">#{d.numero}</span>}
                      {d.chave_acesso && (
                        <code className="text-[10px] text-muted-foreground bg-muted px-1 rounded font-mono truncate max-w-[200px]">
                          {d.chave_acesso}
                        </code>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-0.5">
                      <span>{new Date(d.created_at).toLocaleString("pt-BR")}</span>
                      {d.plugnotas_id && (
                        <code className="font-mono">id: {d.plugnotas_id}</code>
                      )}
                    </div>
                    {d.status_message && (
                      <p className="text-[11px] text-expense mt-1 line-clamp-2">{d.status_message}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {d.plugnotas_id && (
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Consultar status"
                        onClick={() => handleRefreshDoc(d)}
                        className="h-8 w-8"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {d.pdf_url && (
                      <a href={d.pdf_url} target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost" size="icon" title="PDF" className="h-8 w-8">
                          <FileText className="h-3.5 w-3.5" />
                        </Button>
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

// Exemplos minimalistas — servem só pra documentar formato.
// Schema completo: https://plugnotas.com.br/docs/
function getExamplePayload(t: DocType, cnpj: string | null) {
  const cpfCnpj = cnpj?.replace(/\D/g, "") ?? "00000000000000";
  switch (t) {
    case "nfse":
      return {
        idIntegracao: `nfse-${Date.now()}`,
        prestador: { cpfCnpj },
        tomador: { cpfCnpj: "00000000000000", razaoSocial: "Cliente" },
        servico: {
          codigoTributacaoMunicipio: "010101",
          discriminacao: "Serviço prestado",
          cnae: "6201500",
          itemListaServico: "1.01",
          valor: { servico: 100.0 },
        },
      };
    case "nfe":
      return {
        idIntegracao: `nfe-${Date.now()}`,
        emitente: { cpfCnpj },
        destinatario: { cpfCnpj: "00000000000000", razaoSocial: "Cliente" },
        itens: [{ codigo: "001", descricao: "Produto", quantidade: 1, valorUnitario: 100 }],
      };
    case "nfce":
      return {
        idIntegracao: `nfce-${Date.now()}`,
        emitente: { cpfCnpj },
        itens: [{ codigo: "001", descricao: "Produto", quantidade: 1, valorUnitario: 100 }],
        pagamento: { formaPagamento: "01", valor: 100 },
      };
    case "cte":
      return {
        idIntegracao: `cte-${Date.now()}`,
        emitente: { cpfCnpj },
        tomador: { cpfCnpj: "00000000000000" },
        prestacao: { valor: 100 },
      };
    case "mdfe":
      return {
        idIntegracao: `mdfe-${Date.now()}`,
        emitente: { cpfCnpj },
        carga: { valor: 1000 },
        documentos: [{ chave: "00000000000000000000000000000000000000000000" }],
      };
  }
}
