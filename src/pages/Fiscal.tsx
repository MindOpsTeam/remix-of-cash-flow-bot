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
  FileCheck, Search, FileText, Plus, ExternalLink,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useIntegrationsStatus } from "@/hooks/useIntegrationsStatus";
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
  authorized: "bg-success/[0.08] text-success dark:bg-success/[0.08] dark:text-success",
  cancelled: "bg-destructive/[0.08] text-destructive dark:bg-destructive/[0.08] dark:text-destructive",
  denied: "bg-warning/[0.08] text-warning dark:bg-warning/[0.08] dark:text-warning",
};

const EMISSORES = [
  {
    chave: "nfse" as const,
    nome: "NFS-e Nacional",
    descricao: "Padrão da Receita, com certificado A1. Municípios já migrados para o padrão nacional.",
    emitir: "/fiscal/nfse/emit",
    configurar: "/settings/integrations/nfse",
  },
  {
    chave: "plugnotas" as const,
    nome: "PlugNotas",
    descricao: "NF-e, NFS-e, NFC-e, CT-e e MDF-e. Cobre municípios fora do padrão nacional.",
    emitir: "/fiscal/plugnotas/emit",
    configurar: "/settings/integrations/plugnotas",
  },
  {
    chave: "focus" as const,
    nome: "Focus NFe",
    descricao: "Todos os documentos numa API só, com ambiente de teste e busca do tomador por CNPJ.",
    emitir: "/fiscal/focus/emit",
    configurar: "/settings/integrations/focus",
  },
];

export default function FiscalPage() {
  const { company } = useCompany();
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");

  const { data: statusIntegracoes } = useIntegrationsStatus();
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
          <div className="flex items-center gap-2">
            <Link to="/fiscal/nfse/emit">
              <Button>
                <Plus className="h-4 w-4 mr-1.5" /> Emitir nota
              </Button>
            </Link>
          </div>
        </div>

        {/* Emissores: a plataforma tem três caminhos e todos precisam aparecer */}
        <div className="grid gap-3 sm:grid-cols-3">
          {EMISSORES.map((e) => {
            const st = statusIntegracoes?.[e.chave];
            return (
              <Card key={e.chave} className={st?.configurado ? "border-primary/30" : undefined}>
                <CardContent className="py-4 px-4 flex flex-col gap-2 h-full">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{e.nome}</span>
                    {st?.configurado ? (
                      <Badge className="text-[10px] gap-1">
                        {st.detalhe ? `Pronto · ${st.detalhe}` : "Pronto"}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">
                        Não configurado
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground flex-1">{e.descricao}</p>
                  <Link to={st?.configurado ? e.emitir : e.configurar}>
                    <Button size="sm" variant={st?.configurado ? "default" : "outline"} className="w-full">
                      {st?.configurado ? "Emitir" : "Configurar"}
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            );
          })}
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
