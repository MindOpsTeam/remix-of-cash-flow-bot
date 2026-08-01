import { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Cliente360 } from "@/components/contatos/Cliente360";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Users, Plus, Pencil, Trash2, Search, Building2, User } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { toast } from "sonner";
import { useDetalhe } from "@/components/detalhe/DetalheProvider";

interface Contact {
  id: string;
  name: string;
  trade_name: string | null;
  type: string;
  person_type: string;
  document: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  city: string | null;
  state: string | null;
  active: boolean;
  created_at: string;
}

const typeLabels: Record<string, string> = {
  customer: "Cliente",
  supplier: "Fornecedor",
  both: "Cliente / Fornecedor",
};

const typeBadgeColors: Record<string, string> = {
  customer: "bg-primary/[0.08] text-primary dark:bg-primary/[0.08] dark:text-primary",
  supplier: "bg-warning/[0.08] text-warning dark:bg-warning/[0.08] dark:text-warning",
  both: "bg-primary/[0.08] text-primary dark:bg-primary/[0.08] dark:text-primary",
};

function formatDoc(doc: string | null, personType: string) {
  if (!doc) return "";
  const d = doc.replace(/\D/g, "");
  if (personType === "pf" && d.length === 11) {
    return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }
  if (d.length === 14) {
    return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  }
  return doc;
}

function maskCPF(v: string) {
  return v.replace(/\D/g, "").slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

function maskCNPJ(v: string) {
  return v.replace(/\D/g, "").slice(0, 14)
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

function maskPhone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
  return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
}

function maskCEP(v: string) {
  return v.replace(/\D/g, "").slice(0, 8).replace(/(\d{5})(\d)/, "$1-$2");
}

const emptyForm = {
  name: "",
  trade_name: "",
  type: "customer",
  person_type: "pj",
  document: "",
  email: "",
  phone: "",
  whatsapp: "",
  website: "",
  zip_code: "",
  street: "",
  number: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
  default_payment_terms: "",
  credit_limit: "",
  notes: "",
};

export default function ContactsPage() {
  const { abrirDetalhe } = useDetalhe();
  const { company } = useCompany();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const PAGE_SIZE = 50;

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ["contacts", company?.id, page, search, filterType],
    queryFn: async () => {
      if (!company) return [];
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      let query = supabase
        .from("contacts")
        .select("id, name, trade_name, type, person_type, document, email, phone, whatsapp, website, zip_code, street, number, complement, neighborhood, city, state, default_payment_terms, credit_limit, notes, active, created_at, state_registration", { count: "exact" })
        .eq("company_id", company.id)
        .eq("active", true);

      if (filterType !== "all") {
        query = query.in("type", [filterType, "both"]);
      }
      if (search.trim()) {
        const s = search.trim();
        const cleanDigits = s.replace(/\D/g, "");
        query = query.or(`name.ilike.%${s}%,email.ilike.%${s}%${cleanDigits ? `,document.ilike.%${cleanDigits}%` : ""}`);
      }

      const { data, error, count } = await query.order("name").range(from, to);
      if (error) throw error;
      if (count !== null) setTotalCount(count);
      return (data || []) as (Contact & Record<string, any>)[];
    },
    enabled: !!company,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!company) return;
      const payload = {
        company_id: company.id,
        name: form.name.trim(),
        trade_name: form.trade_name.trim() || null,
        type: form.type,
        person_type: form.person_type,
        document: form.document.replace(/\D/g, "") || null,
        email: form.email.trim() || null,
        phone: form.phone.replace(/\D/g, "") || null,
        whatsapp: form.whatsapp.replace(/\D/g, "") || null,
        website: form.website.trim() || null,
        zip_code: form.zip_code.replace(/\D/g, "") || null,
        street: form.street.trim() || null,
        number: form.number.trim() || null,
        complement: form.complement.trim() || null,
        neighborhood: form.neighborhood.trim() || null,
        city: form.city.trim() || null,
        state: form.state.trim() || null,
        default_payment_terms: form.default_payment_terms ? parseInt(form.default_payment_terms) : null,
        credit_limit: form.credit_limit ? parseFloat(form.credit_limit) : null,
        notes: form.notes.trim() || null,
      };
      if (editingId) {
        const { error } = await supabase.from("contacts").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("contacts").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingId ? "Contato atualizado!" : "Contato criado!");
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      setDialogOpen(false);
      resetForm();
    },
    onError: (e: any) => toast.error(e.message || "Erro ao salvar"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contacts").update({ active: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Contato removido!");
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      setDeleteId(null);
    },
    onError: (e: any) => toast.error(e.message || "Erro ao remover"),
  });

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (c: any) => {
    setEditingId(c.id);
    setForm({
      name: c.name,
      trade_name: c.trade_name || "",
      type: c.type,
      person_type: c.person_type,
      document: c.document ? (c.person_type === "pf" ? maskCPF(c.document) : maskCNPJ(c.document)) : "",
      email: c.email || "",
      phone: c.phone ? maskPhone(c.phone) : "",
      whatsapp: c.whatsapp ? maskPhone(c.whatsapp) : "",
      website: c.website || "",
      zip_code: c.zip_code ? maskCEP(c.zip_code) : "",
      street: c.street || "",
      number: c.number || "",
      complement: c.complement || "",
      neighborhood: c.neighborhood || "",
      city: c.city || "",
      state: c.state || "",
      default_payment_terms: c.default_payment_terms != null ? String(c.default_payment_terms) : "",
      credit_limit: c.credit_limit != null ? String(c.credit_limit) : "",
      notes: c.notes || "",
    });
    setDialogOpen(true);
  };

  // Filtering is now done server-side in the query
  const filtered = contacts;

  // Reset page when filters change
  useEffect(() => { setPage(0); }, [search, filterType]);

  const set = (key: string, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-[-0.02em] flex items-center gap-2">
              <Users className="h-6 w-6" /> Clientes & Fornecedores
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Cadastro unificado de clientes e fornecedores
            </p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1.5" /> Novo Contato
          </Button>
        </div>

        {/* Filters */}
        <div className="flex gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por nome, CNPJ ou email..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="customer">Clientes</SelectItem>
              <SelectItem value="supplier">Fornecedores</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="text-sm text-muted-foreground text-center py-12">Carregando...</div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Users className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">
                {contacts.length === 0 ? "Nenhum contato cadastrado ainda." : "Nenhum resultado para esta busca."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="bg-card border border-border rounded-lg divide-y divide-border">
            {filtered.map((c) => (
              <div key={c.id} role="button" tabIndex={0} aria-label="Abrir detalhes do registro"
                onClick={(e) => { const alvo=(e.target as HTMLElement).closest("button,a,input,[role='button']"); if (!alvo || alvo===e.currentTarget) abrirDetalhe({ tipo: "contact", id: c.id }); }}
                onKeyDown={(e) => { if (e.key!=="Enter"&&e.key!==" ") return; const alvo=(e.target as HTMLElement).closest("button,a,input,[role='button']"); if (alvo && alvo!==e.currentTarget) return; e.preventDefault(); abrirDetalhe({ tipo: "contact", id: c.id }); }}
                className="flex cursor-pointer items-center gap-4 px-4 py-3 transition-colors hover:bg-muted/30 focus:outline-none focus-visible:bg-muted/40 focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-primary/40">
                <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                  {c.person_type === "pf" ? <User className="h-4 w-4 text-muted-foreground" /> : <Building2 className="h-4 w-4 text-muted-foreground" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">{c.name}</p>
                    <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${typeBadgeColors[c.type]}`}>
                      {typeLabels[c.type]}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                    {c.document && <span>{formatDoc(c.document, c.person_type)}</span>}
                    {c.email && <span>{c.email}</span>}
                    {c.phone && <span>{c.phone}</span>}
                    {c.city && c.state && <span>{c.city}/{c.state}</span>}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteId(c.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalCount > PAGE_SIZE && (
          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-muted-foreground">
              {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalCount)} de {totalCount}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
              <Button variant="outline" size="sm" disabled={(page + 1) * PAGE_SIZE >= totalCount} onClick={() => setPage((p) => p + 1)}>Próximo</Button>
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground">{filtered.length} contato{filtered.length !== 1 ? "s" : ""} nesta página</p>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setDialogOpen(open); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Contato" : "Novo Contato"}</DialogTitle>
          </DialogHeader>

          {/* Histórico primeiro: quem abre um cliente já cadastrado quase sempre
              quer saber como ele paga, não trocar o CEP. */}
          {editingId && (
            <div className="rounded-lg border border-border bg-muted/20 p-3">
              <Cliente360 contactId={editingId} />
            </div>
          )}

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Tipo</Label>
                <Select value={form.type} onValueChange={(v) => set("type", v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="customer">Cliente</SelectItem>
                    <SelectItem value="supplier">Fornecedor</SelectItem>
                    <SelectItem value="both">Ambos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Pessoa</Label>
                <Select value={form.person_type} onValueChange={(v) => set("person_type", v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pj">Jurídica (CNPJ)</SelectItem>
                    <SelectItem value="pf">Física (CPF)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs">Razão Social / Nome *</Label>
              <Input className="mt-1" value={form.name} onChange={(e) => set("name", e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Nome Fantasia</Label>
              <Input className="mt-1" value={form.trade_name} onChange={(e) => set("trade_name", e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">{form.person_type === "pf" ? "CPF" : "CNPJ"}</Label>
              <Input className="mt-1 font-mono" value={form.document} onChange={(e) => set("document", form.person_type === "pf" ? maskCPF(e.target.value) : maskCNPJ(e.target.value))} placeholder={form.person_type === "pf" ? "000.000.000-00" : "00.000.000/0000-00"} inputMode="numeric" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">E-mail</Label>
                <Input className="mt-1" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Telefone</Label>
                <Input className="mt-1" value={form.phone} onChange={(e) => set("phone", maskPhone(e.target.value))} placeholder="(00) 00000-0000" inputMode="numeric" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">WhatsApp</Label>
                <Input className="mt-1" value={form.whatsapp} onChange={(e) => set("whatsapp", maskPhone(e.target.value))} placeholder="(00) 00000-0000" inputMode="numeric" />
              </div>
              <div>
                <Label className="text-xs">Website</Label>
                <Input className="mt-1" value={form.website} onChange={(e) => set("website", e.target.value)} />
              </div>
            </div>

            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider pt-2">Endereço</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">CEP</Label>
                <Input className="mt-1" value={form.zip_code} onChange={(e) => set("zip_code", maskCEP(e.target.value))} placeholder="00000-000" inputMode="numeric" />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Rua</Label>
                <Input className="mt-1" value={form.street} onChange={(e) => set("street", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-4 gap-3">
              <div>
                <Label className="text-xs">Número</Label>
                <Input className="mt-1" value={form.number} onChange={(e) => set("number", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Complemento</Label>
                <Input className="mt-1" value={form.complement} onChange={(e) => set("complement", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Cidade</Label>
                <Input className="mt-1" value={form.city} onChange={(e) => set("city", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">UF</Label>
                <Input className="mt-1" maxLength={2} value={form.state} onChange={(e) => set("state", e.target.value.toUpperCase())} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!form.name.trim() || saveMutation.isPending}>
              {saveMutation.isPending ? "Salvando..." : editingId ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover contato?</AlertDialogTitle>
            <AlertDialogDescription>O contato será desativado e não aparecerá mais na lista.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
