import { AppLayout } from "@/components/AppLayout";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpenCheck, GitMerge, ArrowLeftRight, Info, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toCsv, downloadCsv } from "@/lib/csv-export";
import { partidasParaCsv } from "@/lib/export-contabil";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCompany } from "@/hooks/useCompany";
import { IntegridadeContabilCard } from "@/components/contabil/IntegridadeContabilCard";
import { supabase } from "@/integrations/supabase/client";

/**
 * Trilha de auditoria da empresa.
 *
 * Duas coisas que o sistema já gravava e ninguém conseguia ver:
 *  - as partidas dobradas que o banco escreve a cada lançamento
 *  - o histórico de conciliação, quando dois lançamentos viram um
 */

interface Partida {
  id: string;
  transaction_id: string | null;
  debit_account: string | null;
  credit_account: string | null;
  amount: number;
  date: string;
  description: string | null;
}

interface Conciliacao {
  id: string;
  kept_transaction_id: string | null;
  removed_transaction_id: string | null;
  decision: string | null;
  resolved_by: string | null;
  removed_snapshot: Record<string, unknown> | null;
  created_at: string;
}

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBR = (d: string) => new Date(d).toLocaleDateString("pt-BR", { timeZone: "UTC" });

const PERIODOS = [
  { valor: "30", rotulo: "Últimos 30 dias" },
  { valor: "90", rotulo: "Últimos 90 dias" },
  { valor: "365", rotulo: "Últimos 12 meses" },
  { valor: "tudo", rotulo: "Tudo" },
];

export default function Auditoria() {
  const { company } = useCompany();
  const [busca, setBusca] = useState("");
  const [periodo, setPeriodo] = useState("90");

  const { data: partidas = [], isLoading: carregandoPartidas } = useQuery({
    queryKey: ["company_journal_entries", company?.id],
    enabled: !!company?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("company_journal_entries" as never)
        .select("id, transaction_id, debit_account, credit_account, amount, date, description")
        .eq("company_id", company!.id)
        .order("date", { ascending: false })
        .limit(500);
      return (data as Partida[] | null) ?? [];
    },
  });

  const { data: conciliacoes = [], isLoading: carregandoConc } = useQuery({
    queryKey: ["reconciliation_log", company?.id],
    enabled: !!company?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("reconciliation_log" as never)
        .select("id, kept_transaction_id, removed_transaction_id, decision, resolved_by, removed_snapshot, created_at")
        .eq("company_id", company!.id)
        .order("created_at", { ascending: false })
        .limit(300);
      return (data as Conciliacao[] | null) ?? [];
    },
  });

  // Universo de lançamentos do período, para saber quais não geraram partida.
  const { data: lancamentos = [] } = useQuery({
    queryKey: ["transactions_auditoria", company?.id],
    enabled: !!company?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("transactions")
        .select("id")
        .eq("company_id", company!.id)
        .in("status", ["confirmed", "reconciled"])
        .limit(1000);
      return (data as { id: string }[] | null) ?? [];
    },
  });

  const filtro = busca.trim().toLowerCase();
  const corte = periodo === "tudo" ? null : new Date(Date.now() - Number(periodo) * 86400000);
  const partidasFiltradas = partidas
    .filter((p) => (corte ? new Date(p.date) >= corte : true))
    .filter((p) =>
      filtro
        ? [p.description, p.debit_account, p.credit_account].some((c) => c?.toLowerCase().includes(filtro))
        : true);

  const totalMovimentado = partidasFiltradas.reduce((s, p) => s + Number(p.amount || 0), 0);

  // Checagem que mede algo de verdade: a partida é gravada por gatilho AFTER
  // INSERT, então lançamento EDITADO ou criado antes do gatilho fica sem
  // contrapartida. Procurar linha sem conta de débito não servia: as duas
  // colunas são NOT NULL no banco, logo aquele teste nunca podia falhar.
  const idsComPartida = new Set(partidas.map((p) => p.transaction_id).filter(Boolean));
  const semPartida = (lancamentos ?? []).filter((t) => !idsComPartida.has(t.id));
  const fecha = semPartida.length === 0;

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-[-0.02em] flex items-center gap-2">
              <BookOpenCheck className="h-6 w-6" /> Auditoria
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              O rastro contábil de cada lançamento e o histórico de conciliação.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={partidasFiltradas.length === 0}
            onClick={() => {
              const { headers, rows } = partidasParaCsv(
                partidasFiltradas.map((p) => ({
                  date: p.date,
                  debit_account: p.debit_account ?? "",
                  credit_account: p.credit_account ?? "",
                  amount: Number(p.amount) || 0,
                  description: p.description,
                })),
              );
              downloadCsv(`partidas-dobradas-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(headers, rows));
            }}
          >
            <FileDown className="h-4 w-4" /> Exportar CSV
          </Button>
        </div>

        <div className="mb-5">
          <IntegridadeContabilCard />
        </div>

        <Tabs defaultValue="razao">
          <TabsList>
            <TabsTrigger value="razao" className="gap-1.5">
              <BookOpenCheck className="h-3.5 w-3.5" /> Livro razão
            </TabsTrigger>
            <TabsTrigger value="conciliacao" className="gap-1.5">
              <GitMerge className="h-3.5 w-3.5" /> Conciliações
            </TabsTrigger>
          </TabsList>

          <TabsContent value="razao" className="space-y-4 mt-4">
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="py-3 px-4 flex items-start gap-2.5">
                <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <p className="text-xs text-muted-foreground">
                  Cada lançamento gera automaticamente uma partida dobrada: uma conta é debitada e outra creditada
                  pelo mesmo valor. É o que o contador pede quando questiona um número do DRE.
                </p>
              </CardContent>
            </Card>

            <div className="flex flex-wrap items-center gap-3">
              <Input
                placeholder="Buscar por descrição ou conta..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="max-w-xs"
              />
              <Select value={periodo} onValueChange={setPeriodo}>
                <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PERIODOS.map((o) => (
                    <SelectItem key={o.valor} value={o.valor}>{o.rotulo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-sm text-muted-foreground">
                {partidasFiltradas.length} partida(s) · {brl(totalMovimentado)} movimentados
              </span>
              {partidasFiltradas.length > 0 && (
                <Badge variant={fecha ? "secondary" : "destructive"} className="gap-1">
                  {fecha
                    ? "Todo lançamento tem partida"
                    : `${semPartida.length} lançamento(s) sem partida contábil`}
                </Badge>
              )}
            </div>

            {carregandoPartidas ? (
              <div className="text-sm text-muted-foreground py-8 text-center">Carregando...</div>
            ) : partidasFiltradas.length === 0 ? (
              <Card><CardContent className="py-12 text-center">
                <BookOpenCheck className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  {partidas.length === 0
                    ? "Nenhuma partida ainda. Elas aparecem sozinhas conforme você registra lançamentos."
                    : "Nada encontrado nesse período ou nessa busca."}
                </p>
              </CardContent></Card>
            ) : (
              <div className="border rounded-lg overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr className="text-left">
                      <th className="px-3 py-2 font-medium">Data</th>
                      <th className="px-3 py-2 font-medium">Histórico</th>
                      <th className="px-3 py-2 font-medium">Débito</th>
                      <th className="px-3 py-2 font-medium">Crédito</th>
                      <th className="px-3 py-2 font-medium">Lançamento</th>
                      <th className="px-3 py-2 font-medium text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {partidasFiltradas.map((p) => (
                      <tr key={p.id} className="border-t">
                        <td className="px-3 py-2 whitespace-nowrap tabular-nums">{dataBR(p.date)}</td>
                        <td className="px-3 py-2">{p.description ?? "—"}</td>
                        <td className="px-3 py-2 font-mono text-xs">{p.debit_account ?? "—"}</td>
                        <td className="px-3 py-2 font-mono text-xs">{p.credit_account ?? "—"}</td>
                        <td className="px-3 py-2 font-mono text-xs text-muted-foreground"
                            title={p.transaction_id ?? "sem lançamento vinculado"}>
                          {p.transaction_id ? p.transaction_id.slice(0, 8) : "—"}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{brl(Number(p.amount))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="conciliacao" className="space-y-4 mt-4">
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="py-3 px-4 flex items-start gap-2.5">
                <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <p className="text-xs text-muted-foreground">
                  Quando o mesmo pagamento chega por dois caminhos, por exemplo a cobrança e o extrato do banco,
                  o sistema mantém um lançamento e descarta o outro. Aqui está o que foi descartado e por quê.
                </p>
              </CardContent>
            </Card>

            {carregandoConc ? (
              <div className="text-sm text-muted-foreground py-8 text-center">Carregando...</div>
            ) : conciliacoes.length === 0 ? (
              <Card><CardContent className="py-12 text-center">
                <GitMerge className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  Nenhuma conciliação registrada. O histórico se enche conforme o extrato bate com cobranças já lançadas.
                </p>
              </CardContent></Card>
            ) : (
              <div className="space-y-2">
                {conciliacoes.map((c) => {
                  const snap = (c.removed_snapshot ?? {}) as { description?: string; amount?: number; date?: string };
                  return (
                    <Card key={c.id}>
                      <CardContent className="py-3 px-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="flex items-center gap-2 text-sm font-medium">
                            <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
                            {snap.description ?? "Lançamento duplicado"}
                          </span>
                          <span className="flex items-center gap-2">
                            <Badge variant="secondary">{c.decision ?? "conciliado"}</Badge>
                            <span className="text-xs text-muted-foreground tabular-nums">
                              {new Date(c.created_at).toLocaleString("pt-BR")}
                            </span>
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1.5">
                          {snap.amount != null && <>Valor descartado: {brl(Number(snap.amount))} · </>}
                          Mantido: <code className="font-mono">{c.kept_transaction_id?.slice(0, 8) ?? "—"}</code>
                          {" · "}Removido: <code className="font-mono">{c.removed_transaction_id?.slice(0, 8) ?? "—"}</code>
                          {c.resolved_by && <> · por {c.resolved_by}</>}
                        </p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
