import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  ArrowLeft, ArrowUpRight, Calendar, ExternalLink, FileText, Loader2, Receipt, User, Link2,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { formatCurrency } from "@/lib/utils";
import {
  REGISTROS, valorNoCaminho, rotularValor, type TipoRegistro,
} from "@/lib/detalhe-registro";
import { useDetalhe, type ReferenciaRegistro } from "./DetalheProvider";

type Registro = Record<string, unknown>;

function formatarData(v: unknown): string {
  if (!v) return "—";
  const iso = String(v).slice(0, 10);
  const [y, m, d] = iso.split("-");
  return y && m && d ? `${d}/${m}/${y}` : String(v);
}

function formatarDataHora(v: unknown): string {
  if (!v) return "—";
  const dt = new Date(String(v));
  if (Number.isNaN(dt.getTime())) return String(v);
  return dt.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatar(valor: unknown, formato?: string): string {
  if (valor === null || valor === undefined || valor === "") return "—";
  switch (formato) {
    case "moeda": return formatCurrency(Number(valor) || 0);
    case "data": return formatarData(valor);
    case "datahora": return formatarDataHora(valor);
    case "percentual": return `${Number(valor).toFixed(1)}%`;
    case "numero": return String(valor);
    case "status": return rotularValor(valor);
    default: return String(valor);
  }
}

/** Documento que dá para mostrar aqui dentro em vez de mandar para outra aba. */
function ehImagem(url: string): boolean {
  return url.startsWith("data:image/") || /\.(png|jpe?g|webp|gif|svg)$/i.test(url.split("?")[0]);
}

/** Relacionados de cada tipo: é isso que torna a navegação encadeada. */
function relacionados(tipo: TipoRegistro, r: Registro): ReferenciaRegistro[] {
  const refs: ReferenciaRegistro[] = [];
  const add = (t: TipoRegistro, id: unknown, rotulo: string) => {
    if (id) refs.push({ tipo: t, id: String(id), rotulo });
  };
  switch (tipo) {
    case "transaction":
      add("contact", r.contact_id, "Cliente / fornecedor");
      add("account", r.account_id, "Conta contábil");
      add("cost_center", r.cost_center_id, "Centro de custo");
      break;
    case "receivable":
      add("contact", r.contact_id, "Cliente");
      add("transaction", r.transaction_id, "Lançamento gerado");
      add("contract", r.contract_id, "Contrato de origem");
      add("sales_order", r.sales_order_id, "Pedido de origem");
      break;
    case "bill":
      add("contact", r.contact_id, "Fornecedor");
      break;
    case "contract":
      add("contact", r.contact_id, "Cliente");
      break;
    case "sales_order":
    case "purchase_order":
      add("contact", r.contact_id, "Cliente / fornecedor");
      break;
    case "bank_raw":
      add("transaction", r.transaction_id, "Lançamento gerado");
      break;
    default:
      break;
  }
  return refs;
}

export function DetalheRegistroDialog() {
  const { pilha, fechar, voltar, abrirDetalhe } = useDetalhe();
  const { company } = useCompany();
  const atual = pilha[pilha.length - 1] ?? null;
  const def = atual ? REGISTROS[atual.tipo] : null;

  const { data: registro, isLoading, error } = useQuery<Registro | null>({
    queryKey: ["detalhe", atual?.tipo, atual?.id],
    enabled: !!atual && !!def,
    queryFn: async () => {
      const { data, error } = await supabase
        .from(def!.tabela as never)
        .select(def!.select)
        .eq("id", atual!.id)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as Registro | null;
    },
  });

  // "Por quem": resolvido pelos membros da empresa (RPC que não expõe auth.users).
  const { data: autores = [] } = useQuery<Array<{ user_id: string; nome: string; email: string }>>({
    queryKey: ["autores", company?.id],
    enabled: !!company,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await (
        supabase.rpc as unknown as (n: string, a: Record<string, unknown>) => Promise<{ data: Array<{ user_id: string; nome: string; email: string }> | null }>
      )("autores_da_empresa", { p_company_id: company!.id });
      return data ?? [];
    },
  });

  // Composição: conta, centro de custo e contato ganham a lista de lançamentos
  // que os alimentam — é o drill-down que transforma um número em explicação.
  const campoFiltro: Record<string, string> = {
    account: "account_id",
    cost_center: "cost_center_id",
    contact: "contact_id",
  };
  const filtro = atual ? campoFiltro[atual.tipo] : undefined;

  const { data: composicao = [] } = useQuery<Array<{ id: string; description: string; amount: number; date: string; type: string }>>({
    queryKey: ["detalhe-composicao", atual?.tipo, atual?.id],
    enabled: !!atual && !!filtro,
    queryFn: async () => {
      const { data } = await supabase
        .from("transactions")
        .select("id, description, amount, date, type")
        .eq(filtro!, atual!.id)
        .in("status", ["confirmed", "reconciled"])
        .order("date", { ascending: false })
        .limit(8);
      return (data ?? []) as Array<{ id: string; description: string; amount: number; date: string; type: string }>;
    },
  });

  if (!atual || !def) return null;

  const titulo = registro ? String(valorNoCaminho(registro, def.campoTitulo) ?? def.titulo) : def.titulo;
  const valorDestaque = def.campoValor && registro ? valorNoCaminho(registro, def.campoValor) : null;
  const documento = def.campoDocumento && registro ? valorNoCaminho(registro, def.campoDocumento) : null;
  const autorId = registro?.user_id ? String(registro.user_id) : null;
  const autor = autorId ? autores.find((a) => a.user_id === autorId) : null;
  const criadoEm = registro?.created_at;
  const refs = registro ? relacionados(atual.tipo, registro) : [];

  const camposVisiveis = def.campos.filter((c) => {
    if (!registro) return false;
    const v = valorNoCaminho(registro, c.key);
    return !(c.ocultarSeVazio && (v === null || v === undefined || v === ""));
  });

  return (
    <Dialog open onOpenChange={(o) => !o && fechar()}>
      <DialogContent className="max-h-[92vh] w-[calc(100vw-1.5rem)] max-w-2xl overflow-y-auto p-0 sm:w-full">
        <DialogHeader className="space-y-0 border-b border-border px-5 py-4">
          <div className="pr-8">
            <div className="min-w-0">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                {pilha.length > 1 && (
                  <Button variant="ghost" size="sm" className="-ml-2 h-7 gap-1 px-2 text-xs" onClick={voltar}>
                    <ArrowLeft className="h-3.5 w-3.5" /> Voltar
                  </Button>
                )}
                <Badge variant="outline" className="text-[10px] uppercase tracking-wide">{def.titulo}</Badge>
              </div>
              <DialogTitle className="truncate text-base font-semibold">{titulo}</DialogTitle>
              {valorDestaque != null && (
                <p className="mt-1 font-mono text-xl font-semibold tracking-[-0.03em] text-foreground">
                  {formatCurrency(Number(valorDestaque) || 0)}
                </p>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 px-5 py-4">
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : error || !registro ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Não foi possível carregar este registro. Ele pode ter sido removido.
            </p>
          ) : (
            <>
              {/* Rastro: quem lançou e quando */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5" />
                  {autor ? (
                    <>Lançado por <strong className="font-medium text-foreground">{autor.nome}</strong></>
                  ) : autorId ? (
                    "Lançado por um usuário desta empresa"
                  ) : (
                    "Registro gerado pelo sistema"
                  )}
                </span>
                {criadoEm ? (
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    {formatarDataHora(criadoEm)}
                  </span>
                ) : null}
              </div>

              {/* Documento original: imagem aparece aqui mesmo; o resto abre fora. */}
              {documento ? (
                ehImagem(String(documento)) ? (
                  <figure className="overflow-hidden rounded-md border border-border">
                    <figcaption className="flex items-center gap-2 border-b border-border bg-muted/40 px-3 py-2 text-xs font-medium text-foreground">
                      <FileText className="h-3.5 w-3.5 text-primary" /> Documento original
                    </figcaption>
                    <img
                      src={String(documento)}
                      alt="Documento original do registro"
                      className="max-h-72 w-full bg-white object-contain"
                      loading="lazy"
                    />
                  </figure>
                ) : (
                  <a
                    href={String(documento)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-md border border-primary/25 bg-primary/5 px-3 py-2.5 text-sm text-primary transition-colors hover:bg-primary/10"
                  >
                    <FileText className="h-4 w-4 shrink-0" />
                    Abrir documento original
                    <ExternalLink className="ml-auto h-3.5 w-3.5" />
                  </a>
                )
              ) : null}

              {/* Campos */}
              <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                {camposVisiveis.map((c) => (
                  <div key={c.key} className="min-w-0">
                    <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{c.label}</dt>
                    <dd className="mt-0.5 break-words text-sm text-foreground">
                      {formatar(valorNoCaminho(registro, c.key), c.formato)}
                    </dd>
                  </div>
                ))}
              </dl>

              {/* Composição: de onde vem o número */}
              {composicao.length > 0 && (
                <div className="border-t border-border pt-3">
                  <p className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    <Receipt className="h-3.5 w-3.5" /> Lançamentos recentes
                  </p>
                  <ul className="divide-y divide-border overflow-hidden rounded-md border border-border">
                    {composicao.map((t) => (
                      <li key={t.id}>
                        <button
                          onClick={() => abrirDetalhe({ tipo: "transaction", id: t.id })}
                          className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition-colors hover:bg-muted/50"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-xs text-foreground">{t.description}</span>
                            <span className="text-[11px] text-muted-foreground">{formatarData(t.date)}</span>
                          </span>
                          <span className={`shrink-0 font-mono text-xs ${t.type === "revenue" ? "text-revenue" : "text-expense"}`}>
                            {formatCurrency(Number(t.amount) || 0)}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Navegação encadeada: nada é beco sem saída */}
              {refs.length > 0 && (
                <div className="border-t border-border pt-3">
                  <p className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    <Link2 className="h-3.5 w-3.5" /> Registros ligados
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {refs.map((r) => (
                      <button
                        key={`${r.tipo}-${r.id}`}
                        onClick={() => abrirDetalhe(r)}
                        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5"
                      >
                        {r.rotulo}
                        <ArrowUpRight className="h-3 w-3 opacity-60" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {def.rotaLista && (
          <div className="border-t border-border px-5 py-3">
            <Link
              to={def.rotaLista}
              onClick={fechar}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              Ver todos em {def.titulo.toLowerCase()} <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
