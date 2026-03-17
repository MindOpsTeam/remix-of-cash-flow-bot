import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  FileCheck, Search, FileText, Download, Plus, ExternalLink,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { Link } from "react-router-dom";
import { toast } from "sonner";

interface Invoice {
  id: string;
  type: string;
  status: string;
  number: string | null;
  series: string | null;
  issue_date: string;
  total: number;
  notes: string | null;
  contact: { name: string } | null;
}

interface Contact {
  id: string;
  name: string;
}

function fmt(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

const typeLabels: Record<string, string> = { nfe: "NF-e", nfse: "NFS-e", nfce: "NFC-e" };

const statusLabels: Record<string, string> = {
  draft: "Rascunho",
  authorized: "Autorizada",
  cancelled: "Cancelada",
  denied: "Rejeitada",
};

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
  authorized: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  denied: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
};

export default function FiscalPage() {
  const { company } = useCompany();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);

  // NFS-e form state
  const [contactId, setContactId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [series, setSeries] = useState("");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split("T")[0]);
  const [total, setTotal] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("draft");

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["invoices", company?.id],
    queryFn: async () => {
      if (!company) return [];
      const { data, error } = await supabase
        .from("invoices")
        .select("id, type, status, number, series, issue_date, total, notes, contact_id, contacts(name)")
        .eq("company_id", company.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map((i: any) => ({ ...i, contact: i.contacts })) as Invoice[];
    },
    enabled: !!company,
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ["contacts_fiscal", company?.id],
    queryFn: async () => {
      if (!company) return [];
      const { data } = await supabase
        .from("contacts")
        .select("id, name")
        .eq("company_id", company.id)
        .eq("active", true)
        .in("type", ["customer", "both"])
        .order("name");
      return (data || []) as Contact[];
    },
    enabled: !!company,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!company) return;
      const { error } = await supabase.from("invoices").insert({
        company_id: company.id,
        contact_id: contactId || null,
        type: "nfse",
        status,
        number: invoiceNumber.trim() || null,
        series: series.trim() || null,
        issue_date: issueDate,
        total: parseFloat(total) || 0,
        notes: notes.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("NFS-e registrada!");
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      setDialogOpen(false);
      resetForm();
    },
    onError: (e: any) => toast.error(e.message || "Erro ao salvar"),
  });

  const resetForm = () => {
    setContactId("");
    setInvoiceNumber("");
    setSeries("");
    setIssueDate(new Date().toISOString().split("T")[0]);
    setTotal("");
    setNotes("");
    setStatus("draft");
  };

  const handleExportCSV = () => {
    const rows = [
      ["Tipo", "Número", "Série", "Status", "Tomador", "Data", "Valor"],
      ...invoices.map((i) => [
        typeLabels[i.type] || i.type,
        i.number || "",
        i.series || "",
        statusLabels[i.status] || i.status,
        i.contact?.name || "",
        new Date(i.issue_date + "T00:00:00").toLocaleDateString("pt-BR"),
        Number(i.total).toFixed(2).replace(".", ","),
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "notas-fiscais.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const filtered = invoices.filter((i) => {
    const matchSearch = !search ||
      (i.number && i.number.includes(search)) ||
      (i.contact?.name || "").toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === "all" || i.type === filterType;
    return matchSearch && matchType;
  });

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-[-0.02em] flex items-center gap-2">
              <FileCheck className="h-6 w-6" /> Fiscal
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Notas fiscais emitidas e recebidas</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" disabled>
              <Plus className="h-4 w-4 mr-1.5" /> Emitir NF-e
              <Badge variant="secondary" className="ml-2 text-[10px]">Em breve</Badge>
            </Button>
            <Button onClick={() => { resetForm(); setDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-1.5" /> Registrar NFS-e
            </Button>
          </div>
        </div>

        {/* Info Banner */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="py-4 px-5">
            <div className="flex items-start gap-3">
              <FileCheck className="h-5 w-5 text-primary mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">Módulo Fiscal</p>
                <p className="text-xs text-muted-foreground mt-1">
                  <strong>NFS-e:</strong> configure o certificado A1 para emissão direta via NFS-e Nacional (Receita Federal).
                  Registre manualmente para controle ou exporte para o contador.
                  <strong> NF-e/NFC-e</strong>: integração via parceiro fiscal em breve.
                </p>
              </div>
              <Link to="/settings/integrations/nfse">
                <Button variant="outline" size="sm" className="shrink-0">
                  <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Configurar NFS-e
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {(["nfe", "nfse", "nfce"] as const).map((t) => {
            const count = invoices.filter((i) => i.type === t && i.status === "authorized").length;
            const total = invoices.filter((i) => i.type === t && i.status === "authorized").reduce((s, i) => s + Number(i.total), 0);
            return (
              <Card key={t}>
                <CardContent className="py-3 px-4">
                  <p className="text-xs text-muted-foreground">{typeLabels[t]} Autorizadas</p>
                  <p className="text-lg font-bold">{count}</p>
                  <p className="text-xs text-muted-foreground font-mono">{fmt(total)}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Filters */}
        <div className="flex gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por nº ou tomador..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {Object.entries(typeLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={invoices.length === 0}>
            <Download className="h-3.5 w-3.5 mr-1.5" /> Exportar CSV
          </Button>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="text-sm text-muted-foreground text-center py-12">Carregando...</div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileCheck className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">Nenhuma nota fiscal registrada.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="bg-card border border-border rounded-lg divide-y divide-border">
            {filtered.map((inv) => (
              <div key={inv.id} className="flex items-center gap-4 px-4 py-3 hover:bg-muted/30 transition-colors">
                <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">
                      {typeLabels[inv.type]} {inv.number ? `#${inv.number}` : "(sem número)"}
                      {inv.series && <span className="text-muted-foreground text-xs ml-1">Série {inv.series}</span>}
                    </p>
                    <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${statusColors[inv.status]}`}>
                      {statusLabels[inv.status]}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                    <span>{inv.contact?.name || "—"}</span>
                    <span>{new Date(inv.issue_date + "T00:00:00").toLocaleDateString("pt-BR")}</span>
                    {inv.notes && <span className="truncate max-w-[200px]">{inv.notes}</span>}
                  </div>
                </div>
                <p className="text-sm font-semibold font-mono">{fmt(Number(inv.total))}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* NFS-e Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setDialogOpen(open); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar NFS-e</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Tomador (cliente)</Label>
              <Select value={contactId} onValueChange={setContactId}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {contacts.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Label className="text-xs">Número da nota</Label>
                <Input className="mt-1 font-mono" placeholder="001" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Série</Label>
                <Input className="mt-1 font-mono" placeholder="A" value={series} onChange={(e) => setSeries(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Data de emissão</Label>
                <Input type="date" className="mt-1" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(statusLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs">Valor total (R$)</Label>
              <Input className="mt-1 font-mono" type="number" placeholder="0.00" value={total} onChange={(e) => setTotal(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Descrição do serviço</Label>
              <Textarea className="mt-1" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!total || saveMutation.isPending}>
              {saveMutation.isPending ? "Salvando..." : "Registrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
