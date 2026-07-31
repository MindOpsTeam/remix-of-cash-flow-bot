import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { DepositosDialog } from "@/components/estoque/DepositosDialog";
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
  Warehouse, Plus, Search, ArrowDownToLine, ArrowUpFromLine, RefreshCw, Package, AlertTriangle,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface StockProduct {
  id: string;
  name: string;
  sku: string | null;
  unit: string;
  current_stock: number | null;
  min_stock: number | null;
  cost_price: number | null;
  sell_price: number;
}

interface StockMovement {
  id: string;
  type: string;
  quantity: number;
  unit_cost: number | null;
  notes: string | null;
  created_at: string;
  product: { name: string } | null;
}

function fmt(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

const moveTypeLabels: Record<string, string> = { in: "Entrada", out: "Saída", adjustment: "Ajuste", transfer: "Transferência" };
const moveTypeColors: Record<string, string> = {
  in: "text-revenue",
  out: "text-expense",
  adjustment: "text-warning",
  transfer: "text-primary",
};

export default function StockPage() {
  const { company } = useCompany();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [moveType, setMoveType] = useState<"in" | "out" | "adjustment">("in");
  const [moveProductId, setMoveProductId] = useState("");
  const [moveQty, setMoveQty] = useState("");
  const [moveCost, setMoveCost] = useState("");
  const [moveNotes, setMoveNotes] = useState("");

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["stock_products", company?.id],
    queryFn: async () => {
      if (!company) return [];
      const { data, error } = await supabase
        .from("products")
        .select("id, name, sku, unit, current_stock, min_stock, cost_price, sell_price")
        .eq("company_id", company.id)
        .eq("active", true)
        .eq("track_stock", true)
        .order("name");
      if (error) throw error;
      return (data || []) as StockProduct[];
    },
    enabled: !!company,
  });

  const { data: recentMovements = [] } = useQuery({
    queryKey: ["stock_movements", company?.id],
    queryFn: async () => {
      if (!company) return [];
      const { data, error } = await supabase
        .from("stock_movements")
        .select("id, type, quantity, unit_cost, notes, created_at, product_id, products(name)")
        .eq("company_id", company.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data || []).map((m: any) => ({ ...m, product: m.products })) as StockMovement[];
    },
    enabled: !!company,
  });

  const moveMutation = useMutation({
    mutationFn: async () => {
      if (!company || !user) return;
      const qty = parseFloat(moveQty);
      if (!qty || !moveProductId) throw new Error("Produto e quantidade são obrigatórios");

      // Tudo numa transação só no banco: a RPC trava a linha do produto, grava
      // o DELTA no razão (no ajuste, a diferença até o alvo, não o valor alvo) e
      // recalcula o custo médio móvel. Antes isso era feito no cliente, lendo o
      // saldo do cache: dois usuários ao mesmo tempo perdiam movimento, e o
      // ajuste gravava o número absoluto como se fosse a variação.
      const { error: rpcError } = await supabase.rpc("registrar_movimento_estoque" as never, {
        p_company_id: company.id,
        p_product_id: moveProductId,
        p_tipo: moveType,
        p_quantidade: qty,
        p_custo_unitario: moveCost ? parseFloat(moveCost) : null,
        p_observacao: moveNotes.trim() || null,
      } as never);
      if (rpcError) throw rpcError;
    },
    onSuccess: () => {
      toast.success("Movimentação registrada!");
      queryClient.invalidateQueries({ queryKey: ["stock_products"] });
      queryClient.invalidateQueries({ queryKey: ["stock_movements"] });
      setMoveDialogOpen(false);
      resetMoveForm();
    },
    onError: (e: any) => toast.error(e.message || "Erro ao registrar"),
  });

  const resetMoveForm = () => {
    setMoveProductId("");
    setMoveQty("");
    setMoveCost("");
    setMoveNotes("");
    setMoveType("in");
  };

  const filtered = products.filter((p) => {
    return !search || p.name.toLowerCase().includes(search.toLowerCase()) || (p.sku && p.sku.toLowerCase().includes(search.toLowerCase()));
  });

  const lowStock = products.filter((p) => p.min_stock && (p.current_stock ?? 0) <= p.min_stock);
  const totalValue = products.reduce((s, p) => s + (p.current_stock ?? 0) * (p.cost_price ?? 0), 0);

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-[-0.02em] flex items-center gap-2">
              <Warehouse className="h-6 w-6" /> Estoque
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Controle de inventário e movimentações</p>
          </div>
          <div className="flex gap-2">
            <DepositosDialog />
            <Button onClick={() => { resetMoveForm(); setMoveDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-1.5" /> Nova Movimentação
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="py-3 px-4">
              <p className="text-xs text-muted-foreground">Produtos Controlados</p>
              <p className="text-lg font-bold">{products.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3 px-4">
              <p className="text-xs text-muted-foreground">Valor em Estoque</p>
              <p className="text-lg font-bold font-mono">{fmt(totalValue)}</p>
            </CardContent>
          </Card>
          <Card className={lowStock.length > 0 ? "border-warning/30" : ""}>
            <CardContent className="py-3 px-4">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                {lowStock.length > 0 && <AlertTriangle className="h-3 w-3 text-warning" />}
                Estoque Baixo
              </p>
              <p className="text-lg font-bold">{lowStock.length}</p>
            </CardContent>
          </Card>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar produto..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        {/* Product Stock List */}
        {isLoading ? (
          <div className="text-sm text-muted-foreground text-center py-12">Carregando...</div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Package className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">
                {products.length === 0
                  ? "Nenhum produto com controle de estoque ativo. Ative em Produtos & Serviços."
                  : "Nenhum resultado."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="bg-card border border-border rounded-lg divide-y divide-border">
            {filtered.map((p) => {
              const isLow = p.min_stock && (p.current_stock ?? 0) <= p.min_stock;
              return (
                <div key={p.id} className="flex items-center gap-4 px-4 py-3 hover:bg-muted/30 transition-colors">
                  <div className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${isLow ? "bg-warning/[0.08] dark:bg-warning/[0.08]" : "bg-muted"}`}>
                    <Package className={`h-4 w-4 ${isLow ? "text-warning" : "text-muted-foreground"}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{p.name}</p>
                      {isLow && <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-warning/[0.08] text-warning dark:bg-warning/[0.08] dark:text-warning">Estoque Baixo</Badge>}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                      {p.sku && <span>SKU: {p.sku}</span>}
                      <span>Mín: {p.min_stock ?? 0} {p.unit}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-lg font-bold font-mono ${isLow ? "text-warning" : ""}`}>
                      {p.current_stock ?? 0} <span className="text-xs text-muted-foreground font-normal">{p.unit}</span>
                    </p>
                    {p.cost_price && <p className="text-[10px] text-muted-foreground font-mono">Valor: {fmt((p.current_stock ?? 0) * p.cost_price)}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Recent Movements */}
        {recentMovements.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">Movimentações Recentes</h2>
            <div className="bg-card border border-border rounded-lg divide-y divide-border">
              {recentMovements.map((m) => (
                <div key={m.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                    {m.type === "in" ? <ArrowDownToLine className="h-3.5 w-3.5 text-revenue" /> :
                      m.type === "out" ? <ArrowUpFromLine className="h-3.5 w-3.5 text-expense" /> :
                        <RefreshCw className="h-3.5 w-3.5 text-warning" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{m.product?.name}</p>
                    <p className="text-[10px] text-muted-foreground">{m.notes || moveTypeLabels[m.type]}</p>
                  </div>
                  <span className={`text-xs font-mono font-semibold ${moveTypeColors[m.type]}`}>
                    {m.quantity > 0 ? "+" : ""}{m.quantity}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(m.created_at).toLocaleDateString("pt-BR")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Movement Dialog */}
      <Dialog open={moveDialogOpen} onOpenChange={(open) => { if (!open) resetMoveForm(); setMoveDialogOpen(open); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Movimentação de Estoque</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Tipo</Label>
              <Select value={moveType} onValueChange={(v) => setMoveType(v as any)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="in">Entrada</SelectItem>
                  <SelectItem value="out">Saída</SelectItem>
                  <SelectItem value="adjustment">Ajuste (definir quantidade)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Produto</Label>
              <Select value={moveProductId} onValueChange={setMoveProductId}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name} ({p.current_stock ?? 0} {p.unit})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">{moveType === "adjustment" ? "Nova Quantidade" : "Quantidade"}</Label>
                <Input className="mt-1 font-mono" type="number" value={moveQty} onChange={(e) => setMoveQty(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Custo Unitário</Label>
                <Input className="mt-1 font-mono" type="number" value={moveCost} onChange={(e) => setMoveCost(e.target.value)} placeholder="0.00" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Observação</Label>
              <Input className="mt-1" value={moveNotes} onChange={(e) => setMoveNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => moveMutation.mutate()} disabled={!moveProductId || !moveQty || moveMutation.isPending}>
              {moveMutation.isPending ? "Salvando..." : "Registrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
