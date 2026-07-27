import { AppLayout } from "@/components/AppLayout";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpenCheck, GitMerge, ArrowLeftRight, Info } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCompany } from "@/hooks/useCompany";
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

  const filtro = busca.trim().toLowerCase();
  const corte = periodo === "tudo" ? null : new Date(Date.now() - Number(periodo) * 86400000);
  const partidasFiltradas = partidas
    .filter((p) => (corte ? new Date(p.date) >= corte : true))
    .filter((p) =>
      filtro
        ? [p.description, p.debit_account, p.credit_account].some((c) => c?.toLowerCase().includes(filtro))
        : true);

  const totalMovimentado = partidasFiltradas.reduce((s, p) => s + Number(p.amount || 0), 0);

  // Em partida dobrada toda linha precisa ter os DOIS lados. Linha sem conta de
  // débito ou sem conta de crédito não fecha, e é isso que o auditor precisa
  // enxergar na hora. Comparar a soma dos valores consigo mesma não provaria
  // nada, porque o mesmo valor alimenta os dois lados por construção.
  const semContrapartida = partidasFiltradas.filter((p) => !p.debit_account || !p.credit_account);
  const fecha = semContrapartida.length === 0;

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-[-0.02em] flex items-center gap-2">
            <BookOpenCheck className="h-6 w-6" /> Auditoria
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            O rastro contábil de cada lançamento e o histórico de conciliação.
          </p>
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
                    ? "Toda partida tem os dois lados"
                    : `${semContrapartida.length} partida(s) sem contrapartida`}
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
