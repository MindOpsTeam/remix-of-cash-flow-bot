import { useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Wallet } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useStayCadastros, useStayReservations, useStayOwnerStatements } from "@/hooks/useStay";
import { mesPeriodo, noitesNoPeriodo, reservaVale } from "@/lib/stay-metrics";

interface LinhaRepasse {
  unit_id: string;
  gross_revenue: number;
  deductions: number;
  owner_payout: number;
  company_result: number;
  nights_sold: number;
}

export default function Repasses() {
  const [mes, setMes] = useState(() => new Date().toISOString().slice(0, 7));
  const periodo = useMemo(() => mesPeriodo(`${mes}-01`), [mes]);
  const referencia = periodo.inicio;

  const { units, properties } = useStayCadastros();
  const { reservations, isLoading } = useStayReservations(periodo.inicio, periodo.fim);
  const { statements, gravar } = useStayOwnerStatements(referencia);

  const nomeUnidade = (id: string) => {
    const u = units.find((x) => x.id === id);
    if (!u) return "Unidade removida";
    const p = properties.find((x) => x.id === u.property_id);
    return p ? `${p.name} · ${u.code}` : u.code;
  };

  /** Fecha o mês por unidade, rateando estadias que cruzam a virada do mês. */
  const linhas = useMemo<LinhaRepasse[]>(() => {
    const mapa = new Map<string, LinhaRepasse>();
    for (const r of reservations) {
      if (!reservaVale(r)) continue;
      const noites = noitesNoPeriodo(r, periodo);
      if (noites <= 0) continue;
      const prop = r.nights > 0 ? noites / r.nights : 1;
      const atual =
        mapa.get(r.unit_id) ??
        { unit_id: r.unit_id, gross_revenue: 0, deductions: 0, owner_payout: 0, company_result: 0, nights_sold: 0 };
      const bruto = Number(r.gross_total) * prop;
      const deducoes =
        (Number(r.channel_commission) + Number(r.payment_fee) + Number(r.taxes) + Number(r.cleaning_cost)) * prop;
      atual.gross_revenue += bruto;
      atual.deductions += deducoes;
      atual.owner_payout += Number(r.owner_payout) * prop;
      atual.company_result += Number(r.net_total) * prop;
      atual.nights_sold += noites;
      mapa.set(r.unit_id, atual);
    }
    return [...mapa.values()].sort((a, b) => b.gross_revenue - a.gross_revenue);
  }, [reservations, periodo]);

  const totais = linhas.reduce(
    (s, l) => ({
      bruto: s.bruto + l.gross_revenue,
      repasse: s.repasse + l.owner_payout,
      stay: s.stay + l.company_result,
    }),
    { bruto: 0, repasse: 0, stay: 0 },
  );

  const statusDe = (unitId: string) => statements.find((s) => s.unit_id === unitId)?.status;

  const fechar = () =>
    gravar.mutate(
      linhas.map((l) => ({
        unit_id: l.unit_id,
        reference_month: referencia,
        gross_revenue: Number(l.gross_revenue.toFixed(2)),
        deductions: Number(l.deductions.toFixed(2)),
        owner_payout: Number(l.owner_payout.toFixed(2)),
        company_result: Number(l.company_result.toFixed(2)),
        nights_sold: Math.round(l.nights_sold),
        status: "fechado",
        bill_id: null,
      })),
    );

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          title="Repasse aos proprietários"
          description="Fechamento mensal por apartamento: receita do mês, deduções e quanto vai para cada proprietário."
          actions={
            <>
              <Input
                type="month"
                value={mes}
                onChange={(e) => setMes(e.target.value)}
                className="w-[160px]"
                aria-label="Mês de referência"
              />
              <Button size="sm" onClick={fechar} disabled={linhas.length === 0 || gravar.isPending}>
                {gravar.isPending ? "Gravando…" : "Fechar mês"}
              </Button>
            </>
          }
        />

        {isLoading && <Skeleton className="h-40 w-full" />}

        {!isLoading && linhas.length === 0 && (
          <EmptyState
            icon={Wallet}
            title="Nada a repassar neste mês"
            description="Sem reservas válidas no período escolhido."
          />
        )}

        {linhas.length > 0 && (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b text-xs text-muted-foreground">
                    <tr>
                      <th className="p-3 text-left font-medium">Apartamento</th>
                      <th className="p-3 text-right font-medium">Noites</th>
                      <th className="p-3 text-right font-medium">Receita bruta</th>
                      <th className="p-3 text-right font-medium">Deduções</th>
                      <th className="p-3 text-right font-medium">Repasse</th>
                      <th className="p-3 text-right font-medium">Resultado STAY</th>
                      <th className="p-3 text-left font-medium">Extrato</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {linhas.map((l) => (
                      <tr key={l.unit_id} className="hover:bg-muted/40">
                        <td className="p-3">{nomeUnidade(l.unit_id)}</td>
                        <td className="p-3 text-right tabular-nums">{l.nights_sold}</td>
                        <td className="p-3 text-right tabular-nums">{formatCurrency(l.gross_revenue)}</td>
                        <td className="p-3 text-right tabular-nums">{formatCurrency(l.deductions)}</td>
                        <td className="p-3 text-right tabular-nums">{formatCurrency(l.owner_payout)}</td>
                        <td className="p-3 text-right font-medium tabular-nums">{formatCurrency(l.company_result)}</td>
                        <td className="p-3 text-xs text-muted-foreground">{statusDe(l.unit_id) ?? "em aberto"}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t bg-muted/30 font-medium">
                    <tr>
                      <td className="p-3" colSpan={2}>Total</td>
                      <td className="p-3 text-right tabular-nums">{formatCurrency(totais.bruto)}</td>
                      <td className="p-3" />
                      <td className="p-3 text-right tabular-nums">{formatCurrency(totais.repasse)}</td>
                      <td className="p-3 text-right tabular-nums">{formatCurrency(totais.stay)}</td>
                      <td className="p-3" />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
