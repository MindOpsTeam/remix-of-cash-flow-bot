import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Layers, FileDown, AlertTriangle, ArrowRight } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@viverdeia/design-system";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { formatCurrency } from "@/lib/utils";
import { toCsv, downloadCsv } from "@/lib/csv-export";
import { montarConsolidado, consolidadoParaCsv, type GroupTotalRow } from "@/lib/consolidado";

/**
 * DRE consolidada do grupo: matriz conta × CNPJ sobre v_group_account_totals
 * (a view já filtra confirmados e exclui intercompany). Honestidade acima de
 * tudo: contas sem group_code não consolidam — a tela conta e aponta o buraco
 * de mapeamento em vez de somar errado em silêncio.
 */

const mesAtualIso = () => `${new Date().toISOString().slice(0, 7)}-01`;

export default function Consolidado() {
  const { companies, scope } = useCompany();
  const [mes, setMes] = useState<string>(mesAtualIso());
  const [acumulado, setAcumulado] = useState(false);

  const isCombined = scope === "all";
  const scopedIds = useMemo(() => companies.map((c) => c.id), [companies]);
  const nomes = useMemo(() => Object.fromEntries(companies.map((c) => [c.id, c.name])), [companies]);

  const inicioPeriodo = acumulado ? `${mes.slice(0, 4)}-01-01` : mes;

  const dados = useQuery({
    queryKey: ["consolidado", scopedIds.join(","), mes, acumulado],
    enabled: isCombined && scopedIds.length > 0,
    staleTime: 30_000,
    queryFn: async () => {
      const [totais, semGrupo, intercompany] = await Promise.all([
        supabase
          .from("v_group_account_totals")
          .select("company_id, month, group_code, group_name, type, total")
          .in("company_id", scopedIds)
          .gte("month", inicioPeriodo)
          .lte("month", mes),
        supabase
          .from("chart_of_accounts")
          .select("id", { count: "exact", head: true })
          .in("company_id", scopedIds)
          .is("group_code", null),
        supabase
          .from("transactions")
          .select("amount", { count: "exact", head: true })
          .in("company_id", scopedIds)
          .eq("is_intercompany", true)
          .eq("status", "confirmed")
          .gte("date", inicioPeriodo),
      ]);
      if (totais.error) throw totais.error;
      return {
        rows: (totais.data ?? []) as GroupTotalRow[],
        contasSemGrupo: semGrupo.count ?? 0,
        intercompanyEliminadas: intercompany.count ?? 0,
      };
    },
  });

  const consolidado = useMemo(
    () => (dados.data ? montarConsolidado(dados.data.rows, scopedIds) : null),
    [dados.data, scopedIds],
  );

  function exportar() {
    if (!consolidado) return;
    const { headers, rows } = consolidadoParaCsv(consolidado, nomes, scopedIds);
    downloadCsv(
      `consolidado-${acumulado ? "acumulado-" : ""}${mes.slice(0, 7)}.csv`,
      toCsv(headers, rows.map((r) => r.map(String))),
    );
  }

  const mesLabel = new Date(`${mes}T00:00:00`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  if (!isCombined) {
    return (
      <AppLayout>
        <EmptyState
          icon={<Layers />}
          title="Consolidação é visão de grupo"
          description="Troque o escopo para 'Visão combinada' no topo da tela para ver a DRE consolidada dos CNPJs."
        />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="via-eyebrow">Consolidação total</span>
          <h1 className="mt-1 text-2xl font-bold tracking-[-0.02em] text-foreground">DRE Consolidada do Grupo</h1>
          <p className="mt-1 text-sm capitalize text-muted-foreground">
            {companies.length} CNPJs · {acumulado ? `acumulado até ${mesLabel}` : mesLabel}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="month"
            value={mes.slice(0, 7)}
            onChange={(e) => setMes(`${e.target.value}-01`)}
            className="h-9 rounded-md border border-border bg-background px-3 text-sm"
            aria-label="Mês de referência"
          />
          <Button size="sm" variant={acumulado ? "default" : "outline"} onClick={() => setAcumulado((v) => !v)}>
            Acumulado do ano
          </Button>
          <Button size="sm" variant="outline" className="gap-2" onClick={exportar} disabled={!consolidado?.linhas.length}>
            <FileDown className="h-4 w-4" /> CSV
          </Button>
        </div>
      </div>

      {dados.data && dados.data.contasSemGrupo > 0 && (
        <Link
          to="/settings/consolidation"
          className="mb-4 flex items-start gap-2 rounded-md border border-warning/30 bg-warning/[0.08] p-3 text-xs transition-colors hover:bg-warning/[0.14]"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <span className="text-muted-foreground">
            <span className="font-medium text-foreground">{dados.data.contasSemGrupo} conta(s) sem código de grupo</span>{" "}
            não consolidam entre CNPJs e aparecem separadas abaixo. Clique para mapear.
          </span>
          <ArrowRight className="ml-auto mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        </Link>
      )}

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        {!consolidado || consolidado.linhas.length === 0 ? (
          <div className="p-10">
            <EmptyState
              icon={<Layers />}
              title="Sem movimento no período"
              description="Quando houver lançamentos confirmados no período, a matriz consolidada aparece aqui."
            />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left">
                <th className="px-4 py-3 font-medium text-muted-foreground">Conta</th>
                {scopedIds.map((id) => (
                  <th key={id} className="px-4 py-3 text-right font-medium text-muted-foreground">
                    <span className="block max-w-[140px] truncate" title={nomes[id]}>{nomes[id]}</span>
                  </th>
                ))}
                <th className="px-4 py-3 text-right font-semibold text-foreground">Grupo</th>
              </tr>
            </thead>
            <tbody>
              {(["receita", "custo", "despesa"] as const).map((grupo) => {
                const doGrupo = consolidado.linhas.filter((l) => l.grupo === grupo);
                if (doGrupo.length === 0) return null;
                const rotulo = grupo === "receita" ? "Receitas" : grupo === "custo" ? "Custos (CMV)" : "Despesas";
                return [
                  <tr key={`h-${grupo}`} className="border-b border-border/60 bg-accent/20">
                    <td colSpan={scopedIds.length + 2} className="px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      {rotulo}
                    </td>
                  </tr>,
                  ...doGrupo.map((l) => (
                    <tr key={`${grupo}-${l.code}`} className="border-b border-border/40">
                      <td className="px-4 py-2">
                        <span className="mr-2 font-mono text-xs text-muted-foreground">{l.code}</span>
                        {l.name}
                      </td>
                      {scopedIds.map((id) => (
                        <td key={id} className="px-4 py-2 text-right font-mono tabular-nums text-muted-foreground">
                          {l.porEmpresa[id] ? formatCurrency(l.porEmpresa[id]) : "—"}
                        </td>
                      ))}
                      <td className="px-4 py-2 text-right font-mono font-semibold tabular-nums">{formatCurrency(l.total)}</td>
                    </tr>
                  )),
                ];
              })}
              {[
                { rotulo: "Receita", mapa: consolidado.totais.receita, total: consolidado.totais.totalReceita, classe: "text-revenue" },
                { rotulo: "Custos", mapa: consolidado.totais.custos, total: consolidado.totais.totalCustos, classe: "text-expense" },
                { rotulo: "Despesas", mapa: consolidado.totais.despesas, total: consolidado.totais.totalDespesas, classe: "text-expense" },
                { rotulo: "Resultado", mapa: consolidado.totais.resultado, total: consolidado.totais.totalResultado, classe: consolidado.totais.totalResultado >= 0 ? "text-revenue" : "text-expense" },
              ].map((t) => (
                <tr key={t.rotulo} className="border-t border-border bg-accent/30">
                  <td className="px-4 py-2.5 font-semibold">{t.rotulo}</td>
                  {scopedIds.map((id) => (
                    <td key={id} className={`px-4 py-2.5 text-right font-mono font-semibold tabular-nums ${t.rotulo === "Resultado" && t.mapa[id] < 0 ? "text-expense" : ""}`}>
                      {formatCurrency(t.mapa[id] ?? 0)}
                    </td>
                  ))}
                  <td className={`px-4 py-2.5 text-right font-mono font-semibold tabular-nums ${t.classe}`}>
                    {formatCurrency(t.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
        {consolidado?.totais.margemOperacionalPct !== null && consolidado && (
          <span>Margem operacional do grupo: <span className="font-mono font-semibold text-foreground">{consolidado.totais.margemOperacionalPct?.toFixed(1)}%</span></span>
        )}
        {dados.data && (
          <span>{dados.data.intercompanyEliminadas} lançamento(s) intercompany eliminados da consolidação no período.</span>
        )}
      </div>
    </AppLayout>
  );
}
