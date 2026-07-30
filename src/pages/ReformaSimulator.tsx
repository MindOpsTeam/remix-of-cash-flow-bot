import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Scale, TrendingDown, Info, Compass } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { formatCurrency } from "@/lib/utils";
import {
  simularRegimes, NOME_REGIME_LABEL, IVA_REF_TOTAL,
  type RegimeSimInput, type NomeRegime, type Atividade, type PerfilCliente, type AnexoSimples,
} from "@/lib/reforma-simulator";
import { REDUCOES_IVA, reducaoPorKey } from "@/lib/reforma-rates";
import { useReformaCarteira } from "@/hooks/useReformaCarteira";
import { Button } from "@/components/ui/button";
import { Database } from "lucide-react";
import { Link } from "react-router-dom";

const REGIME_COLOR: Record<NomeRegime, string> = {
  simples: "hsl(var(--primary))",
  hibrido: "hsl(var(--revenue))",
  normal: "hsl(var(--expense))",
};

function fmt(v: number): string {
  return Number.isNaN(v) ? "—" : formatCurrency(v);
}

export default function ReformaSimulator() {
  const { company } = useCompany();
  const { data: carteira } = useReformaCarteira();

  const [faturamento, setFaturamento] = useState("300000");
  const [atividade, setAtividade] = useState<Atividade>("servico");
  const [anexo, setAnexo] = useState<AnexoSimples | "auto">("auto");
  const [folha, setFolha] = useState("90000");
  const [insumos, setInsumos] = useState("30000");
  const [perfil, setPerfil] = useState<PerfilCliente>("B2B");
  const [reducaoKey, setReducaoKey] = useState("integral");
  const [prefilled, setPrefilled] = useState(false);

  // Pré-preenche o faturamento com a receita confirmada dos últimos 12 meses (DRE).
  useEffect(() => {
    if (!company || prefilled) return;
    (async () => {
      const from = new Date();
      from.setMonth(from.getMonth() - 12);
      const { data } = await supabase
        .from("transactions")
        .select("amount")
        .eq("company_id", company.id)
        .eq("type", "revenue")
        .eq("status", "confirmed")
        .gte("date", from.toISOString().slice(0, 10));
      const total = (data ?? []).reduce((s, t) => s + Number(t.amount), 0);
      if (total > 0) setFaturamento(String(Math.round(total)));
      setPrefilled(true);
    })();
  }, [company, prefilled]);

  const input: RegimeSimInput = useMemo(() => ({
    faturamentoAnual: parseFloat(faturamento) || 0,
    atividade,
    anexo: anexo === "auto" ? undefined : anexo,
    folhaAnual: parseFloat(folha) || 0,
    insumosCreditaveis: parseFloat(insumos) || 0,
    perfilCliente: perfil,
    reducaoIva: reducaoPorKey(reducaoKey),
  }), [faturamento, atividade, anexo, folha, insumos, perfil, reducaoKey]);

  const sim = useMemo(() => simularRegimes(input), [input]);

  const chartData = sim.anos.map((a) => ({
    ano: String(a.ano),
    Simples: a.simples,
    Híbrido: a.hibrido,
    Normal: a.normal,
  }));

  const recLabel = NOME_REGIME_LABEL[sim.recomendado];
  const geraCredito = sim.recomendado !== "simples";

  const applyCarteira = () => {
    if (!carteira?.temDados) return;
    setFaturamento(String(carteira.faturamentoAno));
    setInsumos(String(carteira.insumosAno));
    setPerfil(carteira.pctB2B >= 0.6 ? "B2B" : carteira.pctB2B <= 0.2 ? "B2C" : "misto");
    setPrefilled(true);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/15 flex items-center justify-center">
            <Scale className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground tracking-[-0.02em]">Simulador de Regime · Reforma Tributária</h1>
            <p className="text-sm text-muted-foreground">Simples × Híbrido × Regime Normal na transição 2027-2033 (CBS/IBS)</p>
          </div>
        </div>

        {carteira?.temDados && (
          <Card className="border-primary/30 bg-primary/[0.03]">
            <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                  <Database className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Carteira real detectada — sem digitar nada</p>
                  <p className="text-xs text-muted-foreground">
                    {carteira.clientes.length} cliente{carteira.clientes.length > 1 ? "s" : ""} · faturamento {formatCurrency(carteira.faturamentoAno)}/ano · {Math.round(carteira.pctB2B * 100)}% B2B
                  </p>
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={applyCarteira}>Usar dados da carteira</Button>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6">
          {/* Inputs */}
          <Card className="h-fit">
            <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Dados da empresa</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Faturamento anual (R$)</Label>
                <Input type="number" min="0" value={faturamento} onChange={(e) => setFaturamento(e.target.value)} />
                <p className="text-[11px] text-muted-foreground">Pré-preenchido com a receita dos últimos 12 meses.</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Atividade</Label>
                <Select value={atividade} onValueChange={(v) => setAtividade(v as Atividade)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="servico">Serviços</SelectItem>
                    <SelectItem value="comercio">Comércio</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Anexo do Simples</Label>
                <Select value={anexo} onValueChange={(v) => setAnexo(v as AnexoSimples | "auto")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Automático (Fator R)</SelectItem>
                    <SelectItem value="I">Anexo I — Comércio</SelectItem>
                    <SelectItem value="III">Anexo III — Serviços</SelectItem>
                    <SelectItem value="V">Anexo V — Serviços</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Folha anual (R$)</Label>
                <Input type="number" min="0" value={folha} onChange={(e) => setFolha(e.target.value)} />
                <p className="text-[11px] text-muted-foreground">Define o Fator R (III vs V) e o CPP no regime normal.</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Insumos creditáveis anuais (R$)</Label>
                <Input type="number" min="0" value={insumos} onChange={(e) => setInsumos(e.target.value)} />
                <p className="text-[11px] text-muted-foreground">Base de crédito de CBS/IBS (reduz o valor agregado).</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Perfil dos clientes</Label>
                <Select value={perfil} onValueChange={(v) => setPerfil(v as PerfilCliente)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="B2B">B2B (empresas)</SelectItem>
                    <SelectItem value="B2C">B2C (consumidor final)</SelectItem>
                    <SelectItem value="misto">Misto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Regime de alíquota (setor)</Label>
                <Select value={reducaoKey} onValueChange={setReducaoKey}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {REDUCOES_IVA.map((r) => <SelectItem key={r.key} value={r.key}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">{REDUCOES_IVA.find((r) => r.key === reducaoKey)?.hint}</p>
              </div>
            </CardContent>
          </Card>

          {/* Results */}
          <div className="space-y-6">
            {/* Recomendação */}
            <Card className="border-primary/40 bg-primary/[0.04]">
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                    <Compass className="h-4 w-4 text-primary" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">
                      Recomendado no acumulado 2027-2033: <span className="text-primary">{recLabel}</span>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Menor carga estimada do período — economia de <strong className="text-foreground tabular-nums">{fmt(sim.economiaVsPior)}</strong> frente ao regime mais caro.
                      {sim.anexoUsado && atividade === "servico" && <> Enquadramento no <strong>Anexo {sim.anexoUsado}</strong>.</>}
                    </p>
                    {perfil !== "B2C" && (
                      <p className="text-sm text-muted-foreground">
                        {geraCredito
                          ? <>Recolhendo CBS/IBS por fora, você gera <strong className="text-foreground tabular-nums">~{fmt(sim.creditoAoClienteMedioAno)}/ano</strong> de crédito ao seu cliente PJ — vantagem competitiva que o Simples padrão não entrega.</>
                          : <>Atenção B2B: no Simples padrão o CBS/IBS embutido <strong>não vira crédito</strong> para o cliente PJ (~{fmt(sim.creditoAoClienteMedioAno)}/ano). Avalie o <strong>Híbrido</strong> se seus clientes exigirem crédito.</>}
                        {" "}
                        <Link to="/reforma/impacto" className="text-primary hover:underline">Ver por cliente →</Link>
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* KPIs por regime */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {(["simples", "hibrido", "normal"] as NomeRegime[]).map((r) => {
                const isRec = r === sim.recomendado;
                return (
                  <Card key={r} className={isRec ? "border-primary/50 ring-1 ring-primary/20" : ""}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: REGIME_COLOR[r] }} />
                        <p className="text-xs font-medium text-muted-foreground">{NOME_REGIME_LABEL[r]}</p>
                      </div>
                      <p className="text-lg font-semibold tabular-nums text-foreground">{fmt(sim.totais[r])}</p>
                      <p className="text-[11px] text-muted-foreground">carga acumulada 7 anos {isRec && <span className="text-primary font-medium">· recomendado</span>}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Gráfico */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2"><TrendingDown className="h-4 w-4 text-muted-foreground" />Carga tributária estimada por ano</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="ano" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                    <Legend />
                    <Line type="monotone" dataKey="Simples" stroke={REGIME_COLOR.simples} strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
                    <Line type="monotone" dataKey="Híbrido" stroke={REGIME_COLOR.hibrido} strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
                    <Line type="monotone" dataKey="Normal" stroke={REGIME_COLOR.normal} strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Tabela */}
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Ano</th>
                        <th className="text-right px-4 py-3 font-medium text-muted-foreground">Simples</th>
                        <th className="text-right px-4 py-3 font-medium text-muted-foreground">Híbrido</th>
                        <th className="text-right px-4 py-3 font-medium text-muted-foreground">Normal</th>
                        <th className="text-center px-4 py-3 font-medium text-muted-foreground">Melhor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sim.anos.map((a) => (
                        <tr key={a.ano} className="border-b last:border-b-0 hover:bg-muted/20">
                          <td className="px-4 py-2.5 font-medium">{a.ano}</td>
                          <td className={`px-4 py-2.5 text-right tabular-nums ${a.melhor === "simples" ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{fmt(a.simples)}</td>
                          <td className={`px-4 py-2.5 text-right tabular-nums ${a.melhor === "hibrido" ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{fmt(a.hibrido)}</td>
                          <td className={`px-4 py-2.5 text-right tabular-nums ${a.melhor === "normal" ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{fmt(a.normal)}</td>
                          <td className="px-4 py-2.5 text-center">
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: REGIME_COLOR[a.melhor] }} />
                              {NOME_REGIME_LABEL[a.melhor]}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Disclaimer */}
            <div className="flex gap-2 rounded-lg border border-border/60 bg-muted/20 p-3">
              <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Estimativa gerencial de apoio à decisão. Usa alíquota de referência do IVA dual de <strong>~{IVA_REF_TOTAL.toFixed(1)}%</strong> (CBS+IBS) e o cronograma de transição da LC 214/2025 — números definitivos ainda dependem de resolução do Senado e regulamentação. Não considera benefícios setoriais, Zona Franca, substituição tributária nem particularidades municipais de ISS. Não substitui parecer do seu contador.
              </p>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
