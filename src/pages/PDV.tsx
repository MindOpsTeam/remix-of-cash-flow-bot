import { mensagemDeErro } from "@/lib/erros";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Banknote, CheckCircle2, Loader2, Minus, Plus, Printer, ShoppingCart, Trash2 } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@viverdeia/design-system";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { formatCurrency } from "@/lib/utils";
import { mapNfce, extractReformaMeta, deveDestacar, type NfceFormData } from "@/lib/plugnotas";

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
  ncm: string | null;
  cfop: string | null;
}

interface ItemCarrinho {
  produto: ProdutoPdv;
  quantidade: number;
}

/** Dia da LOJA (America/Sao_Paulo), nunca UTC: venda das 22h pertence a hoje. */
const dataLocalIso = () =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(new Date());

const FORMAS_PAGAMENTO = [
  { value: "dinheiro", label: "Dinheiro" },
  { value: "pix", label: "PIX" },
  { value: "cartao_credito", label: "Crédito" },
  { value: "cartao_debito", label: "Débito" },
];

interface Recibo {
  order_number: string;
  total: number;
  desconto: number;
  itens: Array<{ codigo: string; descricao: string; quantidade: number; unitario: number; ncm: string | null; cfop: string | null }>;
  forma: string;
  formaCodigo: string;
  quando: string;
}

/** Forma do PDV → código de pagamento da NFC-e (tabela PlugNotas). */
const FORMA_NFCE: Record<string, string> = {
  dinheiro: "01",
  pix: "17",
  cartao_credito: "03",
  cartao_debito: "04",
};

export default function PDV() {
  const { company } = useCompany();
  const [busca, setBusca] = useState("");
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);
  const [desconto, setDesconto] = useState<string>("");
  const [forma, setForma] = useState("dinheiro");
  const [finalizando, setFinalizando] = useState(false);
  const [recibo, setRecibo] = useState<Recibo | null>(null);
  const [emitindoNfce, setEmitindoNfce] = useState(false);
  const buscaRef = useRef<HTMLInputElement>(null);

  const nfceHabilitada = useQuery({
    queryKey: ["pdv_nfce", company?.id],
    enabled: !!company,
    staleTime: 300_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("plugnotas_config")
        .select("active, enabled_nfce")
        .eq("company_id", company!.id)
        .maybeSingle();
      const c = data as { active?: boolean; enabled_nfce?: boolean } | null;
      return !!c?.active && !!c?.enabled_nfce;
    },
  });

  // NFC-e nativa: o payload nasce dos itens da venda, sem redigitar nada.
  // Regras honestas: NCM obrigatório em todo item (lote fiscal resolve) e
  // venda com desconto emite pela tela fiscal — valor da nota nunca diverge.
  async function emitirNfce() {
    if (!company || !recibo) return;
    if (recibo.desconto > 0) {
      toast.error("Venda com desconto: emita pela tela fiscal para o valor da nota bater.");
      return;
    }
    const semNcm = recibo.itens.filter((i) => !/^\d{8}$/.test(i.ncm ?? ""));
    if (semNcm.length > 0) {
      toast.error(`${semNcm.length} item(ns) sem NCM válido. Resolva em Produtos → Pronto para agosto.`);
      return;
    }
    setEmitindoNfce(true);
    try {
      const dados: NfceFormData = {
        emitenteCnpj: company.cnpj ?? "",
        naturezaOperacao: "Venda ao consumidor",
        destinatario: { cpfCnpj: "", razaoSocial: "Consumidor não identificado" },
        itens: recibo.itens.map((i) => ({
          codigo: i.codigo,
          descricao: i.descricao,
          ncm: i.ncm!,
          cfop: i.cfop ?? "5102",
          unidade: "UN",
          quantidade: i.quantidade,
          valorUnitario: i.unitario,
        })),
        consumidorFinal: true,
        formaPagamento: recibo.formaCodigo,
        valorPago: recibo.total,
      };

      const { data: invoice, error: invErr } = await supabase
        .from("invoices")
        .insert({ company_id: company.id, type: "nfce", status: "draft", total: recibo.total } as never)
        .select("id")
        .single();
      if (invErr) throw new Error(invErr.message);

      const reformaOpts = deveDestacar(company.regimeTributario, "nfce")
        ? { cClassTrib: company.cclasstribPadrao ?? undefined }
        : null;
      const payload = mapNfce(dados, reformaOpts);
      const { data: result, error } = await supabase.functions.invoke("plugnotas-nfce", {
        body: {
          company_id: company.id,
          operation: "emitir",
          params: payload,
          invoice_id: (invoice as { id: string }).id,
          reforma: extractReformaMeta(payload),
        },
      });
      if (error) throw new Error(error.message);
      if ((result as { ok?: boolean })?.ok) {
        toast.success("NFC-e enviada — acompanhe a autorização na tela fiscal.");
      } else {
        await supabase.from("invoices").update({ status: "denied" } as never).eq("id", (invoice as { id: string }).id);
        throw new Error("A SEFAZ recusou o envio. Confira os dados fiscais na tela de emissão.");
      }
    } catch (e) {
      toast.error("NFC-e não emitida: " + mensagemDeErro(e));
    } finally {
      setEmitindoNfce(false);
    }
  }

  const produtos = useQuery({
    queryKey: ["pdv_products", company?.id],
    enabled: !!company,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, sku, barcode, sell_price, track_stock, current_stock, type, ncm, cfop")
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
        desconto: descontoNum,
        itens: carrinho.map((i) => ({
          codigo: i.produto.sku ?? i.produto.barcode ?? i.produto.id,
          descricao: i.produto.name,
          quantidade: i.quantidade,
          unitario: i.produto.sell_price,
          ncm: i.produto.ncm,
          cfop: i.produto.cfop,
        })),
        forma: FORMAS_PAGAMENTO.find((f) => f.value === forma)?.label ?? forma,
        formaCodigo: FORMA_NFCE[forma] ?? "99",
        quando: new Date().toLocaleString("pt-BR"),
      });
      setCarrinho([]);
      setDesconto("");
      produtos.refetch();
      toast.success(`Venda ${r.order_number} registrada: ${formatCurrency(r.total)}.`);
    } catch (e) {
      toast.error("Venda não registrada: " + mensagemDeErro(e));
    } finally {
      setFinalizando(false);
    }
  }

  // Fechamento de turno lite: o dia do caixa por forma de pagamento, mais
  // sangria/suprimento como lançamentos confirmados rastreáveis (source pdv).
  const turno = useQuery({
    queryKey: ["pdv_turno", company?.id],
    enabled: !!company,
    staleTime: 30_000,
    queryFn: async () => {
      const hoje = dataLocalIso();
      const { data } = await supabase
        .from("transactions")
        .select("amount, type, payment_method, description")
        .eq("company_id", company!.id)
        .eq("source", "pdv")
        .eq("date", hoje);
      const rows = (data ?? []) as Array<{ amount: number; type: string; payment_method: string | null; description: string }>;
      const vendas = rows.filter((r) => r.type === "revenue" && !r.description.startsWith("Suprimento"));
      const porForma = new Map<string, number>();
      for (const v of vendas) {
        const chave = FORMAS_PAGAMENTO.find((f) => f.value === v.payment_method)?.label ?? v.payment_method ?? "Outros";
        porForma.set(chave, (porForma.get(chave) ?? 0) + Number(v.amount));
      }
      const sangrias = rows.filter((r) => r.description.startsWith("Sangria")).reduce((s, r) => s + Number(r.amount), 0);
      const suprimentos = rows.filter((r) => r.description.startsWith("Suprimento")).reduce((s, r) => s + Number(r.amount), 0);
      return {
        totalVendas: vendas.reduce((s, v) => s + Number(v.amount), 0),
        qtdVendas: vendas.length,
        porForma: [...porForma.entries()],
        sangrias,
        suprimentos,
      };
    },
  });

  // Movimento de caixa com auditoria mínima: valor + motivo, sem prompt
  // nativo (quebra em kiosk/webview e não deixa rastro do porquê).
  const [movimento, setMovimento] = useState<"sangria" | "suprimento" | null>(null);
  const [movimentoValor, setMovimentoValor] = useState("");
  const [movimentoMotivo, setMovimentoMotivo] = useState("");

  async function confirmarMovimento() {
    if (!company || !movimento) return;
    const valor = Number(movimentoValor.replace(",", "."));
    if (!Number.isFinite(valor) || valor <= 0) {
      toast.error("Valor inválido.");
      return;
    }
    const { data: sessao } = await supabase.auth.getUser();
    const rotulo = movimento === "sangria" ? "Sangria de caixa (PDV)" : "Suprimento de caixa (PDV)";
    const { error } = await supabase.from("transactions").insert({
      company_id: company.id,
      user_id: sessao.user?.id,
      date: dataLocalIso(),
      description: movimentoMotivo.trim() ? `${rotulo}: ${movimentoMotivo.trim()}` : rotulo,
      amount: valor,
      type: movimento === "sangria" ? "expense" : "revenue",
      status: "confirmed",
      source: "pdv",
      payment_method: "dinheiro",
    } as never);
    if (error) toast.error("Não registrei: " + mensagemDeErro(error));
    else {
      toast.success(movimento === "sangria" ? "Sangria registrada." : "Suprimento registrado.");
      setMovimento(null);
      setMovimentoValor("");
      setMovimentoMotivo("");
      turno.refetch();
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

          {turno.data && (turno.data.qtdVendas > 0 || turno.data.sangrias > 0 || turno.data.suprimentos > 0) && (
            <div className="mt-4 rounded-lg border border-border bg-card p-4 print-hide">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Turno de hoje</p>
                <span className="font-mono text-sm font-bold">{formatCurrency(turno.data.totalVendas)}</span>
              </div>
              <div className="space-y-1">
                {turno.data.porForma.map(([forma, valor]) => (
                  <div key={forma} className="flex justify-between text-xs text-muted-foreground">
                    <span>{forma} · {turno.data!.qtdVendas} venda(s)</span>
                    <span className="font-mono">{formatCurrency(valor)}</span>
                  </div>
                ))}
                {turno.data.suprimentos > 0 && (
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Suprimentos</span>
                    <span className="font-mono">+{formatCurrency(turno.data.suprimentos)}</span>
                  </div>
                )}
                {turno.data.sangrias > 0 && (
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Sangrias</span>
                    <span className="font-mono">−{formatCurrency(turno.data.sangrias)}</span>
                  </div>
                )}
              </div>
              <div className="mt-2 flex gap-2">
                <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" onClick={() => setMovimento("sangria")}>
                  Sangria
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" onClick={() => setMovimento("suprimento")}>
                  Suprimento
                </Button>
              </div>
              <Dialog open={movimento !== null} onOpenChange={(v) => !v && setMovimento(null)}>
                <DialogContent className="max-w-xs">
                  <DialogHeader>
                    <DialogTitle>{movimento === "sangria" ? "Sangria de caixa" : "Suprimento de caixa"}</DialogTitle>
                    <DialogDescription>
                      {movimento === "sangria" ? "Retirada de dinheiro do caixa." : "Entrada de troco/reforço no caixa."}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3">
                    <Input
                      inputMode="decimal"
                      placeholder="Valor (R$)"
                      value={movimentoValor}
                      onChange={(e) => setMovimentoValor(e.target.value.replace(/[^\d.,]/g, ""))}
                      aria-label="Valor do movimento"
                      autoFocus
                    />
                    <Input
                      placeholder="Motivo (ex.: depósito no banco, troco)"
                      value={movimentoMotivo}
                      onChange={(e) => setMovimentoMotivo(e.target.value)}
                      aria-label="Motivo do movimento"
                    />
                    <Button className="w-full" onClick={confirmarMovimento} disabled={!movimentoValor}>
                      Registrar
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          )}

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
                {nfceHabilitada.data ? (
                  <Button size="sm" variant="outline" className="gap-2" onClick={emitirNfce} disabled={emitindoNfce}>
                    {emitindoNfce ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Emitir NFC-e
                  </Button>
                ) : (
                  <Button size="sm" variant="ghost" className="gap-2 text-muted-foreground" asChild>
                    <a href="/settings/integrations/plugnotas">Habilitar NFC-e</a>
                  </Button>
                )}
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
