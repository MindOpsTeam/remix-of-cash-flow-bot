import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  FileCheck, Search, FileText, Download, Plus,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";

interface Invoice {
  id: string;
  type: string;
  status: string;
  number: string | null;
  issue_date: string;
  total: number;
  contact: { name: string } | null;
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
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["invoices", company?.id],
    queryFn: async () => {
      if (!company) return [];
      const { data, error } = await supabase
        .from("invoices")
        .select("id, type, status, number, issue_date, total, contact_id, contacts(name)")
        .eq("company_id", company.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map((i: any) => ({ ...i, contact: i.contacts })) as Invoice[];
    },
    enabled: !!company,
  });

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
          <Button>
            <Plus className="h-4 w-4 mr-1.5" /> Emitir NF-e
          </Button>
        </div>

        {/* Info Banner */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="py-4 px-5">
            <div className="flex items-start gap-3">
              <FileCheck className="h-5 w-5 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">Módulo Fiscal</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Emissão de NFS-e integrada ao padrão nacional (ADN). Registre e gerencie notas fiscais, exporte dados para o contador.
                </p>
              </div>
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
            <Input placeholder="Buscar por nº ou destinatário..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {Object.entries(typeLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm">
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
                    </p>
                    <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${statusColors[inv.status]}`}>
                      {statusLabels[inv.status]}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                    <span>{inv.contact?.name || "—"}</span>
                    <span>{new Date(inv.issue_date + "T00:00:00").toLocaleDateString("pt-BR")}</span>
                  </div>
                </div>
                <p className="text-sm font-semibold font-mono">{fmt(Number(inv.total))}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
