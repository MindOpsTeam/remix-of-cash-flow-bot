import { AppLayout } from "@/components/AppLayout";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Repeat, TrendingDown, Wallet, Users, RefreshCcw, ArrowUpRight, MessageSquare, Info } from "lucide-react";
import { Spinner, EmptyState } from "@viverdeia/design-system";
import { Badge } from "@/components/ui/badge";
import { LinhaDetalhe } from "@/components/detalhe/LinhaDetalhe";
import { KPICard } from "@/components/KPICard";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { formatCurrency } from "@/lib/utils";
import { MONTH_LABELS } from "@/lib/margin";
import {
  resumirMrr, resumirRecompra, ordenarRadar, ltvPorChurn, formatarIntervalo,
  RECOMPRA_STATUS, type MrrMes, type RecompraCliente,
} from "@/lib/recorrencia";
import {
  Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid,
} from "recharts";

const TOM_CLASS: Record<"good" | "warn" | "bad" | "muted", string> = {
  good: "border-[hsl(var(--success))]/30 bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]",
  warn: "border-[hsl(var(--warning))]/30 bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))]",
  bad: "border-[hsl(var(--destructive))]/30 bg-[hsl(var(--destructive))]/10 text-[hsl(var(--destructive))]",
  muted: "border-border bg-muted/60 text-muted-foreground",
};

function rotuloMes(iso: string): string {
  const [y, m] = iso.split("-");
  return `${MONTH_LABELS[Number(m) - 1]}/${y.slice(2)}`;
}

function dataBr(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y.slice(2)}`;
}

export default function RecorrenciaRecompra() {
  const { companies, scope } = useCompany();
  const ids = useMemo(
    () => (scope === "all" ? companies.map((c) => c.id) : companies.filter((c) => c.id === scope).map((c) => c.id)),
    [companies, scope],
  );
  const { data: mrrMeses = [], isLoading: loadingMrr } = useQuery<MrrMes[]>({
    queryKey: ["mrr-mov", ids.join(",")],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("v_mrr_movimentos")
        .select("mes, mrr_ativo, mrr_novo, mrr_perdido, contratos_novos, contratos_perdidos")
        .in("company_id", ids);
      if (error) throw error;
      // Consolida por mês (soma entre CNPJs do escopo).
      const porMes = new Map<string, MrrMes>();
      for (const r of (data ?? []) as MrrMes[]) {
        const mes = (r.mes as string).slice(0, 10);
        const acc = porMes.get(mes) ?? { mes, mrr_ativo: 0, mrr_novo: 0, mrr_perdido: 0, contratos_novos: 0, contratos_perdidos: 0 };
        acc.mrr_ativo += Number(r.mrr_ativo) || 0;
        acc.mrr_novo += Number(r.mrr_novo) || 0;
        acc.mrr_perdido += Number(r.mrr_perdido) || 0;
        acc.contratos_novos += Number(r.contratos_novos) || 0;
        acc.contratos_perdidos += Number(r.contratos_perdidos) || 0;
        porMes.set(mes, acc);
      }
      return [...porMes.values()].sort((a, b) => a.mes.localeCompare(b.mes));
    },
  });

  const { data: clientes = [], isLoading: loadingRec } = useQuery<RecompraCliente[]>({
    queryKey: ["recompra", ids.join(",")],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("v_recompra_clientes")
        .select("*")
        .in("company_id", ids);
      if (error) throw error;
      return (data ?? []) as RecompraCliente[];
    },
  });

  const mrr = useMemo(() => resumirMrr(mrrMeses), [mrrMeses]);
  const rec = useMemo(() => resumirRecompra(clientes), [clientes]);
  const radar = useMemo(() => ordenarRadar(clientes), [clientes]);
  const arpa = useMemo(() => {
    const ativos = mrrMeses.at(-1)?.contratos_novos; // aproximação simples
    return ativos && ativos > 0 ? mrr.mrrAtual / Math.max(1, clientes.filter((c) => c.tem_contrato).length || 1) : 0;
  }, [mrr, mrrMeses, clientes]);
  const ltv = ltvPorChurn(arpa || mrr.mrrAtual, mrr.churnPct);

  const serieMrr = mrrMeses.map((m) => ({ mes: rotuloMes(m.mes), MRR: m.mrr_ativo }));
  const isLoading = loadingMrr || loadingRec;

  return (
    <AppLayout>
      <div className="mb-6 animate-fade-in border-b border-border/70 pb-5">
        <div className="flex items-center gap-2">
          <Repeat className="h-5 w-5 text-primary" />
          <h1 className="font-display text-[28px] font-medium tracking-[-0.02em] text-foreground">Recorrência &amp; Recompra</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          A receita previsível do negócio: a saúde dos contratos (MRR) e o funil que transforma compra avulsa em recompra.
        </p>
      </div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center"><Spinner size="lg" label="Calculando recorrência" /></div>
      ) : (
        <>
          {/* ── MRR ── */}
          <div className="mb-3">
            <span className="via-eyebrow">Receita recorrente</span>
            <h2 className="mt-1 text-lg font-semibold tracking-[-0.02em] text-foreground">Saúde do MRR</h2>
          </div>
          <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KPICard label="MRR atual" value={mrr.mrrAtual} icon={<Repeat className="h-4 w-4" />} change={undefined} />
            <KPICard label="MRR novo (mês)" value={mrr.mrrNovoMes} icon={<ArrowUpRight className="h-4 w-4" />} change={undefined} valueTone="positive" />
            <KPICard label="Churn de MRR" value={mrr.churnPct} format="percentage" icon={<TrendingDown className="h-4 w-4" />} change={undefined} changeSuffix="p.p." valueTone={mrr.churnPct > 0 ? "negative" : "default"} />
            <KPICard label="LTV estimado" value={ltv ?? 0} icon={<Wallet className="h-4 w-4" />} change={undefined} />
          </div>

          <section className="via-chart-panel mb-8 p-4 sm:p-5">
            <div className="mb-3 flex items-baseline justify-between">
              <h3 className="text-sm font-semibold text-foreground">MRR nos últimos 12 meses</h3>
              <span className="text-xs text-muted-foreground">
                Net new no mês: <span className={mrr.netNewMes >= 0 ? "text-[hsl(var(--success))]" : "text-[hsl(var(--destructive))]"}>{formatCurrency(mrr.netNewMes)}</span>
              </span>
            </div>
            {serieMrr.some((s) => s.MRR > 0) ? (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={serieMrr} margin={{ top: 6, right: 8, left: 8, bottom: 0 }}>
                    <defs>
                      <linearGradient id="mrrFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--via-data-1)" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="var(--via-data-1)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="mes" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => formatCurrency(v)} width={70} />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} labelClassName="text-xs" contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Area type="monotone" dataKey="MRR" stroke="var(--via-data-1)" strokeWidth={2} fill="url(#mrrFill)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Nenhum contrato recorrente ainda. Cadastre contratos em{" "}
                <Link to="/contracts" className="text-primary underline">Contratos</Link> para acender o MRR.
              </p>
            )}
          </section>

          {/* ── Recompra ── */}
          <div className="mb-3 border-t border-border/70 pt-5">
            <span className="via-eyebrow">Funil de recompra</span>
            <h2 className="mt-1 text-lg font-semibold tracking-[-0.02em] text-foreground">Quem está na hora de comprar de novo</h2>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Info className="h-3.5 w-3.5" />
              A cadência vem do intervalo típico entre as compras avulsas de cada cliente.
            </p>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
            <StatChip label="Comprar agora" valor={rec.previstos} tom="good" />
            <StatChip label="Atrasados" valor={rec.atrasados} tom="warn" />
            <StatChip label="Perdidos" valor={rec.perdidos} tom="bad" />
            <StatChip label="Receita em jogo" valor={formatCurrency(rec.receitaEmJogo)} tom="good" />
            <StatChip label="Receita perdida" valor={formatCurrency(rec.receitaPerdida)} tom="bad" />
          </div>

          {radar.length === 0 ? (
            <EmptyState
              icon={<Users />}
              title="Sem histórico de compras avulsas"
              description="Quando os clientes começarem a comprar (Vendas), o radar de recompra aparece aqui."
            />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Cliente</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2 text-right">Compras</th>
                    <th className="px-3 py-2">Intervalo</th>
                    <th className="px-3 py-2">Última</th>
                    <th className="px-3 py-2">Próxima esperada</th>
                    <th className="px-3 py-2 text-right">Ticket médio</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {radar.map((c) => {
                    const st = RECOMPRA_STATUS[c.status];
                    const zap = (c.whatsapp ?? "").replace(/\D/g, "");
                    return (
                      <LinhaDetalhe tipo="contact" id={c.contact_id} key={c.contact_id} className="border-t border-border">
                        <td className="px-3 py-2 font-medium text-foreground">
                          {c.name}
                          {c.tem_contrato && <Badge variant="outline" className="ml-2 text-[10px]">já recorrente</Badge>}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${TOM_CLASS[st.tom]}`} title={st.acao}>
                            {st.label}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-xs">{c.n_compras}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{formatarIntervalo(c.intervalo_medio_dias)}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{dataBr(c.ultima_compra)}</td>
                        <td className="px-3 py-2 text-xs">{dataBr(c.proxima_esperada)}</td>
                        <td className="px-3 py-2 text-right font-mono text-xs">{c.ticket_medio != null ? formatCurrency(c.ticket_medio) : "—"}</td>
                        <td className="px-3 py-2">
                          {zap.length >= 10 && (c.status === "previsto" || c.status === "atrasado") ? (
                            <a
                              href={`https://wa.me/55${zap}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                            >
                              <MessageSquare className="h-3.5 w-3.5" /> Oferecer
                            </a>
                          ) : null}
                        </td>
                      </LinhaDetalhe>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-4 flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
            <RefreshCcw className="h-4 w-4 shrink-0 text-primary" />
            Ative o agente <strong className="text-foreground">Vigia de Recompra</strong> em{" "}
            <Link to="/agents" className="text-primary underline">Agentes</Link> para ser avisado todo dia de quem entrou na janela de recompra.
          </div>
        </>
      )}
    </AppLayout>
  );
}

function StatChip({ label, valor, tom }: { label: string; valor: number | string; tom: "good" | "warn" | "bad" | "muted" }) {
  return (
    <div className={`rounded-lg border p-3 ${TOM_CLASS[tom]}`}>
      <p className="text-[11px] font-medium uppercase tracking-wide opacity-80">{label}</p>
      <p className="mt-1 font-mono text-lg font-semibold">{valor}</p>
    </div>
  );
}
