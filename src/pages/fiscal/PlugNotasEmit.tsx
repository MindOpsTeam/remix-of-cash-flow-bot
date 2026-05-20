import { useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft, Send, Loader2, History, RefreshCw, FileText, FileDown, XCircle, FileWarning,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useCompany } from "@/hooks/useCompany";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";

type DocType = "nfe" | "nfse" | "nfce" | "cte" | "mdfe";

const DOC_LABELS: Record<DocType, string> = {
  nfe: "NF-e",
  nfse: "NFS-e",
  nfce: "NFC-e",
  cte: "CT-e",
  mdfe: "MDF-e",
};

const FN_NAME: Record<DocType, string> = {
  nfe: "plugnotas-nfe",
  nfse: "plugnotas-nfse",
  nfce: "plugnotas-nfce",
  cte: "plugnotas-cte",
  mdfe: "plugnotas-mdfe",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  autorizado: "default",
  enviado: "secondary",
  processando: "secondary",
  cancelado: "outline",
  rejeitado: "destructive",
  erro: "destructive",
};

export default function PlugNotasEmitPage() {
  const { company } = useCompany();

  const { data: cfg, isLoading: cfgLoading } = useQuery({
    queryKey: ["plugnotas_config", company?.id],
    enabled: !!company,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("plugnotas_config")
        .select("*")
        .eq("company_id", company!.id)
        .maybeSingle();
      return data;
    },
  });

  const enabledTabs = useMemo<DocType[]>(() => {
    if (!cfg) return [];
    const out: DocType[] = [];
    if (cfg.enabled_nfe) out.push("nfe");
    if (cfg.enabled_nfse) out.push("nfse");
    if (cfg.enabled_nfce) out.push("nfce");
    if (cfg.enabled_cte) out.push("cte");
    if (cfg.enabled_mdfe) out.push("mdfe");
    return out;
  }, [cfg]);

  if (!company || cfgLoading) {
    return (
      <AppLayout>
        <div className="space-y-4 max-w-4xl">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-96 w-full" />
        </div>
      </AppLayout>
    );
  }

  if (!cfg || !cfg.api_key) {
    return (
      <AppLayout>
        <div className="max-w-3xl space-y-4 animate-fade-in">
          <Header />
          <Card>
            <CardContent className="py-12 text-center space-y-3">
              <FileWarning className="h-10 w-10 text-muted-foreground mx-auto" />
              <p className="text-sm text-muted-foreground">
                PlugNotas ainda não configurado.
              </p>
              <Link to="/fiscal/plugnotas/config">
                <Button>Configurar agora</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  if (enabledTabs.length === 0) {
    return (
      <AppLayout>
        <div className="max-w-3xl space-y-4 animate-fade-in">
          <Header />
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-sm text-muted-foreground">
                Nenhum tipo de documento habilitado. Ative ao menos um em{" "}
                <Link className="text-primary underline" to="/fiscal/plugnotas/config">configurações</Link>.
              </p>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in max-w-5xl">
        <Header />
        <Tabs defaultValue={enabledTabs[0]}>
          <TabsList>
            {enabledTabs.map((t) => (
              <TabsTrigger key={t} value={t}>{DOC_LABELS[t]}</TabsTrigger>
            ))}
          </TabsList>
          {enabledTabs.map((t) => (
            <TabsContent key={t} value={t} className="space-y-4">
              <EmitForm docType={t} companyId={company.id} serie={cfg.serie_padrao ?? "1"} />
            </TabsContent>
          ))}
        </Tabs>

        <DocumentsHistory companyId={company.id} />
      </div>
    </AppLayout>
  );
}

function Header() {
  return (
    <div className="flex items-center gap-3">
      <Link to="/fiscal">
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <ArrowLeft className="h-4 w-4" />
        </Button>
      </Link>
      <div>
        <h1 className="text-2xl font-bold tracking-[-0.02em]">Emissão PlugNotas</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Emita documentos fiscais via PlugNotas
        </p>
      </div>
    </div>
  );
}

function EmitForm({ docType, companyId, serie }: { docType: DocType; companyId: string; serie: string }) {
  const qc = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [payload, setPayload] = useState<string>(() =>
    JSON.stringify(defaultPayload(docType, serie), null, 2)
  );

  const handleEmit = async () => {
    let parsed: any;
    try {
      parsed = JSON.parse(payload);
    } catch {
      toast.error("JSON inválido");
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke(FN_NAME[docType], {
        body: { company_id: companyId, operation: "emitir", params: parsed },
      });
      if (error) throw error;
      setResult(data);
      if (data?.ok) {
        toast.success(`${DOC_LABELS[docType]} enviada`);
        qc.invalidateQueries({ queryKey: ["plugnotas_documents", companyId] });
      } else {
        toast.error(data?.data?.error?.message ?? "Falha na emissão");
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">
          Emitir {DOC_LABELS[docType]}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label className="text-xs text-muted-foreground">
            Payload (JSON conforme spec PlugNotas)
          </Label>
          <Textarea
            value={payload}
            onChange={(e) => setPayload(e.target.value)}
            rows={16}
            className="font-mono text-xs"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Edite os campos conforme o documento. Campos mínimos pré-preenchidos.
          </p>
        </div>

        {result && (
          <div className={`rounded-md border p-3 text-xs ${result.ok ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-900/10 dark:border-emerald-800" : "bg-red-50 border-red-200 dark:bg-red-900/10 dark:border-red-800"}`}>
            <pre className="whitespace-pre-wrap break-all font-mono">{JSON.stringify(result, null, 2)}</pre>
          </div>
        )}

        <div className="flex justify-end">
          <Button onClick={handleEmit} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            Emitir
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function defaultPayload(docType: DocType, serie: string) {
  switch (docType) {
    case "nfse":
      return {
        idIntegracao: `nfse-${Date.now()}`,
        serie,
        tomador: { cpfCnpj: "", razaoSocial: "", email: "" },
        servico: { codigo: "", discriminacao: "", valor: 0 },
      };
    case "nfe":
      return {
        idIntegracao: `nfe-${Date.now()}`,
        serie,
        natureza: "Venda",
        destinatario: { cpfCnpj: "", nome: "" },
        itens: [{ codigo: "", descricao: "", quantidade: 1, valor: 0, ncm: "" }],
      };
    case "nfce":
      return {
        idIntegracao: `nfce-${Date.now()}`,
        serie,
        consumidor: { cpfCnpj: "" },
        itens: [{ codigo: "", descricao: "", quantidade: 1, valor: 0, ncm: "" }],
        pagamento: { formas: [{ tipo: "01", valor: 0 }] },
      };
    case "cte":
      return {
        idIntegracao: `cte-${Date.now()}`,
        serie,
        remetente: { cpfCnpj: "", nome: "" },
        destinatario: { cpfCnpj: "", nome: "" },
        servico: { valor: 0 },
      };
    case "mdfe":
      return {
        idIntegracao: `mdfe-${Date.now()}`,
        serie,
        modal: "rodoviario",
        veiculo: { placa: "", uf: "" },
        documentos: [],
      };
  }
}

function DocumentsHistory({ companyId }: { companyId: string }) {
  const qc = useQueryClient();
  const [docType, setDocType] = useState<DocType | "all">("all");
  const [status, setStatus] = useState<string>("all");

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["plugnotas_documents", companyId, docType, status],
    queryFn: async () => {
      let q = (supabase as any)
        .from("plugnotas_documents")
        .select("*")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (docType !== "all") q = q.eq("doc_type", docType);
      if (status !== "all") q = q.eq("status", status);
      const { data } = await q;
      return data ?? [];
    },
  });

  const consultar = async (doc: any) => {
    try {
      const { data } = await supabase.functions.invoke("plugnotas-status", {
        body: {
          company_id: companyId,
          operation: "consultar",
          params: { doc_type: doc.doc_type, plugnotas_id: doc.plugnotas_id },
        },
      });
      if (data?.ok) toast.success("Status atualizado");
      else toast.error(data?.data?.error?.message ?? "Falha");
      qc.invalidateQueries({ queryKey: ["plugnotas_documents", companyId] });
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const cancelar = async (doc: any) => {
    if (!confirm(`Cancelar ${doc.doc_type.toUpperCase()} ${doc.numero ?? doc.plugnotas_id}?`)) return;
    const motivo = prompt("Motivo do cancelamento:") ?? "";
    if (!motivo) return;
    try {
      const { data } = await supabase.functions.invoke(FN_NAME[doc.doc_type as DocType], {
        body: {
          company_id: companyId,
          operation: "cancelar",
          params: { plugnotas_id: doc.plugnotas_id, motivo },
        },
      });
      if (data?.ok) {
        toast.success("Cancelamento enviado");
        qc.invalidateQueries({ queryKey: ["plugnotas_documents", companyId] });
      } else {
        toast.error(data?.data?.error?.message ?? "Falha");
      }
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <History className="h-4 w-4" /> Últimas emissões
        </CardTitle>
        <div className="flex gap-2">
          <Select value={docType} onValueChange={(v: any) => setDocType(v)}>
            <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="nfe">NF-e</SelectItem>
              <SelectItem value="nfse">NFS-e</SelectItem>
              <SelectItem value="nfce">NFC-e</SelectItem>
              <SelectItem value="cte">CT-e</SelectItem>
              <SelectItem value="mdfe">MDF-e</SelectItem>
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              <SelectItem value="enviado">Enviado</SelectItem>
              <SelectItem value="processando">Processando</SelectItem>
              <SelectItem value="autorizado">Autorizado</SelectItem>
              <SelectItem value="rejeitado">Rejeitado</SelectItem>
              <SelectItem value="cancelado">Cancelado</SelectItem>
              <SelectItem value="erro">Erro</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : docs.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
            Nenhum documento emitido ainda
          </div>
        ) : (
          <div className="space-y-2">
            {docs.map((d: any) => (
              <div key={d.id} className="flex items-center gap-3 p-3 rounded-md border bg-card">
                <Badge variant="outline" className="uppercase text-[10px]">{d.doc_type}</Badge>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {d.numero ? `Nº ${d.numero}` : d.plugnotas_id ?? "—"}
                    {d.serie ? ` · Série ${d.serie}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {d.chave_acesso ?? d.status_message ?? new Date(d.created_at).toLocaleString("pt-BR")}
                  </p>
                </div>
                <Badge variant={STATUS_VARIANT[d.status] ?? "secondary"} className="capitalize">
                  {d.status}
                </Badge>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => consultar(d)} title="Consultar status">
                    <RefreshCw className="h-3.5 w-3.5" />
                  </Button>
                  {d.pdf_url && (
                    <a href={d.pdf_url} target="_blank" rel="noreferrer">
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="PDF">
                        <FileDown className="h-3.5 w-3.5" />
                      </Button>
                    </a>
                  )}
                  {d.xml_url && (
                    <a href={d.xml_url} target="_blank" rel="noreferrer">
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="XML">
                        <FileText className="h-3.5 w-3.5" />
                      </Button>
                    </a>
                  )}
                  {d.status === "autorizado" && (
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => cancelar(d)} title="Cancelar">
                      <XCircle className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
