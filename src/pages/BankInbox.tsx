import { mensagemDeErro } from "@/lib/erros";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LinhaDetalhe } from "@/components/detalhe/LinhaDetalhe";
import { Check, Compass, EyeOff, Loader2, RefreshCw } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConnectFirstCTA } from "@/components/openfinance/ConnectFirstCTA";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { useBankConnections } from "@/hooks/useBankConnections";
import { formatCurrency } from "@/lib/utils";

/**
 * Caixa de entrada bancária: a última milha do Open Finance.
 *
 * O sync traz o extrato para o staging (bank_transactions_raw); esta tela é
 * onde o humano confere a classificação sugerida pela IA e confirma. Só depois
 * da revisão o dinheiro entra no DRE — a régua exige lançamento confirmado, e
 * confirmação é decisão humana, nunca do sync.
 */

interface RawTx {
  id: string;
  date: string;
  description: string;
  amount: number;
  direction: "revenue" | "expense";
}

interface Conta {
  id: string;
  name: string;
  code: string | null;
  type: string;
}

interface Sugestao {
  account_id: string | null;
  cost_center_id: string | null;
  origem: "regra" | "ia" | "nenhuma";
  corrigido: boolean;
}

const LIMITE_LOTE = 300;

export default function BankInbox() {
  const { company } = useCompany();
  const queryClient = useQueryClient();
  const { connections, pendingCount, sync, refetch } = useBankConnections();

  const [sugestoes, setSugestoes] = useState<Record<string, Sugestao>>({});
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [classificando, setClassificando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [ignorando, setIgnorando] = useState(false);

  const pendentes = useQuery({
    queryKey: ["bank_inbox", company?.id],
    enabled: !!company,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_transactions_raw")
        .select("id, date, description, amount, direction")
        .eq("company_id", company!.id)
        .eq("status", "new")
        .order("date", { ascending: false })
        .limit(LIMITE_LOTE);
      if (error) throw error;
      return (data ?? []) as RawTx[];
    },
  });

  const contas = useQuery({
    queryKey: ["chart_of_accounts", company?.id],
    enabled: !!company,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chart_of_accounts")
        .select("id, name, code, type")
        .eq("company_id", company!.id)
        .order("code");
      if (error) throw error;
      return (data ?? []) as Conta[];
    },
  });

  const linhas = useMemo(() => pendentes.data ?? [], [pendentes.data]);

  // Tudo selecionado por padrão: revisar é desmarcar exceções, não caçar linhas.
  useEffect(() => {
    setSelecionadas(new Set(linhas.map((l) => l.id)));
  }, [linhas]);

  // Classifica na chegada, uma vez por lote: regra aprendida primeiro, modelo
  // depois (cascata do classificar-lote). Falha de IA não trava a revisão.
  useEffect(() => {
    if (!company?.id || linhas.length === 0) return;
    const semSugestao = linhas.filter((l) => !sugestoes[l.id]);
    if (semSugestao.length === 0) return;

    let cancelado = false;
    setClassificando(true);
    supabase.functions
      .invoke("classificar-lote", {
        body: {
          company_id: company.id,
          itens: semSugestao.map((l) => ({ descricao: l.description, tipo: l.direction })),
        },
      })
      .then(({ data, error }) => {
        if (cancelado) return;
        if (error) throw error;
        const resposta = data as {
          itens?: Array<{ account_id: string | null; cost_center_id: string | null; origem: Sugestao["origem"] }>;
        };
        setSugestoes((atual) => {
          const novo = { ...atual };
          semSugestao.forEach((l, i) => {
            const c = resposta.itens?.[i];
            novo[l.id] = {
              account_id: c?.account_id ?? null,
              cost_center_id: c?.cost_center_id ?? null,
              origem: c?.origem ?? "nenhuma",
              corrigido: false,
            };
          });
          return novo;
        });
      })
      .catch(() => {
        if (cancelado) return;
        setSugestoes((atual) => {
          const novo = { ...atual };
          semSugestao.forEach((l) => {
            novo[l.id] = { account_id: null, cost_center_id: null, origem: "nenhuma", corrigido: false };
          });
          return novo;
        });
      })
      .finally(() => {
        if (!cancelado) setClassificando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [company?.id, linhas, sugestoes]);

  function trocarConta(rawId: string, contaId: string) {
    setSugestoes((atual) => ({
      ...atual,
      [rawId]: { ...(atual[rawId] ?? { cost_center_id: null, origem: "nenhuma" }), account_id: contaId, corrigido: true },
    }));
  }

  function alternar(rawId: string) {
    setSelecionadas((atual) => {
      const novo = new Set(atual);
      if (novo.has(rawId)) novo.delete(rawId);
      else novo.add(rawId);
      return novo;
    });
  }

  function recarregar() {
    queryClient.invalidateQueries({ queryKey: ["bank_inbox", company?.id] });
    queryClient.invalidateQueries({ queryKey: ["transactions"] });
    queryClient.invalidateQueries({ queryKey: ["dre"] });
    refetch();
  }

  async function importar() {
    if (!company?.id || selecionadas.size === 0) return;
    setImportando(true);
    try {
      const items = linhas
        .filter((l) => selecionadas.has(l.id))
        .map((l) => ({
          raw_id: l.id,
          account_id: sugestoes[l.id]?.account_id ?? null,
          cost_center_id: sugestoes[l.id]?.cost_center_id ?? null,
        }));

      const { data, error } = await supabase.functions.invoke("openfinance-sync", {
        body: { action: "import", company_id: company.id, items },
      });
      if (error) throw error;
      const r = data as { imported?: number; reconciled?: number; skipped?: number; titulos_baixados?: number };

      // Correção humana vira regra da empresa: a próxima classificação do
      // mesmo padrão sai por regra, sem token (mesmo aprendizado da colagem).
      const aprendidas = linhas.filter(
        (l) => selecionadas.has(l.id) && sugestoes[l.id]?.corrigido && sugestoes[l.id]?.account_id,
      );
      if (aprendidas.length > 0) {
        await supabase.functions.invoke("classificar-lote", {
          body: {
            company_id: company.id,
            aprender: aprendidas.map((l) => ({
              descricao: l.description,
              account_id: sugestoes[l.id].account_id,
              cost_center_id: sugestoes[l.id].cost_center_id,
            })),
          },
        });
      }

      const partes = [
        r.imported ? `${r.imported} importado(s)` : null,
        r.reconciled ? `${r.reconciled} casado(s) com lançamento já digitado` : null,
        r.skipped ? `${r.skipped} já existiam` : null,
        r.titulos_baixados ? `${r.titulos_baixados} título(s) quitado(s) automaticamente` : null,
      ].filter(Boolean);
      toast.success(partes.length ? partes.join(" · ") : "Nada novo para importar.");
      setSugestoes({});
      recarregar();
    } catch (e) {
      toast.error("Não consegui importar: " + mensagemDeErro(e));
    } finally {
      setImportando(false);
    }
  }

  async function ignorar() {
    if (!company?.id || selecionadas.size === 0) return;
    setIgnorando(true);
    try {
      const { error } = await supabase.functions.invoke("openfinance-sync", {
        body: { action: "ignore", company_id: company.id, raw_ids: [...selecionadas] },
      });
      if (error) throw error;
      toast.success(`${selecionadas.size} transação(ões) ignorada(s).`);
      setSugestoes({});
      recarregar();
    } catch (e) {
      toast.error("Não consegui ignorar: " + mensagemDeErro(e));
    } finally {
      setIgnorando(false);
    }
  }

  const totalEntradas = linhas.filter((l) => l.direction === "revenue").reduce((s, l) => s + l.amount, 0);
  const totalSaidas = linhas.filter((l) => l.direction === "expense").reduce((s, l) => s + l.amount, 0);
  const listaContas = contas.data ?? [];
  const carregando = pendentes.isLoading;

  return (
    <AppLayout>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-[-0.02em] text-foreground">Conciliação bancária</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Extrato de <strong className="text-foreground">qualquer banco</strong> via Open Finance, classificado pela
            IA e casado com o que você já lançou — só falta a sua revisão
          </p>
        </div>
        {connections.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {connections.map((c) => (
              <Button
                key={c.id}
                variant="outline"
                size="sm"
                className="gap-2"
                disabled={sync.isPending}
                onClick={() => sync.mutate(c.id)}
              >
                {sync.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                {c.institution_name ?? "Banco"}
              </Button>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-border bg-card p-5">
        {carregando ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : linhas.length === 0 ? (
          <div className="py-10">
            <ConnectFirstCTA
              onImportado={recarregar}
              titulo={connections.length > 0 ? "Tudo revisado" : undefined}
              descricao={
                connections.length > 0
                  ? "Nenhuma transação do banco aguardando revisão. Sincronize para buscar novidades."
                  : undefined
              }
            />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="font-medium">
                {selecionadas.size} de {linhas.length} selecionada(s)
              </span>
              <span className="text-muted-foreground">
                Entradas {formatCurrency(totalEntradas)} · Saídas {formatCurrency(totalSaidas)}
              </span>
              {classificando && (
                <Badge variant="secondary" className="gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" /> classificando…
                </Badge>
              )}
              {pendingCount > LIMITE_LOTE && (
                <span className="text-xs text-muted-foreground">
                  Mostrando as {LIMITE_LOTE} mais recentes de {pendingCount}.
                </span>
              )}
            </div>

            <div className="max-h-[56vh] overflow-x-auto overflow-y-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/50">
                  <tr className="text-left">
                    <th className="w-10 px-3 py-2">
                      <Checkbox
                        checked={selecionadas.size === linhas.length}
                        onCheckedChange={(v) =>
                          setSelecionadas(v ? new Set(linhas.map((l) => l.id)) : new Set())
                        }
                        aria-label="Selecionar todas"
                      />
                    </th>
                    <th className="px-3 py-2 font-medium">Data</th>
                    <th className="px-3 py-2 font-medium">Descrição</th>
                    <th className="px-3 py-2 font-medium">Classifiquei como</th>
                    <th className="px-3 py-2 text-right font-medium">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((l) => {
                    const s = sugestoes[l.id];
                    return (
                      <LinhaDetalhe tipo="bank_raw" id={l.id} key={l.id} className="border-t">
                        <td className="px-3 py-2">
                          <Checkbox
                            checked={selecionadas.has(l.id)}
                            onCheckedChange={() => alternar(l.id)}
                            aria-label={`Selecionar ${l.description}`}
                          />
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 tabular-nums">
                          {new Date(l.date + "T00:00:00").toLocaleDateString("pt-BR")}
                        </td>
                        <td className="max-w-[240px] truncate px-3 py-2" title={l.description}>
                          {l.description}
                          {s?.origem === "regra" && (
                            <Badge variant="secondary" className="ml-2 gap-1 text-[10px]">
                              <Compass className="h-2.5 w-2.5" /> regra
                            </Badge>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <Select value={s?.account_id ?? ""} onValueChange={(v) => trocarConta(l.id, v)}>
                            <SelectTrigger className={`h-8 text-xs ${!s?.account_id ? "border-warning/30" : ""}`}>
                              <SelectValue placeholder="Escolher conta" />
                            </SelectTrigger>
                            <SelectContent>
                              {listaContas
                                .filter((c) => c.type === l.direction)
                                .map((c) => (
                                  <SelectItem key={c.id} value={c.id}>
                                    {c.code} {c.name}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td
                          className={`whitespace-nowrap px-3 py-2 text-right tabular-nums ${
                            l.direction === "revenue" ? "text-revenue" : "text-expense"
                          }`}
                        >
                          {l.direction === "revenue" ? "+" : "−"}
                          {formatCurrency(l.amount)}
                        </td>
                      </LinhaDetalhe>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button onClick={importar} disabled={importando || selecionadas.size === 0} className="gap-2">
                {importando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Importar {selecionadas.size} para o resultado
              </Button>
              <Button
                variant="outline"
                onClick={ignorar}
                disabled={ignorando || selecionadas.size === 0}
                className="gap-2"
              >
                {ignorando ? <Loader2 className="h-4 w-4 animate-spin" /> : <EyeOff className="h-4 w-4" />}
                Ignorar selecionadas
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Transferências entre contas próprias e estornos podem ser ignorados: não são receita nem despesa.
            </p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
