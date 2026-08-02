import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowDownToLine, CheckCircle2, ChevronDown, Loader2, RefreshCw } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { useSomenteLeitura } from "@/hooks/useSomenteLeitura";
import { mensagemDeErro } from "@/lib/erros";
import { formatCurrency } from "@/lib/utils";

/**
 * Repasses do gateway — a conciliação que a régua 1:1 não consegue fazer.
 *
 * O crédito da maquininha/gateway cai no banco LÍQUIDO e em LOTE: N vendas menos
 * as taxas viram um depósito só. Procurar no extrato um crédito de valor igual ao
 * de uma venda nunca acha nada, e é por isso que esse dinheiro costuma ficar
 * pendurado. Aqui o lote é aberto: quantas cobranças, quanto de bruto, quanto de
 * taxa, quanto sobrou — e só com a composição fechando é que a conciliação corre.
 *
 * O que a tela deixa explícito, porque é onde o erro contábil mora: o depósito
 * NÃO é receita. A receita já entrou pelo bruto quando cada cobrança foi paga.
 * Conciliar aqui marca o crédito como transferência e lança a taxa como despesa.
 */

interface Canal {
  id: string;
  apelido: string;
  secret_key_preview: string | null;
  conta_taxa_id: string | null;
  centro_custo_taxa_id: string | null;
}

interface Repasse {
  id: string;
  stripe_id: string;
  config_id: string | null;
  canal: string | null;
  status: string | null;
  arrival_date: string | null;
  itens: number;
  amount_bruto: number;
  amount_taxa: number;
  amount_liquido: number;
  composicao_fecha: boolean;
  diferenca: number;
  conciliado_em: string | null;
  creditado_no_extrato: boolean;
  cobrancas_ligadas: number;
}

interface Cobranca {
  id: string;
  stripe_id: string;
  description: string | null;
  customer_email: string | null;
  amount_bruto: number;
  amount_taxa: number;
  amount_liquido: number;
  paid_at: string | null;
  transaction_id: string | null;
}

/** Centavos do gateway → reais, para exibição. */
const emReais = (centavos: number) => formatCurrency(centavos / 100);

export default function Repasses() {
  const { company } = useCompany();
  const companyId = company?.id ?? null;
  const somenteLeitura = useSomenteLeitura();
  const queryClient = useQueryClient();
  const [sincronizando, setSincronizando] = useState(false);
  const [conciliando, setConciliando] = useState<string | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);
  // Uma empresa pode ter N canais Stripe. Sem escolher, sincronizar e conciliar
  // seriam ambíguos — e ambiguidade aqui move dinheiro na conta errada.
  const [canalId, setCanalId] = useState<string | null>(null);

  const { data: canais, isPending: configCarregando } = useQuery({
    queryKey: ["stripe-canais", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stripe_config")
        .select("id, apelido, secret_key_preview, conta_taxa_id, centro_custo_taxa_id")
        .eq("company_id", companyId!)
        .order("apelido");
      if (error) throw error;
      return (data ?? []) as Canal[];
    },
  });

  // Com um canal só, ele é o escolhido sem perguntar nada.
  const canalAtivo = useMemo(() => {
    const lista = canais ?? [];
    if (lista.length === 0) return null;
    return lista.find((c) => c.id === canalId) ?? (lista.length === 1 ? lista[0] : null);
  }, [canais, canalId]);

  const { data: repasses, isLoading } = useQuery({
    queryKey: ["stripe-repasses", companyId, canalAtivo?.id ?? "todos"],
    enabled: !!companyId,
    queryFn: async () => {
      let q = supabase
        .from("v_stripe_repasses")
        .select("*")
        .eq("company_id", companyId!);
      // Sem canal escolhido (empresa com vários), mostra todos e identifica cada
      // um pelo nome — ver o conjunto ajuda; agir sobre ele exige escolher.
      if (canalAtivo) q = q.eq("config_id", canalAtivo.id);
      const { data, error } = await q
        .order("arrival_date", { ascending: false, nullsFirst: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as Repasse[];
    },
  });

  const { data: cobrancas } = useQuery({
    queryKey: ["stripe-cobrancas", companyId, aberto],
    enabled: !!companyId && !!aberto,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stripe_charges")
        .select("id, stripe_id, description, customer_email, amount_bruto, amount_taxa, amount_liquido, paid_at, transaction_id")
        .eq("company_id", companyId!)
        .eq("payout_id", aberto!)
        .order("paid_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Cobranca[];
    },
  });

  const resumo = useMemo(() => {
    const lista = repasses ?? [];
    return {
      pendentes: lista.filter((r) => !r.conciliado_em).length,
      travados: lista.filter((r) => !r.composicao_fecha).length,
      taxaTotal: lista.reduce((s, r) => s + r.amount_taxa, 0),
    };
  }, [repasses]);

  const configurado = (canais ?? []).some((c) => c.secret_key_preview);
  const varios = (canais ?? []).length > 1;
  const faltaContaDaTaxa =
    !!canalAtivo && (!canalAtivo.conta_taxa_id || !canalAtivo.centro_custo_taxa_id);

  async function sincronizar() {
    if (!companyId) return;
    setSincronizando(true);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-api", {
        body: { action: "sincronizar", company_id: companyId, dias: 60, config_id: canalAtivo?.id },
      });
      if (error) throw error;
      const r = data as { repasses?: number; cobrancas?: number; nao_fecham?: number; error?: string };
      if (r?.error) throw new Error(r.error);
      const alerta = r?.nao_fecham ? ` ${r.nao_fecham} não fecham e não podem ser conciliados ainda.` : "";
      toast.success(`${r?.repasses ?? 0} repasses e ${r?.cobrancas ?? 0} cobranças atualizados.${alerta}`);
      queryClient.invalidateQueries({ queryKey: ["stripe-repasses", companyId, canalAtivo?.id ?? "todos"] });
    } catch (e) {
      toast.error(mensagemDeErro(e));
    } finally {
      setSincronizando(false);
    }
  }

  async function conciliar(stripeId: string, configId: string | null) {
    if (!companyId) return;
    setConciliando(stripeId);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-api", {
        body: { action: "conciliar", company_id: companyId, payout_id: stripeId, config_id: configId },
      });
      if (error) throw error;
      const r = data as { ok?: boolean; status?: string; mensagem?: string; error?: string };
      if (r?.error) throw new Error(r.error);
      if (r?.ok) toast.success(r.mensagem ?? "Repasse conciliado.");
      // Duplicidade e "não fecha" não são falha de sistema: são pendência real
      // que a pessoa precisa ver por inteiro, não um toast de erro genérico.
      else toast.warning(r?.mensagem ?? "Não foi possível conciliar.", { duration: 10000 });
      queryClient.invalidateQueries({ queryKey: ["stripe-repasses", companyId, canalAtivo?.id ?? "todos"] });
    } catch (e) {
      toast.error(mensagemDeErro(e));
    } finally {
      setConciliando(null);
    }
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <h1 className="text-2xl font-semibold tracking-tight">Repasses do gateway</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              O depósito do cartão chega líquido e em lote. Aqui ele é aberto em quantas cobranças o
              compõem, quanto foi taxa e quanto sobrou — e a conciliação casa o lote inteiro com uma
              linha só do extrato.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Só aparece quando há escolha a fazer. Com um canal, perguntar seria
                ruído; com vários, não perguntar seria adivinhar. */}
            {varios && (
              <select
                aria-label="Canal do Stripe"
                value={canalAtivo?.id ?? ""}
                onChange={(e) => setCanalId(e.target.value || null)}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="">Todos os canais (só leitura)</option>
                {(canais ?? []).map((c) => (
                  <option key={c.id} value={c.id}>{c.apelido}</option>
                ))}
              </select>
            )}
            <Button
              onClick={sincronizar}
              disabled={sincronizando || !configurado || !canalAtivo || somenteLeitura.bloqueado}
              title={!canalAtivo && varios ? "Escolha um canal para sincronizar." : undefined}
            >
              {sincronizando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Sincronizar
            </Button>
          </div>
        </header>

        {/* Só afirma "não está ligado" depois de saber. Enquanto a consulta corre,
            esse aviso apareceria e sumiria — piscando uma informação errada para
            quem tem o Stripe configurado. */}
        {!configurado && !configCarregando && (
          <div className="rounded-lg border border-dashed p-6 text-sm">
            <p className="font-medium">O Stripe ainda não está ligado nesta empresa.</p>
            <p className="mt-1 text-muted-foreground">
              Vá em Configurações → Integrações, escolha Stripe e informe a chave secreta. Sem o
              segredo do webhook o recebimento até aparece, mas não baixa o título sozinho.
            </p>
          </div>
        )}

        {faltaContaDaTaxa && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div>
              <p className="font-medium">A conta contábil da taxa não está definida.</p>
              <p className="text-muted-foreground">
                A conciliação vai rodar, mas a taxa não será lançada como despesa — e o lucro fica
                maior do que é, exatamente no valor das taxas.
              </p>
            </div>
          </div>
        )}

        {configurado && (
          <div className="grid gap-3 sm:grid-cols-3">
            <Indicador titulo="Repasses a conciliar" valor={String(resumo.pendentes)} />
            <Indicador
              titulo="Lotes que não fecham"
              valor={String(resumo.travados)}
              alerta={resumo.travados > 0}
              nota={resumo.travados > 0 ? "Sincronize de novo: falta cobrança no lote." : undefined}
            />
            <Indicador titulo="Taxa no período" valor={emReais(resumo.taxaTotal)} />
          </div>
        )}

        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando repasses…
          </div>
        )}

        {configurado && !isLoading && (repasses ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nenhum repasse ainda. Clique em Sincronizar para buscar os últimos 60 dias.
          </p>
        )}

        <div className="space-y-3">
          {(repasses ?? []).map((r) => {
            const expandido = aberto === r.stripe_id;
            return (
              <article key={r.id} className="overflow-hidden rounded-lg border">
                <div className="flex flex-wrap items-center justify-between gap-4 p-4">
                  <button
                    type="button"
                    onClick={() => setAberto(expandido ? null : r.stripe_id)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    aria-expanded={expandido}
                  >
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${expandido ? "rotate-180" : ""}`}
                    />
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {emReais(r.amount_liquido)}
                        <span className="ml-2 text-sm font-normal text-muted-foreground">
                          {r.itens} {r.itens === 1 ? "cobrança" : "cobranças"}
                        </span>
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {varios && r.canal ? `${r.canal} · ` : ""}
                        {r.arrival_date ?? "sem data"} · bruto {emReais(r.amount_bruto)} · taxa{" "}
                        {emReais(r.amount_taxa)} · {r.stripe_id}
                      </p>
                    </div>
                  </button>

                  <div className="flex items-center gap-2">
                    {!r.composicao_fecha && (
                      <Badge variant="destructive" className="gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        falta {emReais(Math.abs(r.diferenca))}
                      </Badge>
                    )}
                    {r.conciliado_em ? (
                      <Badge variant="secondary" className="gap-1">
                        <CheckCircle2 className="h-3 w-3" /> conciliado
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => conciliar(r.stripe_id, r.config_id)}
                        disabled={
                          conciliando === r.stripe_id || !r.composicao_fecha ||
                          somenteLeitura.bloqueado || (varios && !canalAtivo)
                        }
                        title={
                          somenteLeitura.bloqueado
                            ? somenteLeitura.motivo
                            : !r.composicao_fecha
                              ? "A soma das cobranças não reproduz o valor do repasse."
                              : "Casar este lote com o crédito no extrato"
                        }
                      >
                        {conciliando === r.stripe_id ? (
                          <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                        ) : (
                          <ArrowDownToLine className="mr-2 h-3 w-3" />
                        )}
                        Conciliar
                      </Button>
                    )}
                  </div>
                </div>

                {expandido && (
                  <div className="border-t bg-muted/30 p-4">
                    <p className="mb-3 text-xs text-muted-foreground">
                      Este depósito não é receita: a receita destas cobranças já entrou pelo bruto
                      quando cada uma foi paga. Conciliar marca o crédito como transferência e lança{" "}
                      {emReais(r.amount_taxa)} de taxa como despesa.
                    </p>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[36rem] text-sm">
                        <thead>
                          <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                            <th className="py-2 pr-4 font-medium">Cobrança</th>
                            <th className="py-2 pr-4 text-right font-medium">Bruto</th>
                            <th className="py-2 pr-4 text-right font-medium">Taxa</th>
                            <th className="py-2 text-right font-medium">Líquido</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(cobrancas ?? []).map((c) => (
                            <tr key={c.id} className="border-t">
                              <td className="py-2 pr-4">
                                <span className="block truncate">{c.description ?? c.stripe_id}</span>
                                <span className="block text-xs text-muted-foreground">
                                  {c.customer_email ?? "sem e-mail"} ·{" "}
                                  {c.transaction_id ? "receita lançada" : "sem lançamento"}
                                </span>
                              </td>
                              <td className="py-2 pr-4 text-right tabular-nums">{emReais(c.amount_bruto)}</td>
                              <td className="py-2 pr-4 text-right tabular-nums text-muted-foreground">
                                {emReais(c.amount_taxa)}
                              </td>
                              <td className="py-2 text-right tabular-nums">{emReais(c.amount_liquido)}</td>
                            </tr>
                          ))}
                          {(cobrancas ?? []).length === 0 && (
                            <tr>
                              <td colSpan={4} className="py-3 text-muted-foreground">
                                As cobranças deste lote ainda não foram sincronizadas.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}

function Indicador({
  titulo,
  valor,
  nota,
  alerta,
}: {
  titulo: string;
  valor: string;
  nota?: string;
  alerta?: boolean;
}) {
  return (
    <div className={`rounded-lg border p-4 ${alerta ? "border-amber-500/40 bg-amber-500/5" : ""}`}>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{titulo}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{valor}</p>
      {nota && <p className="mt-1 text-xs text-muted-foreground">{nota}</p>}
    </div>
  );
}
