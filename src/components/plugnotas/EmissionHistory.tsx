/**
 * Histórico de emissões PlugNotas — lê plugnotas_documents.
 * Suporta filtro por tipo, refresh por linha (chama plugnotas-status/consultar)
 * e ação de cancelamento.
 */

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  FileText, RefreshCw, XCircle, Download, ExternalLink, Loader2,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { DOC_LABEL, DOC_FUNCTION, extractErrorMessage, type PlugnotasDocType } from "@/lib/plugnotas";
import { toast } from "sonner";

interface PlugnotasDocument {
  id: string;
  doc_type: PlugnotasDocType;
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
  enviado: "bg-primary/[0.08] text-primary dark:bg-primary/[0.08] dark:text-primary",
  processando: "bg-warning/[0.08] text-warning dark:bg-warning/[0.08] dark:text-warning",
  autorizado: "bg-success/[0.08] text-success dark:bg-success/[0.08] dark:text-success",
  cancelado: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
  rejeitado: "bg-destructive/[0.08] text-destructive dark:bg-destructive/[0.08] dark:text-destructive",
  erro: "bg-destructive/[0.08] text-destructive dark:bg-destructive/[0.08] dark:text-destructive",
};

export function EmissionHistory() {
  const { company } = useCompany();
  const qc = useQueryClient();
  const [filterType, setFilterType] = useState<"all" | PlugnotasDocType>("all");
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [cancelDocId, setCancelDocId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelBusy, setCancelBusy] = useState(false);

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ["plugnotas_documents", company?.id],
    enabled: !!company,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("plugnotas_documents")
        .select("*")
        .eq("company_id", company!.id)
        .order("created_at", { ascending: false })
        .limit(100);
      return (data || []) as PlugnotasDocument[];
    },
  });

  const filtered = filterType === "all"
    ? documents
    : documents.filter((d) => d.doc_type === filterType);

  const handleRefresh = async (doc: PlugnotasDocument) => {
    if (!company || !doc.plugnotas_id) {
      toast.error("Documento sem ID PlugNotas");
      return;
    }
    setRefreshingId(doc.id);
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
      } else {
        toast.error(extractErrorMessage(data?.data));
      }
      qc.invalidateQueries({ queryKey: ["plugnotas_documents", company.id] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setRefreshingId(null);
    }
  };

  const handleCancel = async () => {
    if (!company || !cancelDocId) return;
    const doc = documents.find((d) => d.id === cancelDocId);
    if (!doc || !doc.plugnotas_id) return;
    if (!cancelReason || cancelReason.length < 15) {
      toast.error("Justificativa deve ter pelo menos 15 caracteres");
      return;
    }
    setCancelBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke(DOC_FUNCTION[doc.doc_type], {
        body: {
          company_id: company.id,
          operation: "cancelar",
          params: { id: doc.plugnotas_id, justificativa: cancelReason, motivo: cancelReason },
        },
      });
      if (error) throw new Error(error.message);
      if (data?.ok) {
        toast.success("Cancelamento solicitado");
        setCancelDocId(null);
        setCancelReason("");
        qc.invalidateQueries({ queryKey: ["plugnotas_documents", company.id] });
      } else {
        toast.error(extractErrorMessage(data?.data));
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setCancelBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-base font-semibold">Histórico de emissões</h2>
          <p className="text-xs text-muted-foreground">Documentos enviados via PlugNotas</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filterType} onValueChange={(v) => setFilterType(v as typeof filterType)}>
            <SelectTrigger className="w-36 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              {(Object.keys(DOC_LABEL) as PlugnotasDocType[]).map((t) => (
                <SelectItem key={t} value={t}>{DOC_LABEL[t]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline" size="sm"
            onClick={() => qc.invalidateQueries({ queryKey: ["plugnotas_documents", company?.id] })}
            className="gap-2"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Atualizar
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground text-center py-8">Carregando...</div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <FileText className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">Nenhuma emissão registrada.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="bg-card border border-border rounded-lg divide-y divide-border">
          {filtered.map((d) => (
            <div key={d.id} className="flex items-center gap-4 px-4 py-3 hover:bg-muted/30 transition-colors">
              <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                <FileText className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium">{DOC_LABEL[d.doc_type]}</span>
                  <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${statusColors[d.status] ?? ""}`}>
                    {d.status}
                  </Badge>
                  {d.numero && <span className="text-xs text-muted-foreground">#{d.numero}</span>}
                  {d.chave_acesso && (
                    <code className="text-[10px] text-muted-foreground bg-muted px-1 rounded font-mono truncate max-w-[260px]">
                      {d.chave_acesso}
                    </code>
                  )}
                </div>
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-0.5">
                  <span>{new Date(d.created_at).toLocaleString("pt-BR")}</span>
                  {d.plugnotas_id && <code className="font-mono">id: {d.plugnotas_id.slice(0, 24)}{d.plugnotas_id.length > 24 ? "..." : ""}</code>}
                </div>
                {d.status_message && d.status === "rejeitado" && (
                  <p className="text-[11px] text-expense mt-1 line-clamp-2">{d.status_message}</p>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {d.plugnotas_id && d.status !== "cancelado" && (
                  <Button
                    variant="ghost" size="icon"
                    title="Consultar status atual"
                    onClick={() => handleRefresh(d)}
                    disabled={refreshingId === d.id}
                    className="h-8 w-8"
                  >
                    {refreshingId === d.id
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <RefreshCw className="h-3.5 w-3.5" />}
                  </Button>
                )}
                {d.pdf_url && (
                  <a href={d.pdf_url} target="_blank" rel="noopener noreferrer" title="PDF da nota">
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  </a>
                )}
                {d.xml_url && (
                  <a href={d.xml_url} target="_blank" rel="noopener noreferrer" title="XML da nota">
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                  </a>
                )}
                {d.status === "autorizado" && d.plugnotas_id && (
                  <AlertDialog
                    open={cancelDocId === d.id}
                    onOpenChange={(open) => {
                      if (!open) { setCancelDocId(null); setCancelReason(""); }
                    }}
                  >
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost" size="icon" title="Cancelar nota"
                        onClick={() => setCancelDocId(d.id)}
                        className="h-8 w-8"
                      >
                        <XCircle className="h-3.5 w-3.5 text-expense" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Cancelar {DOC_LABEL[d.doc_type]}</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta operação é irreversível. A nota será cancelada na SEFAZ via PlugNotas.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Justificativa (mín. 15 caracteres) *</Label>
                        <Input
                          value={cancelReason}
                          onChange={(e) => setCancelReason(e.target.value)}
                          placeholder="Motivo do cancelamento"
                        />
                      </div>
                      <AlertDialogFooter>
                        <AlertDialogCancel disabled={cancelBusy}>Voltar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleCancel} disabled={cancelBusy}>
                          {cancelBusy && <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />}
                          Confirmar cancelamento
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
