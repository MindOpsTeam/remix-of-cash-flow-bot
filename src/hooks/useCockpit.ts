import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import {
  aging,
  mrr,
  inadimplencia,
  receivablesAbertos,
  concentracaoClientes,
  type AgingBuckets,
  type ClienteMetricRow,
  type ReceivableMetricRow,
} from "@/lib/metrics";

/**
 * Dados operacionais do cockpit: tudo que o painel mostra além da margem.
 * Uma query composta, escopo-aware (combinado ou CNPJ individual), mesma
 * disciplina do useMarginBI. Cálculo fica em src/lib/metrics.ts (puro).
 */

export interface KpiMeta {
  id: string;
  company_id: string;
  metric_key: string;
  alvo: number;
  direcao: "acima" | "abaixo";
}

export interface CockpitData {
  caixa: number | null;
  mrrMensal: number;
  inadimplenciaPct: number;
  arAberto: number;
  apAberto: number;
  agingAR: AgingBuckets;
  agingAP: AgingBuckets;
  impostos60d: number;
  fechamentoAnteriorAberto: boolean;
  acoesPendentes: number;
  clientes: { top: ClienteMetricRow[]; participacaoPct: number };
  centrosCusto: Array<{ nome: string; total: number }>;
  /** Soma de TODOS os centros do mês, não só os top 5 exibidos. */
  centrosCustoTotalMes: number;
  metas: KpiMeta[];
}

const hojeIso = () => new Date().toISOString().slice(0, 10);

/**
 * kpi_metas ainda não está no types.ts gerado pelo Lovable; este tipo
 * estrutural mínimo evita o `as any` até a próxima regeneração.
 */
type UntypedFrom = (table: string) => {
  select: (q: string) => {
    eq: (col: string, val: string) => PromiseLike<{ data: unknown; error: unknown }>;
  };
};

export function useCockpit() {
  const { companies, scope, loading } = useCompany();
  const scopedIds = (scope === "all" ? companies : companies.filter((c) => c.id === scope)).map((c) => c.id);
  // Metas do grupo moram no CNPJ principal quando o escopo é combinado.
  const metasHolder = scope === "all" ? companies[0]?.id : scope;

  return useQuery<CockpitData>({
    queryKey: ["cockpit", scope, scopedIds.join(","), metasHolder],
    enabled: !loading && scopedIds.length > 0,
    staleTime: 30_000,
    queryFn: async () => {
      const hoje = hojeIso();
      const umAnoAtras = new Date(Date.now() - 365 * 86_400_000).toISOString().slice(0, 10);
      const em60d = new Date(Date.now() + 60 * 86_400_000).toISOString().slice(0, 10);
      const mesAtual = `${hoje.slice(0, 7)}-01`;
      const dataMesAnterior = new Date();
      dataMesAnterior.setDate(1);
      dataMesAnterior.setMonth(dataMesAnterior.getMonth() - 1);
      const mesAnterior = `${dataMesAnterior.toISOString().slice(0, 7)}-01`;

      const [
        receivablesRes,
        billsRes,
        contractsRes,
        bankRes,
        taxRes,
        closeRes,
        actionsRes,
        clientesRes,
        centrosRes,
        metasRes,
      ] = await Promise.all([
        supabase
          .from("receivables")
          .select("amount, due_date, status, payment_date")
          .in("company_id", scopedIds)
          .neq("status", "cancelado")
          .gte("due_date", umAnoAtras)
          .limit(1000),
        supabase
          .from("bills_payable")
          .select("valor, vencimento, status")
          .in("company_id", scopedIds)
          .neq("status", "pago")
          .gte("vencimento", umAnoAtras)
          .limit(1000),
        supabase
          .from("contracts")
          .select("amount, cycle, status")
          .in("company_id", scopedIds)
          .eq("status", "active")
          .limit(500),
        supabase.from("bank_accounts").select("balance").in("company_id", scopedIds),
        supabase
          .from("tax_guides")
          .select("valor, vencimento, status")
          .in("company_id", scopedIds)
          .neq("status", "pago")
          .lte("vencimento", em60d)
          .gte("vencimento", hoje),
        supabase
          .from("monthly_close")
          .select("company_id, status")
          .in("company_id", scopedIds)
          .eq("month", mesAnterior),
        supabase
          .from("agent_actions")
          .select("id", { count: "exact", head: true })
          .in("company_id", scopedIds)
          .eq("status", "pending"),
        supabase
          .from("v_cliente_360")
          .select("name, faturado")
          .in("company_id", scopedIds)
          .limit(500),
        supabase
          .from("v_centro_custo_mes")
          .select("centro_nome, total, type")
          .in("company_id", scopedIds)
          .eq("mes", mesAtual)
          .eq("type", "expense"),
        metasHolder
          ? (supabase.from as unknown as UntypedFrom)("kpi_metas")
              .select("id, company_id, metric_key, alvo, direcao")
              .eq("company_id", metasHolder)
          : Promise.resolve({ data: [], error: null }),
      ]);

      const receivables = (receivablesRes.data ?? []) as ReceivableMetricRow[];
      const bills = (billsRes.data ?? []) as Array<{ valor: number; vencimento: string; status: string }>;

      const abertos = receivablesAbertos(receivables);
      const agingAR = aging(
        abertos.map((r) => ({ valor: r.amount, vencimento: r.due_date })),
        hoje,
      );
      const agingAP = aging(
        bills.map((b) => ({ valor: b.valor, vencimento: b.vencimento })),
        hoje,
      );

      const saldos = (bankRes.data ?? []).map((b: { balance: number | null }) => b.balance).filter(
        (v: number | null): v is number => v !== null,
      );
      const caixa = saldos.length > 0 ? saldos.reduce((s: number, v: number) => s + v, 0) : null;

      // Fechamento do mês anterior: aberto se QUALQUER CNPJ do escopo não fechou.
      const fechadas = new Set(
        ((closeRes.data ?? []) as Array<{ company_id: string; status: string }>)
          .filter((c) => c.status === "closed")
          .map((c) => c.company_id),
      );
      const fechamentoAnteriorAberto = scopedIds.some((id) => !fechadas.has(id));

      return {
        caixa,
        mrrMensal: mrr((contractsRes.data ?? []) as Array<{ amount: number; cycle: string; status: string }>),
        inadimplenciaPct: inadimplencia(receivables),
        arAberto: agingAR.total,
        apAberto: agingAP.total,
        agingAR,
        agingAP,
        impostos60d: ((taxRes.data ?? []) as Array<{ valor: number }>).reduce((s, g) => s + g.valor, 0),
        fechamentoAnteriorAberto,
        acoesPendentes: actionsRes.count ?? 0,
        clientes: concentracaoClientes((clientesRes.data ?? []) as ClienteMetricRow[]),
        ...(() => {
          const todos = ((centrosRes.data ?? []) as Array<{ centro_nome: string | null; total: number | null }>)
            .map((c) => ({ nome: c.centro_nome ?? "Sem centro", total: c.total ?? 0 }))
            .sort((a, b) => b.total - a.total);
          return {
            centrosCusto: todos.slice(0, 5),
            centrosCustoTotalMes: todos.reduce((s, c) => s + c.total, 0),
          };
        })(),
        metas: ((metasRes.data ?? []) as KpiMeta[]).map((m) => ({ ...m, alvo: Number(m.alvo) })),
      };
    },
  });
}
