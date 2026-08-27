import { useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Link } from "react-router-dom";
import { BedDouble, CalendarRange, Percent, Sparkles, TrendingUp, Wallet } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useStayCadastros, useStayReservations } from "@/hooks/useStay";
import { calcularIndicadores, agruparPor, mesPeriodo } from "@/lib/stay-metrics";

const percentual = (v: number) => `${(v * 100).toFixed(1).replace(".", ",")}%`;

export default function Hospedagem() {
  const [mes, setMes] = useState(() => new Date().toISOString().slice(0, 7));
  const periodo = useMemo(() => mesPeriodo(`${mes}-01`), [mes]);
  const { units, properties, channels, isLoading: carregandoCadastros, semear } = useStayCadastros();
  const { reservations, isLoading } = useStayReservations(periodo.inicio, periodo.fim);

  const unidadesAtivas = units.filter((u) => u.status === "ativa").length || units.length;
  const indicadores = useMemo(
    () => calcularIndicadores(reservations, periodo, unidadesAtivas),
    [reservations, periodo, unidadesAtivas],
  );

  const porUnidade = useMemo(
    () => agruparPor(reservations, periodo, (r) => r.unit_id),
    [reservations, periodo],
  );
  const porCanal = useMemo(
    () => agruparPor(reservations, periodo, (r) => r.channel_id ?? "sem-canal"),
    [reservations, periodo],
  );

  const nomeUnidade = (id: string) => {
    const u = units.find((x) => x.id === id);
    if (!u) return "Unidade removida";
    const p = properties.find((x) => x.id === u.property_id);
    return p ? `${p.name} · ${u.code}` : u.code;
  };
  const nomeCanal = (id: string) =>
    id === "sem-canal" ? "Direto / sem canal" : channels.find((c) => c.id === id)?.name ?? "Canal";

  const kpis = [
    { label: "Receita bruta", valor: formatCurrency(indicadores.receitaBruta), Icon: Wallet },
    { label: "Resultado líquido STAY", valor: formatCurrency(indicadores.resultadoLiquido), Icon: TrendingUp },
    { label: "Repasse a proprietários", valor: formatCurrency(indicadores.repasseProprietarios), Icon: Wallet },
    { label: "Ocupação", valor: percentual(indicadores.ocupacao), Icon: Percent },
    { label: "Diária média (ADR)", valor: formatCurrency(indicadores.adr), Icon: BedDouble },
    { label: "RevPAR", valor: formatCurrency(indicadores.revpar), Icon: CalendarRange },
  ];

  const semCadastro = !carregandoCadastros && units.length === 0 && properties.length === 0;

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          title="Painel de hospedagem"
          description="Como está o mês da operação de temporada: ocupação, diária média e o que sobra para a STAY."
          actions={
            <>
              <Input
                type="month"
                value={mes}
                onChange={(e) => setMes(e.target.value)}
                className="w-[160px]"
                aria-label="Mês de referência"
              />
              <Button asChild size="sm" variant="outline">
                <Link to="/hospedagem/reservas">Reservas</Link>
              </Button>
            </>
          }
        />

        {semCadastro ? (
          <EmptyState
            icon={BedDouble}
            title="Nenhum imóvel cadastrado"
            description="Carregue os imóveis, canais e taxas padrão da STAY para começar a lançar reservas."
            action={
              <Button onClick={() => semear.mutate()} disabled={semear.isPending} className="gap-2">
                <Sparkles className="h-4 w-4" />
                {semear.isPending ? "Carregando…" : "Carregar cadastros da STAY"}
              </Button>
            }
          />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {kpis.map(({ label, valor, Icon }) => (
                <Card key={label}>
                  <CardContent className="flex items-center gap-3 p-4">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/[0.08]">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="text-lg font-semibold tabular-nums">
                        {isLoading ? <Skeleton className="h-6 w-24" /> : valor}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Composição da receita</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {[
                    ["Diárias", indicadores.receitaHospedagem],
                    ["Taxas de limpeza", indicadores.receitaLimpeza],
                    ["Outras taxas e serviços", indicadores.receitaExtras],
                    ["(−) Comissões de canal", -indicadores.comissoesCanal],
                    ["(−) Taxas de pagamento", -indicadores.taxasPagamento],
                    ["(−) Impostos", -indicadores.impostos],
                    ["(−) Custo de limpeza", -indicadores.custoLimpeza],
                    ["(−) Repasse ao proprietário", -indicadores.repasseProprietarios],
                  ].map(([rotulo, valor]) => (
                    <div key={rotulo as string} className="flex items-center justify-between">
                      <span className="text-muted-foreground">{rotulo}</span>
                      <span className="tabular-nums">{formatCurrency(valor as number)}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between border-t pt-2 font-semibold">
                    <span>Resultado STAY</span>
                    <span className="tabular-nums">{formatCurrency(indicadores.resultadoLiquido)}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Desempenho por apartamento</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {porUnidade.length === 0 && (
                    <p className="text-muted-foreground">Sem reservas no mês.</p>
                  )}
                  {porUnidade.slice(0, 10).map((g) => (
                    <div key={g.chave} className="flex items-center justify-between gap-3">
                      <span className="truncate text-muted-foreground">{nomeUnidade(g.chave)}</span>
                      <span className="shrink-0 tabular-nums">
                        {g.noitesVendidas} noites · {formatCurrency(g.receitaBruta)}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Origem das reservas</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {porCanal.length === 0 && <p className="text-muted-foreground">Sem reservas no mês.</p>}
                  {porCanal.map((g) => (
                    <div key={g.chave} className="flex items-center justify-between gap-3">
                      <span className="truncate text-muted-foreground">{nomeCanal(g.chave)}</span>
                      <span className="shrink-0 tabular-nums">
                        {g.reservas} reservas · {formatCurrency(g.receitaBruta)}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
