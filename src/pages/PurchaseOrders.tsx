import { useState } from "react";
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges";
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
  ShoppingBag, Plus, Trash2, Search, FileText, Eye,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface PurchaseOrder {
  id: string;
  order_number: number;
  status: string;
  issue_date: string;
  expected_date: string | null;
  total: number;
  notes: string | null;
  contact: { id: string; name: string } | null;
}

interface OrderItem {
  product_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

function fmt(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

const statusLabels: Record<string, string> = {
  draft: "Rascunho",
  sent: "Enviado",
  confirmed: "Confirmado",
  received: "Recebido",
  cancelled: "Cancelado",
};

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
  sent: "bg-primary/[0.08] text-primary dark:bg-primary/[0.08] dark:text-primary",
  confirmed: "bg-success/[0.08] text-success dark:bg-success/[0.08] dark:text-success",
  received: "bg-success/[0.08] text-success dark:bg-success/[0.08] dark:text-success",
  cancelled: "bg-destructive/[0.08] text-destructive dark:bg-destructive/[0.08] dark:text-destructive",
};

const emptyItem: OrderItem = { product_id: null, description: "", quantity: 1, unit_price: 0, total: 0 };

export default function PurchaseOrdersPage() {
  const { company } = useCompany();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // A alçada de aprovação vale para QUALQUER caminho que compromete dinheiro.
  // Antes, o título nascido de um pedido de compra caía no default 'approved'
  // do banco e furava o limite que o lançamento manual respeita.
  const { data: alcada } = useQuery({
    queryKey: ["approval_limit_po", company?.id, user?.id],
    enabled: !!company?.id && !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("company_members")
        .select("approval_limit")
        .eq("company_id", company!.id)
        .eq("user_id", user!.id)
        .maybeSingle();
      return (data as { approval_limit: number | null } | null) ?? null;
    },
  });
  const limiteAprovacao = alcada?.approval_limit ?? null;
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

  const [contactId, setContactId] = useState("");
  const [status, setStatus] = useState("draft");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split("T")[0]);
  const [expectedDate, setExpectedDate] = useState("");
  const [items, setItems] = useState<OrderItem[]>([{ ...emptyItem }]);
  const [discount, setDiscount] = useState("");
  const [shipping, setShipping] = useState("");
  const [notes, setNotes] = useState("");

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["purchase_orders", company?.id],
    queryFn: async () => {
      if (!company) return [];
      const { data, error } = await supabase
        .from("purchase_orders")
        .select("id, order_number, status, issue_date, expected_date, total, notes, contact_id, contacts(id, name)")
        .eq("company_id", company.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map((o: any) => ({ ...o, contact: o.contacts })) as PurchaseOrder[];
    },
    enabled: !!company,
    staleTime: 30_000,
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers_list", company?.id],
    queryFn: async () => {
      if (!company) return [];
      const { data } = await supabase.from("contacts").select("id, name").eq("company_id", company.id).eq("active", true).in("type", ["supplier", "both"]).order("name");
      return (data || []) as { id: string; name: string }[];
    },
    enabled: !!company,
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products_list", company?.id],
    queryFn: async () => {
      if (!company) return [];
      const { data } = await supabase.from("products").select("id, name, sell_price, cost_price").eq("company_id", company.id).eq("active", true).order("name");
      return (data || []) as { id: string; name: string; sell_price: number; cost_price: number | null }[];
    },
    enabled: !!company,
  });

  // Track previous status to detect transitions
  const [previousStatus, setPreviousStatus] = useState<string | null>(null);

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
        expected_date: expectedDate || null,
        subtotal,
        discount_value: discVal,
        shipping: shipVal,
        total,
        notes: notes.trim() || null,
      };

      let orderId = editingId;
      let isNewConfirmation = false;

      if (editingId) {
        // Only generate bill if status is transitioning TO confirmed
        isNewConfirmation = status === "confirmed" && previousStatus !== "confirmed";
        const { error } = await supabase.from("purchase_orders").update(payload).eq("id", editingId);
        if (error) throw error;
        await supabase.from("purchase_order_items").delete().eq("order_id", editingId);
      } else {
        isNewConfirmation = status === "confirmed";
        const { data, error } = await supabase.from("purchase_orders").insert(payload).select("id, order_number").single();
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
          total: item.total,
          sort_order: idx,
        }));
        const { error } = await supabase.from("purchase_order_items").insert(itemsPayload);
        if (error) throw error;
      }

      return { isNewConfirmation, orderId };
    },
    onSuccess: async (result) => {
      toast.success(editingId ? "Pedido atualizado!" : "Pedido criado!");
      queryClient.invalidateQueries({ queryKey: ["purchase_orders"] });

      // Auto-generate bill payable only on status transition TO confirmed
      if (result?.isNewConfirmation && company && contactId) {
        const supplier = suppliers.find((s) => s.id === contactId);
        const totalVal = items.reduce((s, i) => s + i.total, 0) - (parseFloat(discount) || 0) + (parseFloat(shipping) || 0);
        const dueDate = expectedDate || new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];
        
        const { error: billError } = await supabase.from("bills_payable").insert({
          company_id: company.id,
          fornecedor: supplier?.name || "Fornecedor",
          contact_id: contactId,
          valor: totalVal,
          vencimento: dueDate,
          descricao: `Pedido de compra #${result.orderId?.slice(0, 8) || ""}`,
          source: "purchase_order",
          status: "pendente",
          purchase_order_id: result.orderId ?? null,
          approval_status:
            limiteAprovacao != null && Number(totalVal) > limiteAprovacao
              ? "awaiting_approval"
              : "approved",
        } as never);
        if (!billError) {
          toast.success("Conta a pagar gerada automaticamente!");
          queryClient.invalidateQueries({ queryKey: ["bills_payable"] });
        }
      }

      markClean();
      setDialogOpen(false);
      resetForm();
    },
    onError: (e: any) => toast.error(e.message || "Erro ao salvar"),
  });

  const resetForm = () => {
    setEditingId(null);
    setContactId("");
    setStatus("draft");
    setIssueDate(new Date().toISOString().split("T")[0]);
    setExpectedDate("");
    setItems([{ ...emptyItem }]);
    setDiscount("");
    setShipping("");
    setNotes("");
  };

  const addItem = () => setItems((prev) => [...prev, { ...emptyItem }]);
  const removeItem = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx));

  const openEdit = async (order: PurchaseOrder) => {
    setEditingId(order.id);
    setContactId(order.contact?.id || "");
    setStatus(order.status);
    setPreviousStatus(order.status);
    setIssueDate(order.issue_date);
    setExpectedDate(order.expected_date || "");
    setNotes(order.notes || "");
    // Fetch items
    const { data: orderItems } = await supabase
      .from("purchase_order_items")
      .select("*")
      .eq("order_id", order.id)
      .order("sort_order");
    if (orderItems && orderItems.length > 0) {
      setItems(orderItems.map((i: any) => ({
        product_id: i.product_id,
        description: i.description,
        quantity: Number(i.quantity),
        unit_price: Number(i.unit_price),
        total: Number(i.total),
      })));
    } else {
      setItems([{ ...emptyItem }]);
    }
    // Restore discount and shipping from saved order
    const { data: orderData } = await supabase.from("purchase_orders").select("discount_value, shipping").eq("id", order.id).single();
    setDiscount(orderData?.discount_value ? String(orderData.discount_value) : "");
    setShipping(orderData?.shipping ? String(orderData.shipping) : "");
    setDialogOpen(true);
  };

  const updateItem = (idx: number, field: string, value: any) => {
    setItems((prev) => {
      const next = [...prev];
      const item = { ...next[idx], [field]: value };
      if (field === "product_id" && value) {
        const p = products.find((pr) => pr.id === value);
        if (p) {
          item.description = p.name;
          item.unit_price = p.cost_price ?? p.sell_price;
        }
      }
      item.total = item.quantity * item.unit_price;
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
              <ShoppingBag className="h-6 w-6" /> Pedidos de Compra
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Cotações e pedidos para fornecedores</p>
          </div>
          <Button onClick={() => { resetForm(); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-1.5" /> Novo Pedido
          </Button>
        </div>

        {/* Compra automatizada: solução irmã do ecossistema, com IA de cotação
            e negociação autônoma. Cross-link até a integração nativa chegar. */}
        <a
          href="https://openclaw-shop-page.lovable.app"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between gap-3 rounded-lg border border-primary/20 bg-primary/[0.04] px-4 py-3 transition-colors hover:bg-primary/[0.08]"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <ShoppingBag className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Compra automatizada com OpenClaw</p>
              <p className="text-xs text-muted-foreground">
                Envie orçamentos, extraia itens com IA e deixe o agente negociar com fornecedores
              </p>
            </div>
          </div>
          <span className="shrink-0 text-xs font-medium text-primary">Abrir →</span>
        </a>

        {/* Filters */}
        <div className="flex gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por nº ou fornecedor..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {Object.entries(statusLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="text-sm text-muted-foreground text-center py-12">Carregando...</div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <ShoppingBag className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">Nenhum pedido encontrado.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="bg-card border border-border rounded-lg divide-y divide-border">
            {filtered.map((o) => (
              <div key={o.id} className="flex items-center gap-4 px-4 py-3 hover:bg-muted/30 transition-colors">
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
                    <span>{o.contact?.name || "Sem fornecedor"}</span>
                    <span>{new Date(o.issue_date + "T00:00:00").toLocaleDateString("pt-BR")}</span>
                  </div>
                </div>
                <p className="text-sm font-semibold font-mono">{fmt(Number(o.total))}</p>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(o)}>
                  <Eye className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Pedido" : "Novo Pedido de Compra"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Fornecedor</Label>
                <Select value={contactId} onValueChange={setContactId}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {suppliers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
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

            <div>
              <Label className="text-xs">Previsão de Entrega</Label>
              <Input type="date" className="mt-1 w-48" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} />
            </div>

            {/* Items */}
            <div className="space-y-2 pt-2 border-t border-border">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Itens</p>
                <Button variant="outline" size="sm" onClick={addItem}><Plus className="h-3 w-3 mr-1" /> Item</Button>
              </div>
              {items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-5">
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
                  <div className="col-span-2 text-right">
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
