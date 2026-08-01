import { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import { Package, Plus, Pencil, Trash2, Search, Wrench, Box } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { toast } from "sonner";
import { ProntoParaAgosto } from "@/components/produtos/ProntoParaAgosto";
import { useDetalhe } from "@/components/detalhe/DetalheProvider";

interface Product {
  id: string;
  name: string;
  description: string | null;
  type: string;
  sku: string | null;
  unit: string;
  sell_price: number;
  cost_price: number | null;
  track_stock: boolean;
  current_stock: number | null;
  min_stock: number | null;
  category: string | null;
  active: boolean;
}

function fmt(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

const unitLabels: Record<string, string> = {
  un: "Unidade",
  kg: "Quilograma",
  lt: "Litro",
  hr: "Hora",
  m: "Metro",
  m2: "Metro²",
  cx: "Caixa",
  pct: "Pacote",
};

const emptyForm = {
  name: "",
  description: "",
  type: "product",
  sku: "",
  barcode: "",
  unit: "un",
  sell_price: "",
  cost_price: "",
  ncm: "",
  cclasstrib: "",
  cfop: "",
  tax_origin: "",
  account_id: "",
  track_stock: false,
  min_stock: "",
  category: "",
};

export default function ProductsPage() {
  const { abrirDetalhe } = useDetalhe();
  const { company } = useCompany();
  const queryClient = useQueryClient();

  // Só contas de receita: produto vendido cai em receita, e oferecer o plano de
  // contas inteiro aqui é convite para classificar venda como despesa.
  const { data: contasReceita = [] } = useQuery({
    queryKey: ["contas_receita", company?.id],
    enabled: !!company,
    queryFn: async () => {
      const { data } = await supabase
        .from("chart_of_accounts")
        .select("id, code, name")
        .eq("company_id", company!.id)
        .eq("type", "revenue")
        .order("code");
      return data ?? [];
    },
  });
  const [search, setSearch] = useState("");
  // ?type=service permite ao sidebar oferecer a visão "Serviços" direto.
  const [filterType, setFilterType] = useState(() => {
    if (typeof window === "undefined") return "all";
    const tipo = new URLSearchParams(window.location.search).get("type");
    return tipo === "service" || tipo === "product" ? tipo : "all";
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const PAGE_SIZE = 50;

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products", company?.id, page, search, filterType],
    queryFn: async () => {
      if (!company) return [];
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      let query = supabase
        .from("products")
        .select("id, name, description, type, sku, barcode, ncm, cclasstrib, cfop, tax_origin, account_id, unit, sell_price, cost_price, track_stock, current_stock, min_stock, category, active", { count: "exact" })
        .eq("company_id", company.id)
        .eq("active", true);

      if (filterType !== "all") {
        query = query.eq("type", filterType);
      }
      if (search.trim()) {
        const s = search.trim();
        query = query.or(`name.ilike.%${s}%,sku.ilike.%${s}%`);
      }

      const { data, error, count } = await query.order("name").range(from, to);
      if (error) throw error;
      if (count !== null) setTotalCount(count);
      return (data || []) as (Product & Record<string, any>)[];
    },
    enabled: !!company,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!company) return;
      const payload = {
        company_id: company.id,
        name: form.name.trim(),
        description: form.description.trim() || null,
        type: form.type,
        sku: form.sku.trim() || null,
        barcode: form.barcode.trim() || null,
        unit: form.unit,
        sell_price: parseFloat(form.sell_price.replace(/\./g, "").replace(",", ".")) || 0,
        cost_price: form.cost_price ? parseFloat(form.cost_price.replace(/\./g, "").replace(",", ".")) : null,
        ncm: form.ncm.trim() || null,
        cclasstrib: form.cclasstrib.trim() || null,
        cfop: form.cfop.trim() || null,
        tax_origin: form.tax_origin.trim() || null,
        // A conta contábil do produto existia no banco desde sempre e a tela
        // nunca a expôs: 22 de 22 produtos estavam sem ela. É o que faz a venda
        // nascer classificada em vez de cair no balaio "a classificar" do DRE.
        account_id: form.account_id || null,
        track_stock: form.track_stock,
        min_stock: form.min_stock ? parseFloat(form.min_stock) : 0,
        category: form.category.trim() || null,
      };
      if (editingId) {
        const { error } = await supabase.from("products").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("products").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingId ? "Produto atualizado!" : "Produto criado!");
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setDialogOpen(false);
      resetForm();
    },
    onError: (e: any) => toast.error(e.message || "Erro ao salvar"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").update({ active: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Produto removido!");
      queryClient.invalidateQueries({ queryKey: ["products"] });
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

  const openEdit = (p: any) => {
    setEditingId(p.id);
    setForm({
      name: p.name,
      description: p.description || "",
      type: p.type,
      sku: p.sku || "",
      barcode: p.barcode || "",
      unit: p.unit,
      sell_price: new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2 }).format(p.sell_price),
      cost_price: p.cost_price != null ? new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2 }).format(p.cost_price) : "",
      ncm: p.ncm || "",
      cclasstrib: p.cclasstrib || "",
      cfop: p.cfop || "",
      tax_origin: p.tax_origin || "",
      account_id: p.account_id || "",
      track_stock: p.track_stock,
      min_stock: p.min_stock != null ? String(p.min_stock) : "",
      category: p.category || "",
    });
    setDialogOpen(true);
  };

  // Filtering is now done server-side
  const filtered = products;

  // Reset page when filters change
  useEffect(() => { setPage(0); }, [search, filterType]);

  const set = (key: string, value: string | boolean) => setForm((prev) => ({ ...prev, [key]: value }));

  const margin = (p: Product) => {
    if (!p.cost_price || p.cost_price === 0) return null;
    return ((p.sell_price - p.cost_price) / p.sell_price * 100).toFixed(1);
  };

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <ProntoParaAgosto />

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-[-0.02em] flex items-center gap-2">
              <Package className="h-6 w-6" /> Produtos & Serviços
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Catálogo de produtos e serviços da empresa
            </p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1.5" /> Novo Item
          </Button>
        </div>

        {/* Filters */}
        <div className="flex gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por nome ou SKU..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="product">Produtos</SelectItem>
              <SelectItem value="service">Serviços</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="py-3 px-4">
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-lg font-bold">{products.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3 px-4">
              <p className="text-xs text-muted-foreground">Produtos</p>
              <p className="text-lg font-bold">{products.filter((p) => p.type === "product").length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3 px-4">
              <p className="text-xs text-muted-foreground">Serviços</p>
              <p className="text-lg font-bold">{products.filter((p) => p.type === "service").length}</p>
            </CardContent>
          </Card>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="text-sm text-muted-foreground text-center py-12">Carregando...</div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Package className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">
                {products.length === 0 ? "Nenhum item cadastrado ainda." : "Nenhum resultado para esta busca."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="bg-card border border-border rounded-lg divide-y divide-border">
            {filtered.map((p) => (
              <div key={p.id} role="button" tabIndex={0} aria-label="Abrir detalhes do registro"
                onClick={(e) => { const alvo=(e.target as HTMLElement).closest("button,a,input,[role='button']"); if (!alvo || alvo===e.currentTarget) abrirDetalhe({ tipo: "product", id: p.id }); }}
                onKeyDown={(e) => { if (e.key!=="Enter"&&e.key!==" ") return; const alvo=(e.target as HTMLElement).closest("button,a,input,[role='button']"); if (alvo && alvo!==e.currentTarget) return; e.preventDefault(); abrirDetalhe({ tipo: "product", id: p.id }); }}
                className="flex cursor-pointer items-center gap-4 px-4 py-3 transition-colors hover:bg-muted/30 focus:outline-none focus-visible:bg-muted/40 focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-primary/40">
                <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                  {p.type === "service" ? <Wrench className="h-4 w-4 text-muted-foreground" /> : <Box className="h-4 w-4 text-muted-foreground" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">{p.name}</p>
                    <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${p.type === "service" ? "bg-primary/[0.08] text-primary dark:bg-primary/[0.08] dark:text-primary" : "bg-success/[0.08] text-success dark:bg-success/[0.08] dark:text-success"}`}>
                      {p.type === "service" ? "Serviço" : "Produto"}
                    </Badge>
                    {p.category && <span className="text-[10px] text-muted-foreground">{p.category}</span>}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                    {p.sku && <span>SKU: {p.sku}</span>}
                    <span>{unitLabels[p.unit] || p.unit}</span>
                    {p.track_stock && <span>Estoque: {p.current_stock ?? 0}{p.min_stock ? ` (mín: ${p.min_stock})` : ""}</span>}
                    {margin(p) && <span>Margem: {margin(p)}%</span>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold font-mono">{fmt(p.sell_price)}</p>
                  {p.cost_price != null && <p className="text-[10px] text-muted-foreground font-mono">Custo: {fmt(p.cost_price)}</p>}
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(p)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteId(p.id)}>
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
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setDialogOpen(open); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Item" : "Novo Item"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Tipo</Label>
                <Select value={form.type} onValueChange={(v) => set("type", v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="product">Produto</SelectItem>
                    <SelectItem value="service">Serviço</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Unidade</Label>
                <Select value={form.unit} onValueChange={(v) => set("unit", v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(unitLabels).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v} ({k})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs">Nome *</Label>
              <Input className="mt-1" value={form.name} onChange={(e) => set("name", e.target.value)} />
            </div>

            <div>
              <Label className="text-xs">Descrição</Label>
              <Textarea className="mt-1" rows={2} value={form.description} onChange={(e) => set("description", e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">SKU</Label>
                <Input className="mt-1 font-mono" value={form.sku} onChange={(e) => set("sku", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Código de Barras</Label>
                <Input className="mt-1 font-mono" value={form.barcode} onChange={(e) => set("barcode", e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Preço de Venda *</Label>
                <Input className="mt-1 font-mono" value={form.sell_price} onChange={(e) => {
                  const raw = e.target.value.replace(/\D/g, "");
                  if (!raw) { set("sell_price", ""); return; }
                  const num = (parseInt(raw, 10) / 100).toFixed(2);
                  set("sell_price", new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2 }).format(parseFloat(num)));
                }} placeholder="0,00" inputMode="numeric" />
              </div>
              <div>
                <Label className="text-xs">Preço de Custo</Label>
                <Input className="mt-1 font-mono" value={form.cost_price} onChange={(e) => {
                  const raw = e.target.value.replace(/\D/g, "");
                  if (!raw) { set("cost_price", ""); return; }
                  const num = (parseInt(raw, 10) / 100).toFixed(2);
                  set("cost_price", new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2 }).format(parseFloat(num)));
                }} placeholder="0,00" inputMode="numeric" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">NCM</Label>
                <Input className="mt-1 font-mono" value={form.ncm} onChange={(e) => set("ncm", e.target.value)} placeholder="0000.00.00" />
              </div>
              <div>
                <Label className="text-xs">cClassTrib (Reforma CBS/IBS)</Label>
                <Input className="mt-1 font-mono" value={form.cclasstrib} onChange={(e) => set("cclasstrib", e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000001" />
              </div>
              <div>
                <Label className="text-xs">CFOP</Label>
                <Input className="mt-1 font-mono" value={form.cfop} onChange={(e) => set("cfop", e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="5102" />
              </div>
              <div>
                <Label className="text-xs">Origem da mercadoria</Label>
                <Input className="mt-1 font-mono" value={form.tax_origin} onChange={(e) => set("tax_origin", e.target.value.replace(/\D/g, "").slice(0, 1))} placeholder="0" />
              </div>
              <div>
                <Label className="text-xs">Categoria</Label>
                <Input className="mt-1" value={form.category} onChange={(e) => set("category", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Conta contábil da receita</Label>
                <Select value={form.account_id || "__nenhuma"} onValueChange={(v) => set("account_id", v === "__nenhuma" ? "" : v)}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Escolher conta" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__nenhuma">Nenhuma</SelectItem>
                    {contasReceita.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.code} {c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Com ela, a venda deste item já entra classificada no resultado.
                </p>
              </div>
            </div>

            {form.type === "product" && (
              <div className="space-y-3 pt-2 border-t border-border">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Controlar Estoque</p>
                    <p className="text-xs text-muted-foreground">Acompanhar entradas e saídas automaticamente</p>
                  </div>
                  <Switch checked={form.track_stock as boolean} onCheckedChange={(v) => set("track_stock", v)} />
                </div>
                {form.track_stock && (
                  <div>
                    <Label className="text-xs">Estoque Mínimo</Label>
                    <Input className="mt-1 font-mono" value={form.min_stock} onChange={(e) => set("min_stock", e.target.value)} placeholder="0" />
                  </div>
                )}
              </div>
            )}
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
            <AlertDialogTitle>Remover item?</AlertDialogTitle>
            <AlertDialogDescription>O item será desativado e não aparecerá mais no catálogo.</AlertDialogDescription>
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
