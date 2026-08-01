import { mensagemDeErro } from "@/lib/erros";
import { useState } from "react";
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges";
import { AppLayout } from "@/components/AppLayout";
import { FaturarPedido } from "@/components/vendas/FaturarPedido";
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
  ShoppingCart, Plus, Pencil, Trash2, Search, FileText, Eye, Receipt, Link2,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useDetalhe } from "@/components/detalhe/DetalheProvider";

interface SalesOrder {
  id: string;
  order_number: number;
  status: string;
  issue_date: string;
  due_date: string | null;
  subtotal: number;
  total: number;
  salesperson: string | null;
  notes: string | null;
  contact: { id: string; name: string } | null;
  items: OrderItem[];
}

interface OrderItem {
  id?: string;
  product_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  total: number;
}

interface Contact {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
  sell_price: number;
}

function fmt(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

const statusLabels: Record<string, string> = {
  quote: "Orçamento",
  confirmed: "Confirmado",
  invoiced: "Faturado",
  delivered: "Entregue",
  cancelled: "Cancelado",
};

const statusColors: Record<string, string> = {
  quote: "bg-primary/[0.08] text-primary dark:bg-primary/[0.08] dark:text-primary",
  confirmed: "bg-success/[0.08] text-success dark:bg-success/[0.08] dark:text-success",
  invoiced: "bg-primary/[0.08] text-primary dark:bg-primary/[0.08] dark:text-primary",
  delivered: "bg-success/[0.08] text-success dark:bg-success/[0.08] dark:text-success",
  cancelled: "bg-destructive/[0.08] text-destructive dark:bg-destructive/[0.08] dark:text-destructive",
};

const emptyItem: OrderItem = { product_id: null, description: "", quantity: 1, unit_price: 0, discount_percent: 0, total: 0 };

export default function SalesOrdersPage() {
  const { abrirDetalhe } = useDetalhe();
  const { company } = useCompany();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const { markDirty, markClean, confirmDiscard } = useUnsavedChanges(dialogOpen);

  const handleDialogClose = (open: boolean) => {
    if (!open && !confirmDiscard()) return;
    setDialogOpen(open);
    if (!open) { resetForm(); markClean(); }
  };

  // Form state
  const [contactId, setContactId] = useState("");
  const [status, setStatus] = useState("quote");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState("");
  const [items, setItems] = useState<OrderItem[]>([{ ...emptyItem }]);
  const [discount, setDiscount] = useState("");
  const [shipping, setShipping] = useState("");
  const [notes, setNotes] = useState("");
  const [salesperson, setSalesperson] = useState("");
  const [salespersonId, setSalespersonId] = useState("");

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["sales_orders", company?.id],
    queryFn: async () => {
      if (!company) return [];
      const { data, error } = await supabase
        .from("sales_orders")
        .select("id, order_number, status, issue_date, due_date, subtotal, total, salesperson, salesperson_id, notes, contact_id, contacts(id, name)")
        .eq("company_id", company.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map((o: any) => ({ ...o, contact: o.contacts })) as SalesOrder[];
    },
    enabled: !!company,
    staleTime: 30_000,
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ["contacts_list", company?.id],
    queryFn: async () => {
      if (!company) return [];
      const { data } = await supabase.from("contacts").select("id, name").eq("company_id", company.id).eq("active", true).in("type", ["customer", "both"]).order("name");
      return (data || []) as Contact[];
    },
    enabled: !!company,
  });

  const { data: vendedores = [] } = useQuery({
    queryKey: ["salespeople_list", company?.id],
    enabled: !!company,
    queryFn: async () => {
      const { data } = await supabase
        .from("salespeople" as never)
        .select("id, name")
        .eq("company_id", company!.id)
        .eq("active", true)
        .order("name");
      return (data ?? []) as unknown as Array<{ id: string; name: string }>;
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products_list", company?.id],
    queryFn: async () => {
      if (!company) return [];
      const { data } = await supabase.from("products").select("id, name, sell_price").eq("company_id", company.id).eq("active", true).order("name");
      return (data || []) as Product[];
    },
    enabled: !!company,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!company || !user) return;
      const subtotal = items.reduce((s, i) => s + i.total, 0);
      const discVal = parseFloat(discount) || 0;
      const shipVal = parseFloat(shipping) || 0;
      const total = subtotal - discVal + shipVal;

      const payload = {
        company_id: company.id,
        user_id: user.id,
        contact_id: contactId || null,
        status,
        issue_date: issueDate,
        due_date: dueDate || null,
        subtotal,
        discount_value: discVal,
        shipping: shipVal,
        total,
        notes: notes.trim() || null,
        salesperson: salesperson.trim() || null,
        // Guarda os dois: o id é o que serve para ranking, meta e comissão, e o
        // texto continua porque pedido antigo só tem ele.
        salesperson_id: salespersonId || null,
      };

      let orderId = editingId;
      if (editingId) {
        const { error } = await supabase.from("sales_orders").update(payload).eq("id", editingId);
        if (error) throw error;
        await supabase.from("sales_order_items").delete().eq("order_id", editingId);
      } else {
        const { data, error } = await supabase.from("sales_orders").insert(payload).select("id").single();
        if (error) throw error;
        orderId = data.id;
      }

      if (orderId && items.length > 0) {
        const itemsPayload = items.map((item, idx) => ({
          order_id: orderId,
          product_id: item.product_id || null,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount_percent: item.discount_percent,
          total: item.total,
          sort_order: idx,
        }));
        const { error } = await supabase.from("sales_order_items").insert(itemsPayload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingId ? "Pedido atualizado!" : "Pedido criado!");
      queryClient.invalidateQueries({ queryKey: ["sales_orders"] });
      markClean();
      setDialogOpen(false);
      resetForm();
    },
    onError: (e: any) => toast.error(e.message || "Erro ao salvar"),
  });

  const resetForm = () => {
    setEditingId(null);
    setContactId("");
    setStatus("quote");
    setIssueDate(new Date().toISOString().split("T")[0]);
    setDueDate("");
    setItems([{ ...emptyItem }]);
    setDiscount("");
    setShipping("");
    setNotes("");
    setSalesperson("");
  };

  const addItem = () => setItems((prev) => [...prev, { ...emptyItem }]);

  const openEdit = async (order: SalesOrder) => {
    setEditingId(order.id);
    setContactId(order.contact?.id || "");
    setStatus(order.status);
    setIssueDate(order.issue_date);
    setDueDate(order.due_date || "");
    setNotes(order.notes || "");
    setSalesperson(order.salesperson || "");
    setSalespersonId((order as { salesperson_id?: string }).salesperson_id || "");
    // Fetch items
    const { data: orderItems } = await supabase
      .from("sales_order_items")
      .select("*")
      .eq("order_id", order.id)
      .order("sort_order");
    if (orderItems && orderItems.length > 0) {
      setItems(orderItems.map((i: any) => ({
        id: i.id,
        product_id: i.product_id,
        description: i.description,
        quantity: Number(i.quantity),
        unit_price: Number(i.unit_price),
        discount_percent: Number(i.discount_percent || 0),
        total: Number(i.total),
      })));
    } else {
      setItems([{ ...emptyItem }]);
    }
    // Restore discount and shipping from saved order
    const { data: orderData } = await supabase.from("sales_orders").select("discount_value, shipping").eq("id", order.id).single();
    setDiscount(orderData?.discount_value ? String(orderData.discount_value) : "");
    setShipping(orderData?.shipping ? String(orderData.shipping) : "");
    setDialogOpen(true);
  };

  const removeItem = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx));

  const updateItem = (idx: number, field: string, value: any) => {
    setItems((prev) => {
      const next = [...prev];
      const item = { ...next[idx], [field]: value };
      if (field === "product_id" && value) {
        const p = products.find((pr) => pr.id === value);
        if (p) {
          item.description = p.name;
          item.unit_price = p.sell_price;
        }
      }
      item.total = item.quantity * item.unit_price * (1 - (item.discount_percent || 0) / 100);
      next[idx] = item;
      return next;
    });
  };

  const subtotal = items.reduce((s, i) => s + i.total, 0);
  const totalOrder = subtotal - (parseFloat(discount) || 0) + (parseFloat(shipping) || 0);

  const filtered = orders.filter((o) => {
    const matchSearch = !search ||
      String(o.order_number).includes(search) ||
      (o.contact?.name || "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "all" || o.status === filterStatus;
    return matchSearch && matchStatus;
  });

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-[-0.02em] flex items-center gap-2">
              <ShoppingCart className="h-6 w-6" /> Pedidos de Venda
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Orçamentos e pedidos de venda</p>
          </div>
          <Button onClick={() => { resetForm(); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-1.5" /> Novo Pedido
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          {(["quote", "confirmed", "invoiced", "delivered"] as const).map((s) => {
            const count = orders.filter((o) => o.status === s).length;
            const total = orders.filter((o) => o.status === s).reduce((sum, o) => sum + Number(o.total), 0);
            return (
              <Card key={s}>
                <CardContent className="py-3 px-4">
                  <p className="text-xs text-muted-foreground">{statusLabels[s]}</p>
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
            <Input placeholder="Buscar por nº ou cliente..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {Object.entries(statusLabels).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="text-sm text-muted-foreground text-center py-12">Carregando...</div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <ShoppingCart className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">Nenhum pedido encontrado.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="bg-card border border-border rounded-lg divide-y divide-border">
            {filtered.map((o) => (
              <div key={o.id} role="button" tabIndex={0} aria-label="Abrir detalhes do registro"
                onClick={(e) => { const a=(e.target as HTMLElement).closest("button,a,input,[role='button']"); if (!a || a===e.currentTarget) abrirDetalhe({ tipo: "sales_order", id: o.id }); }}
                onKeyDown={(e) => { if (e.key!=="Enter"&&e.key!==" ") return; const a=(e.target as HTMLElement).closest("button,a,input,[role='button']"); if (a && a!==e.currentTarget) return; e.preventDefault(); abrirDetalhe({ tipo: "sales_order", id: o.id }); }}
                className="flex cursor-pointer items-center gap-4 px-4 py-3 transition-colors hover:bg-muted/30 focus:outline-none focus-visible:bg-muted/40 focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-primary/40">
                <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">#{o.order_number}</p>
                    <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${statusColors[o.status]}`}>
                      {statusLabels[o.status]}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                    <span>{o.contact?.name || "Sem cliente"}</span>
                    <span>{new Date(o.issue_date + "T00:00:00").toLocaleDateString("pt-BR")}</span>
                    {o.salesperson && <span>{o.salesperson}</span>}
                  </div>
                </div>
                <p className="text-sm font-semibold font-mono">{fmt(Number(o.total))}</p>
                <div className="flex items-center gap-1">
                  {o.status === "quote" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      title="Gerar link de aceite para o cliente"
                      onClick={async (e) => {
                        e.stopPropagation();
                        const { data, error } = await supabase.rpc("gerar_link_proposta" as never, {
                          p_sales_order_id: o.id,
                          p_dias_validade: 15,
                        } as never);
                        if (error) { toast.error("Não consegui gerar: " + mensagemDeErro(e)); return; }
                        const { token, validade } = data as unknown as { token: string; validade: string };
                        const url = `${window.location.origin}/proposta/${token}`;
                        await navigator.clipboard.writeText(url).catch(() => undefined);
                        toast.success("Link copiado. Válido até " +
                          new Date(validade + "T00:00:00").toLocaleDateString("pt-BR") + ".", {
                          description: url,
                        });
                      }}
                    >
                      <Link2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  {(o.status === "confirmed" || o.status === "delivered") && (
                    <FaturarPedido
                      pedidoId={o.id}
                      contatoId={o.contact?.id ?? null}
                      numero={o.order_number}
                      total={Number(o.total)}
                      clienteNome={o.contact?.name ?? null}
                      vencimentoPedido={o.due_date ?? null}
                      onFaturado={() => queryClient.invalidateQueries({ queryKey: ["sales_orders", company?.id] })}
                    />
                  )}
                  {(o.status === "confirmed" || o.status === "delivered") && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      title="Gerar NFS-e"
                      onClick={() => {
                        // Navigate to NFS-e emit with pre-filled data from this order
                        const params = new URLSearchParams();
                        params.set("sales_order_id", o.id);
                        params.set("contact_id", o.contact?.id || "");
                        params.set("valor", String(o.total));
                        navigate(`/nfse/emit?${params.toString()}`);
                      }}
                    >
                      <Receipt className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(o)}>
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Pedido" : "Novo Pedido de Venda"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Cliente</Label>
                <Select value={contactId} onValueChange={setContactId}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {contacts.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
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
              <div>
                <Label className="text-xs">Data Emissão</Label>
                <Input type="date" className="mt-1" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Vencimento</Label>
                <Input type="date" className="mt-1" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Vendedor</Label>
                <Select
                  value={salespersonId || "__nenhum"}
                  onValueChange={(v) => {
                    const id = v === "__nenhum" ? "" : v;
                    setSalespersonId(id);
                    setSalesperson(vendedores.find((x) => x.id === id)?.name ?? "");
                  }}
                >
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Escolher" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__nenhum">Nenhum</SelectItem>
                    {vendedores.map((v) => (
                      <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Items */}
            <div className="space-y-2 pt-2 border-t border-border">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Itens</p>
                <Button variant="outline" size="sm" onClick={addItem}><Plus className="h-3 w-3 mr-1" /> Item</Button>
              </div>
              {items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-4">
                    <Label className="text-[10px]">Produto</Label>
                    <Select value={item.product_id || ""} onValueChange={(v) => updateItem(idx, "product_id", v)}>
                      <SelectTrigger className="mt-0.5 h-8 text-xs"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <Label className="text-[10px]">Qtd</Label>
                    <Input className="mt-0.5 h-8 text-xs font-mono" type="number" value={item.quantity} onChange={(e) => updateItem(idx, "quantity", parseFloat(e.target.value) || 0)} />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-[10px]">Preço Un.</Label>
                    <Input className="mt-0.5 h-8 text-xs font-mono" type="number" value={item.unit_price} onChange={(e) => updateItem(idx, "unit_price", parseFloat(e.target.value) || 0)} />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-[10px]">Desc %</Label>
                    <Input className="mt-0.5 h-8 text-xs font-mono" type="number" value={item.discount_percent} onChange={(e) => updateItem(idx, "discount_percent", parseFloat(e.target.value) || 0)} />
                  </div>
                  <div className="col-span-1 text-right">
                    <p className="text-xs font-mono font-semibold">{fmt(item.total)}</p>
                  </div>
                  <div className="col-span-1">
                    {items.length > 1 && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeItem(idx)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="grid grid-cols-3 gap-3 pt-2 border-t border-border">
              <div>
                <Label className="text-xs">Desconto (R$)</Label>
                <Input className="mt-1 font-mono" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0.00" />
              </div>
              <div>
                <Label className="text-xs">Frete (R$)</Label>
                <Input className="mt-1 font-mono" value={shipping} onChange={(e) => setShipping(e.target.value)} placeholder="0.00" />
              </div>
              <div className="flex flex-col justify-end">
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-lg font-bold font-mono">{fmt(totalOrder)}</p>
              </div>
            </div>

            <div>
              <Label className="text-xs">Observações</Label>
              <Textarea className="mt-1" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={items.every((i) => !i.description) || saveMutation.isPending}>
              {saveMutation.isPending ? "Salvando..." : editingId ? "Salvar" : "Criar Pedido"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
