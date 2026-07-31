import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { ChartPanel, ChartEmptyState } from "@/components/bi/ChartPanel";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/utils";
import {
  METRICA_POR_KEY,
  serieMensal,
  seriePorEmpresa,
  seriePorVencimento,
  type PontoBI,
  type WidgetConfig,
} from "@/lib/bi-catalog";

/**
 * Renderiza uma visão criada pelo cliente. A config já chegou validada pelo
 * zod no builder; aqui é só buscar a série da dimensão pedida e desenhar com
 * a mesma linguagem visual dos gráficos nativos do cockpit.
 */
export interface DashboardWidget {
  id: string;
  titulo: string;
  config: WidgetConfig;
  posicao: number;
}

interface CustomWidgetProps {
  widget: DashboardWidget;
  scopedIds: string[];
  nomesEmpresas: Record<string, string>;
  onRemove: (id: string) => void;
  onMove: (id: string, direcao: -1 | 1) => void;
  podeMover: { cima: boolean; baixo: boolean };
}

function useWidgetData(config: WidgetConfig, scopedIds: string[], nomesEmpresas: Record<string, string>) {
  return useQuery<PontoBI[]>({
    queryKey: ["bi-widget", JSON.stringify(config), scopedIds.join(",")],
    enabled: scopedIds.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const hoje = new Date().toISOString().slice(0, 10);
      const mesAtual = `${hoje.slice(0, 7)}-01`;

      if (config.dimensao === "tempo" && ["receita", "custos", "despesas", "resultado", "margem_operacional"].includes(config.metrica)) {
        const desde = new Date();
        desde.setDate(1);
        desde.setMonth(desde.getMonth() - (config.meses - 1));
        const { data, error } = await supabase
          .from("v_company_margin")
          .select("month, receita, custos, despesas")
          .in("company_id", scopedIds)
          .gte("month", desde.toISOString().slice(0, 10));
        if (error) throw error;
        return serieMensal(
          (data ?? []).map((r) => ({
            month: String(r.month),
            receita: Number(r.receita) || 0,
            custos: Number(r.custos) || 0,
            despesas: Number(r.despesas) || 0,
          })),
          config.metrica,
        );
      }

      if (config.dimensao === "empresa") {
        const desde = new Date();
        desde.setDate(1);
        desde.setMonth(desde.getMonth() - (config.meses - 1));
        const { data, error } = await supabase
          .from("v_company_margin")
          .select("company_id, receita, custos, despesas")
          .in("company_id", scopedIds)
          .gte("month", desde.toISOString().slice(0, 10));
        if (error) throw error;
        return seriePorEmpresa(
          (data ?? []).map((r) => ({
            company_id: String(r.company_id),
            receita: Number(r.receita) || 0,
            custos: Number(r.custos) || 0,
            despesas: Number(r.despesas) || 0,
          })),
          config.metrica,
          nomesEmpresas,
        );
      }

      if (config.metrica === "despesa_centro_custo") {
        const { data, error } = await supabase
          .from("v_centro_custo_mes")
          .select("centro_nome, total")
          .in("company_id", scopedIds)
          .eq("mes", mesAtual)
          .eq("type", "expense");
        if (error) throw error;
        return (data ?? [])
          .map((c) => ({ label: c.centro_nome ?? "Sem centro", valor: Number(c.total) || 0 }))
          .sort((a, b) => b.valor - a.valor)
          .slice(0, 8);
      }

      if (config.metrica === "faturado_cliente") {
        const { data, error } = await supabase
          .from("v_cliente_360")
          .select("name, faturado")
          .in("company_id", scopedIds)
          .limit(500);
        if (error) throw error;
        return (data ?? [])
          .filter((c) => (Number(c.faturado) || 0) > 0)
          .map((c) => ({ label: c.name ?? "Sem nome", valor: Number(c.faturado) || 0 }))
          .sort((a, b) => b.valor - a.valor)
          .slice(0, 8);
      }

      if (config.metrica === "recebiveis_vencimento") {
        const { data, error } = await supabase
          .from("receivables")
          .select("amount, due_date")
          .in("company_id", scopedIds)
          .in("status", ["a_receber", "vencido"])
          .limit(1000);
        if (error) throw error;
        return seriePorVencimento((data ?? []).map((r) => ({ valor: Number(r.amount) || 0, vencimento: String(r.due_date) })));
      }

      if (config.metrica === "pagar_vencimento") {
        const { data, error } = await supabase
          .from("bills_payable")
          .select("valor, vencimento")
          .in("company_id", scopedIds)
          .neq("status", "pago")
          .limit(1000);
        if (error) throw error;
        return seriePorVencimento((data ?? []).map((b) => ({ valor: Number(b.valor) || 0, vencimento: String(b.vencimento) })));
      }

      return [];
    },
  });
}

const fmtValor = (formato: "currency" | "percent") => (v: number) =>
  formato === "percent" ? `${v.toFixed(1)}%` : formatCurrency(v);

function WidgetTooltip({ active, payload, label, formato }: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
  formato: "currency" | "percent";
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-border bg-card p-2.5 text-xs shadow-card">
      <p className="font-semibold text-foreground">{label}</p>
      <p className="mt-0.5 font-mono text-foreground">{fmtValor(formato)(payload[0].value)}</p>
    </div>
  );
}

export function CustomWidget({ widget, scopedIds, nomesEmpresas, onRemove, onMove, podeMover }: CustomWidgetProps) {
  const metrica = METRICA_POR_KEY[widget.config.metrica];
  const { data, isLoading } = useWidgetData(widget.config, scopedIds, nomesEmpresas);

  const serie = data ?? [];
  const formato = metrica?.formato ?? "currency";
  const eixoY = (v: number) =>
    formato === "percent" ? `${v}%` : `${(v / 1000).toFixed(0)}k`;

  return (
    <ChartPanel
      title={widget.titulo}
      description={metrica?.label ?? widget.config.metrica}
      meta={
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            disabled={!podeMover.cima}
            onClick={() => onMove(widget.id, -1)}
            className="rounded p-1 text-muted-foreground/60 transition-colors hover:text-foreground disabled:opacity-30"
            aria-label={`Mover ${widget.titulo} para cima`}
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            disabled={!podeMover.baixo}
            onClick={() => onMove(widget.id, 1)}
            className="rounded p-1 text-muted-foreground/60 transition-colors hover:text-foreground disabled:opacity-30"
            aria-label={`Mover ${widget.titulo} para baixo`}
          >
            <ArrowDown className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onRemove(widget.id)}
            className="rounded p-1 text-muted-foreground/60 transition-colors hover:text-destructive"
            aria-label={`Remover ${widget.titulo}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      }
    >
      {isLoading ? (
        <div className="h-[240px] animate-pulse rounded-md bg-muted/40" />
      ) : serie.length === 0 ? (
        <ChartEmptyState
          title="Sem dados para esta visão"
          description="Quando houver movimento na métrica escolhida, o gráfico aparece aqui."
          minHeight={220}
        />
      ) : widget.config.tipo === "table" ? (
        <div className="max-h-[260px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card">
              <tr className="border-b border-border text-left">
                <th className="py-2 font-medium text-muted-foreground">Item</th>
                <th className="py-2 text-right font-medium text-muted-foreground">{metrica?.label}</th>
              </tr>
            </thead>
            <tbody>
              {serie.map((p) => (
                <tr key={p.label} className="border-b border-border/50">
                  <td className="py-2">{p.label}</td>
                  <td className="py-2 text-right font-mono tabular-nums">{fmtValor(formato)(p.valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="h-[240px] w-full" aria-label={widget.titulo}>
          <ResponsiveContainer width="100%" height="100%">
            {widget.config.tipo === "line" ? (
              <LineChart data={serie} margin={{ top: 6, right: 8, bottom: 0, left: -6 }}>
                <CartesianGrid strokeDasharray="3 5" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={16} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={eixoY} width={48} />
                <Tooltip content={<WidgetTooltip formato={formato} />} />
                <Line type="monotone" dataKey="valor" stroke="var(--via-data-1)" strokeWidth={2} dot={false} activeDot={{ r: 3 }} />
              </LineChart>
            ) : widget.config.tipo === "area" ? (
              <AreaChart data={serie} margin={{ top: 6, right: 8, bottom: 0, left: -6 }}>
                <CartesianGrid strokeDasharray="3 5" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={16} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={eixoY} width={48} />
                <Tooltip content={<WidgetTooltip formato={formato} />} />
                <Area type="monotone" dataKey="valor" stroke="var(--via-data-1)" strokeWidth={2} fill="hsl(var(--chart-1) / 0.1)" />
              </AreaChart>
            ) : (
              <BarChart data={serie} margin={{ top: 6, right: 8, bottom: 0, left: -6 }}>
                <CartesianGrid strokeDasharray="3 5" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} interval={0} angle={serie.length > 6 ? -20 : 0} height={serie.length > 6 ? 46 : 30} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={eixoY} width={48} />
                <Tooltip content={<WidgetTooltip formato={formato} />} cursor={{ fill: "hsl(var(--muted) / 0.35)" }} />
                <Bar dataKey="valor" fill="var(--via-data-1)" radius={4} barSize={22} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
    </ChartPanel>
  );
}
