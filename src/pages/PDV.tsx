import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Banknote, CheckCircle2, Loader2, Minus, Plus, Printer, ShoppingCart, Trash2 } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@viverdeia/design-system";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { formatCurrency } from "@/lib/utils";

/**
 * Frente de caixa. Leitor de código de barras funciona de fábrica: o input de
 * busca mantém o foco e Enter com match único adiciona ao carrinho. Finalizar
 * chama a RPC venda_balcao — pedido entregue, estoque baixado, receita
 * confirmada e recebível recebido numa transação só.
 *
 * Atalhos: F2 foca a busca · F4 finaliza · Esc limpa a busca.
 */

interface ProdutoPdv {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  sell_price: number;
  track_stock: boolean;
  current_stock: number | null;
  type: string;
}

interface ItemCarrinho {
  produto: ProdutoPdv;
  quantidade: number;
}

const FORMAS_PAGAMENTO = [
  { value: "dinheiro", label: "Dinheiro" },
  { value: "pix", label: "PIX" },
  { value: "cartao_credito", label: "Crédito" },
  { value: "cartao_debito", label: "Débito" },
];

interface Recibo {
  order_number: string;
  total: number;
  itens: Array<{ descricao: string; quantidade: number; unitario: number }>;
  forma: string;
  quando: string;
}

export default function PDV() {
  const { company } = useCompany();
  const [busca, setBusca] = useState("");
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);
  const [desconto, setDesconto] = useState<string>("");
  const [forma, setForma] = useState("dinheiro");
  const [finalizando, setFinalizando] = useState(false);
  const [recibo, setRecibo] = useState<Recibo | null>(null);
  const buscaRef = useRef<HTMLInputElement>(null);

  const produtos = useQuery({
    queryKey: ["pdv_products", company?.id],
    enabled: !!company,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, sku, barcode, sell_price, track_stock, current_stock, type")
        .eq("company_id", company!.id)
        .eq("active", true)
        .order("name")
        .limit(500);
      if (error) throw error;
      return (data ?? []) as ProdutoPdv[];
    },
  });

  const lista = produtos.data ?? [];
  const filtro = busca.trim().toLowerCase();
  const filtrados = useMemo(
    () =>
      filtro
        ? lista.filter((p) =>
            [p.name, p.sku, p.barcode].some((campo) => campo?.toLowerCase().includes(filtro)),
          )
        : lista,
    [lista, filtro],
  );

  function adicionar(produto: ProdutoPdv) {
    if (produto.track_stock && (produto.current_stock ?? 0) <= 0) {
      toast.error(`${produto.name} está sem estoque.`);
      return;
    }
    setCarrinho((atual) => {
      const existente = atual.find((i) => i.produto.id === produto.id);
      if (existente) {
        return atual.map((i) => (i.produto.id === produto.id ? { ...i, quantidade: i.quantidade + 1 } : i));
      }
      return [...atual, { produto, quantidade: 1 }];
    });
    setBusca("");
    buscaRef.current?.focus();
  }

  function mudarQuantidade(produtoId: string, delta: number) {
    setCarrinho((atual) =>
      atual
        .map((i) => (i.produto.id === produtoId ? { ...i, quantidade: i.quantidade + delta } : i))
        .filter((i) => i.quantidade > 0),
    );
  }

  const subtotal = carrinho.reduce((s, i) => s + i.quantidade * i.produto.sell_price, 0);
  const descontoNum = Math.max(0, Number(desconto.replace(",", ".")) || 0);
  const total = Math.max(0, subtotal - descontoNum);

  async function finalizar() {
    if (!company || carrinho.length === 0) return;
    setFinalizando(true);
    try {
      const { data, error } = await (supabase.rpc as unknown as (
        fn: string,
        args: Record<string, unknown>,
      ) => PromiseLike<{ data: unknown; error: { message: string } | null }>)("venda_balcao", {
        p_company_id: company.id,
        p_itens: carrinho.map((i) => ({
          product_id: i.produto.id,
          description: i.produto.name,
          quantity: i.quantidade,
          unit_price: i.produto.sell_price,
        })),
        p_forma_pagamento: forma,
        p_desconto: descontoNum,
      });
      if (error) throw new Error(error.message);
      const r = data as { order_number: string; total: number };
      setRecibo({
        order_number: r.order_number,
        total: r.total,
        itens: carrinho.map((i) => ({ descricao: i.produto.name, quantidade: i.quantidade, unitario: i.produto.sell_price })),
        forma: FORMAS_PAGAMENTO.find((f) => f.value === forma)?.label ?? forma,
        quando: new Date().toLocaleString("pt-BR"),
      });
      setCarrinho([]);
      setDesconto("");
      produtos.refetch();
      toast.success(`Venda ${r.order_number} registrada: ${formatCurrency(r.total)}.`);
    } catch (e) {
      toast.error("Venda não registrada: " + (e as Error).message);
    } finally {
      setFinalizando(false);
    }
  }

  // Atalhos de caixa + leitor de código de barras (Enter com match único).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "F2") {
        e.preventDefault();
        buscaRef.current?.focus();
      } else if (e.key === "F4") {
        e.preventDefault();
        if (!finalizando && carrinho.length > 0) void finalizar();
      } else if (e.key === "Escape") {
        setBusca("");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carrinho, finalizando, forma, desconto, company?.id]);

  function onBuscaEnter(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter" || filtrados.length === 0) return;
    const exato = filtrados.find((p) => p.barcode === busca.trim() || p.sku === busca.trim());
    adicionar(exato ?? filtrados[0]);
  }

  return (
    <AppLayout>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3 print-hide">
        <div>
          <span className="via-eyebrow">Frente de caixa</span>
          <h1 className="mt-1 text-2xl font-bold tracking-[-0.02em] text-foreground">PDV</h1>
        </div>
        <p className="text-xs text-muted-foreground">F2 busca · Enter adiciona · F4 finaliza</p>
      </div>

      <div className="grid grid-cols-1 gap-4 print-hide lg:grid-cols-5">
        <div className="lg:col-span-3">
          <Input
            ref={buscaRef}
            autoFocus
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            onKeyDown={onBuscaEnter}
            placeholder="Nome, SKU ou código de barras…"
            className="mb-3 h-11 text-base"
            aria-label="Buscar produto"
          />
          <div className="grid max-h-[62vh] grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3 xl:grid-cols-4">
            {produtos.isLoading ? (
              <div className="col-span-full flex justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : filtrados.length === 0 ? (
              <div className="col-span-full py-8">
                <EmptyState
                  icon={<ShoppingCart />}
                  title={lista.length === 0 ? "Sem produtos ativos" : "Nada encontrado"}
                  description={lista.length === 0 ? "Cadastre produtos para vender no balcão." : "Ajuste a busca ou confira o código."}
                />
              </div>
            ) : (
              filtrados.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => adicionar(p)}
                  className="flex min-h-[92px] flex-col justify-between rounded-lg border border-border bg-card p-3 text-left transition-all hover:-translate-y-px hover:border-primary/25 hover:shadow-card-hover"
                >
                  <span className="line-clamp-2 text-sm font-medium text-foreground">{p.name}</span>
                  <span className="mt-2 flex items-baseline justify-between gap-2">
                    <span className="font-mono text-sm font-semibold text-foreground">{formatCurrency(p.sell_price)}</span>
                    {p.track_stock && (
                      <span className={`text-[10px] ${(p.current_stock ?? 0) <= 0 ? "text-expense" : "text-muted-foreground"}`}>
                        {p.current_stock ?? 0} em estoque
                      </span>
                    )}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="rounded-lg border border-border bg-card p-4">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <ShoppingCart className="h-4 w-4 text-muted-foreground" /> Carrinho
            </h2>
            {carrinho.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Toque num produto ou bipe o código.</p>
            ) : (
              <div className="space-y-2">
                {carrinho.map((item) => (
                  <div key={item.produto.id} className="flex items-center justify-between gap-2 rounded-md border border-border/70 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{item.produto.name}</p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {item.quantidade} × {formatCurrency(item.produto.sell_price)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => mudarQuantidade(item.produto.id, -1)} aria-label={`Diminuir ${item.produto.name}`}>
                        <Minus className="h-3.5 w-3.5" />
                      </Button>
                      <span className="w-6 text-center font-mono text-sm">{item.quantidade}</span>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => mudarQuantidade(item.produto.id, 1)} aria-label={`Aumentar ${item.produto.name}`}>
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => mudarQuantidade(item.produto.id, -item.quantidade)} aria-label={`Remover ${item.produto.name}`}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 space-y-2 border-t border-border pt-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-mono">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground">Desconto (R$)</span>
                <Input
                  value={desconto}
                  onChange={(e) => setDesconto(e.target.value)}
                  inputMode="decimal"
                  className="h-8 w-24 text-right font-mono text-sm"
                  aria-label="Desconto em reais"
                />
              </div>
              <div className="flex items-center justify-between border-t border-border pt-2">
                <span className="text-sm font-semibold">Total</span>
                <span className="font-mono text-xl font-bold tracking-[-0.03em]">{formatCurrency(total)}</span>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              {FORMAS_PAGAMENTO.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setForma(f.value)}
                  className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                    forma === f.value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <Button
              className="mt-3 h-11 w-full gap-2 text-base"
              onClick={finalizar}
              disabled={finalizando || carrinho.length === 0}
            >
              {finalizando ? <Loader2 className="h-5 w-5 animate-spin" /> : <Banknote className="h-5 w-5" />}
              Finalizar venda (F4)
            </Button>
          </div>

          {recibo && (
            <div className="mt-4 rounded-lg border border-[hsl(var(--success))]/30 bg-[hsl(var(--success))]/5 p-4 print-hide">
              <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <CheckCircle2 className="h-4 w-4 text-[hsl(var(--success))]" /> {recibo.order_number} · {formatCurrency(recibo.total)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Estoque baixado, receita lançada e recebível quitado.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" className="gap-2" onClick={() => window.print()}>
                  <Printer className="h-4 w-4" /> Imprimir recibo
                </Button>
                <Button size="sm" variant="ghost" className="gap-2 text-muted-foreground" asChild>
                  <a href="/fiscal/plugnotas/emit">Emitir NFC-e</a>
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {recibo && (
        <div className="hidden print:block">
          <div className="mx-auto max-w-xs font-mono text-xs">
            <p className="text-center text-sm font-bold">{company?.name}</p>
            <p className="text-center">{recibo.quando}</p>
            <p className="mt-2 text-center font-semibold">RECIBO {recibo.order_number}</p>
            <hr className="my-2 border-black" />
            {recibo.itens.map((i, idx) => (
              <p key={idx} className="flex justify-between">
                <span>{i.quantidade}x {i.descricao}</span>
                <span>{formatCurrency(i.quantidade * i.unitario)}</span>
              </p>
            ))}
            <hr className="my-2 border-black" />
            <p className="flex justify-between font-bold">
              <span>TOTAL ({recibo.forma})</span>
              <span>{formatCurrency(recibo.total)}</span>
            </p>
            <p className="mt-3 text-center">Obrigado pela preferência!</p>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
