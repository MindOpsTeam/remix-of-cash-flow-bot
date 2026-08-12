import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileDown, Loader2, X, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { formatCurrency } from "@/lib/utils";
import { mensagemDeErro } from "@/lib/erros";

interface InboundDoc {
  id: string;
  tipo: string;
  numero: string | null;
  emitente_cnpj: string | null;
  emitente_nome: string | null;
  valor_total: number;
  data_emissao: string | null;
  status: string;
}

/**
 * Notas fiscais de ENTRADA (emitidas contra o CNPJ) pendentes de lançamento.
 * Busca as destinadas na Focus (distribuição DF-e) e transforma cada uma em
 * conta a pagar. Edge inbound-documents (sync_nfe / to_bill / ignore).
 */
export function NotasRecebidas() {
  const { company } = useCompany();
  const qc = useQueryClient();
  const [sincronizando, setSincronizando] = useState(false);
  const [agindo, setAgindo] = useState<string | null>(null);

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["inbound-documents", company?.id],
    enabled: !!company,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("inbound_documents")
        .select("id, tipo, numero, emitente_cnpj, emitente_nome, valor_total, data_emissao, status")
        .eq("company_id", company!.id)
        .eq("status", "pendente")
        .order("data_emissao", { ascending: false });
      return (data ?? []) as InboundDoc[];
    },
  });

  const sincronizar = async () => {
    if (!company) return;
    setSincronizando(true);
    try {
      const { data, error } = await supabase.functions.invoke("inbound-documents", {
        body: { action: "sync_nfe", companyId: company.id },
      });
      if (error) throw error;
      if (data?.ok) {
        toast.success(`${data.novas ?? 0} nota(s) nova(s) de ${data.recebidas ?? 0} recebida(s).`);
        qc.invalidateQueries({ queryKey: ["inbound-documents", company.id] });
      } else {
        toast.error(data?.error ?? "Não consegui buscar as notas.");
      }
    } catch (e) {
      toast.error("Falha ao buscar: " + mensagemDeErro(e));
    } finally {
      setSincronizando(false);
    }
  };

  const lancar = async (doc: InboundDoc) => {
    if (!company) return;
    setAgindo(doc.id);
    try {
      const { data, error } = await supabase.functions.invoke("inbound-documents", {
        body: { action: "to_bill", companyId: company.id, inbound_document_id: doc.id },
      });
      if (error) throw error;
      if (data?.ok) {
        toast.success("Conta a pagar criada a partir da nota.");
        qc.invalidateQueries({ queryKey: ["inbound-documents", company.id] });
        qc.invalidateQueries({ queryKey: ["bills-payable"] });
      } else {
        toast.error(data?.error ?? "Não consegui lançar.");
      }
    } catch (e) {
      toast.error("Falha ao lançar: " + mensagemDeErro(e));
    } finally {
      setAgindo(null);
    }
  };

  const ignorar = async (doc: InboundDoc) => {
    if (!company) return;
    setAgindo(doc.id);
    try {
      await supabase.functions.invoke("inbound-documents", {
        body: { action: "ignore", companyId: company.id, inbound_document_id: doc.id },
      });
      qc.invalidateQueries({ queryKey: ["inbound-documents", company.id] });
    } finally {
      setAgindo(null);
    }
  };

  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Inbox className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Notas recebidas (entrada)</h2>
          {docs.length > 0 && <Badge variant="secondary" className="text-[10px]">{docs.length}</Badge>}
        </div>
        <Button size="sm" variant="outline" onClick={sincronizar} disabled={sincronizando} className="gap-2">
          {sincronizando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          Buscar notas contra meu CNPJ
        </Button>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Notas fiscais que fornecedores emitiram contra a sua empresa (distribuição DF-e). Lance cada
        uma como conta a pagar para conciliar as compras.
      </p>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : docs.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted-foreground">
          Nenhuma nota pendente. Clique em "Buscar notas contra meu CNPJ" para consultar as destinadas.
        </p>
      ) : (
        <div className="space-y-2">
          {docs.map((doc) => (
            <div key={doc.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {doc.emitente_nome ?? doc.emitente_cnpj ?? "Fornecedor"} · {formatCurrency(doc.valor_total)}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {String(doc.tipo).toUpperCase()} nº {doc.numero ?? "?"}
                  {doc.data_emissao && ` · ${new Date(doc.data_emissao).toLocaleDateString("pt-BR")}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={() => lancar(doc)} disabled={agindo === doc.id} className="gap-1.5">
                  {agindo === doc.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
                  Lançar conta a pagar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => ignorar(doc)} disabled={agindo === doc.id} className="gap-1.5 text-muted-foreground">
                  <X className="h-3.5 w-3.5" /> Ignorar
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
