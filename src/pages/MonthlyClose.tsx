import { mensagemDeErro } from "@/lib/erros";
import { AppLayout } from "@/components/AppLayout";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  CalendarCheck, CheckCircle2, AlertCircle, Loader2, Lock, ChevronRight, Compass,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { useAuth } from "@/hooks/useAuth";
import { formatMonth } from "@/lib/margin";

/** O que fechar_mes grava: o resultado apurado, não contagem de pendências. */
interface SnapshotFechamento {
  receita?: number;
  custos?: number;
  despesas?: number;
  lucro_bruto?: number;
  lucro_liquido?: number;
  a_classificar?: number;
  lancamentos?: number;
  reaberturas?: Array<{ em: string; por: string; motivo: string }>;
}

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface ChecklistItem {
  key: string;
  label: string;
  count: number;
  href: string;
}

function monthKey(offset: number): string {
  const d = new Date();
  const m = new Date(d.getFullYear(), d.getMonth() + offset, 1);
  return `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}-01`;
}

function monthRange(key: string): { start: string; end: string } {
  const [y, m] = key.split("-").map(Number);
  const start = key;
  const end = `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}-01`;
  return { start, end };
}

export default function MonthlyClose() {
  const { company } = useCompany();
  const { user } = useAuth();
  const qc = useQueryClient();
  // Fechamento sempre olha o mês anterior por padrão
  const [selected, setSelected] = useState(monthKey(-1));
  const [reabrindo, setReabrindo] = useState(false);
  const [motivoReabertura, setMotivoReabertura] = useState("");
  const { start, end } = monthRange(selected);

  const { data: closeRow } = useQuery({
    queryKey: ["monthly_close", company?.id, selected],
    enabled: !!company,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("monthly_close")
        .select("*")
        .eq("company_id", company!.id)
        .eq("month", selected)
        .maybeSingle();
      return data as {
        id: string;
        status: string;
        closed_at: string | null;
        snapshot: SnapshotFechamento | null;
      } | null;
    },
  });

  const { data: checklist = [], isLoading } = useQuery({
    queryKey: ["close_checklist", company?.id, selected],
    enabled: !!company,
    queryFn: async (): Promise<ChecklistItem[]> => {
      const cid = company!.id;
      const [semConta, pendentes, vencidas] = await Promise.all([
        supabase
          .from("transactions")
          .select("id", { count: "exact", head: true })
          .eq("company_id", cid)
          .gte("date", start)
          .lt("date", end)
          .is("account_id", null),
        supabase
          .from("transactions")
          .select("id", { count: "exact", head: true })
          .eq("company_id", cid)
          .gte("date", start)
          .lt("date", end)
          .eq("status", "pending"),
        (supabase as any)
          .from("company_asaas_payments")
          .select("id", { count: "exact", head: true })
          .eq("company_id", cid)
          .eq("status", "OVERDUE"),
      ]);
      return [
        {
          key: "sem_conta",
          label: "Lançamentos sem conta contábil (classifique com IA em Transações)",
          count: semConta.count ?? 0,
          href: "/transactions",
        },
        {
          key: "pendentes",
          label: "Lançamentos pendentes de confirmação",
          count: pendentes.count ?? 0,
          href: "/transactions",
        },
        {
          key: "vencidas",
          label: "Cobranças vencidas em aberto (Agente de Cobrança pode ajudar)",
          count: vencidas.count ?? 0,
          href: "/agents",
        },
      ];
    },
  });

  const totalPendencias = checklist.reduce((s, i) => s + i.count, 0);
  const isClosed = closeRow?.status === "closed";
  const snapshotFechado = isClosed ? closeRow?.snapshot ?? null : null;

  // Fechar e reabrir passam pelas funções do banco, e não por escrita direta na
  // tabela. Duas razões: a apuração do resultado tem que sair da mesma régua do
  // DRE (a tela gravava CONTAGEM DE PENDÊNCIAS como se fosse snapshot, então
  // não havia como provar depois qual era o lucro), e reabrir precisa exigir
  // motivo, o que a tabela sozinha não sabe cobrar.
  const closeMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("fechar_mes" as never, {
        p_company_id: company!.id,
        p_mes: selected,
      } as never);
      if (error) throw error;
      return data as unknown as { lucro_liquido: number; a_classificar: number };
    },
    onSuccess: (snap) => {
      toast.success(`Mês ${formatMonth(selected)} fechado. Lucro apurado: ${brl(snap?.lucro_liquido ?? 0)}`, {
        description: Number(snap?.a_classificar) > 0
          ? `${brl(Number(snap.a_classificar))} ficaram fora por não ter conta contábil.`
          : undefined,
      });
      qc.invalidateQueries({ queryKey: ["monthly_close", company?.id] });
    },
    onError: (e: Error) => toast.error("Erro ao fechar: " + mensagemDeErro(e)),
  });

  const reopenMutation = useMutation({
    mutationFn: async (motivo: string) => {
      const { error } = await supabase.rpc("reabrir_mes" as never, {
        p_company_id: company!.id,
        p_mes: selected,
        p_motivo: motivo,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Mês reaberto. O motivo ficou registrado no fechamento.");
      qc.invalidateQueries({ queryKey: ["monthly_close", company?.id] });
    },
    onError: (e: Error) => toast.error("Erro ao reabrir: " + mensagemDeErro(e)),
  });

  const months = [monthKey(0), monthKey(-1), monthKey(-2), monthKey(-3)];

  // Resolução em lote: classifica com IA os lançamentos sem conta contábil do mês
  const [classifying, setClassifying] = useState(false);
  const batchClassify = async () => {
    if (!company) return;
    setClassifying(true);
    try {
      const { data: pending } = await supabase
        .from("transactions")
        .select("id, description, type")
        .eq("company_id", company.id)
        .gte("date", start)
        .lt("date", end)
        .is("account_id", null)
        .limit(300);

      if (!pending || pending.length === 0) {
        toast.info("Nenhum lançamento sem conta neste mês");
        return;
      }

      // Uma chamada para o lote inteiro, e não uma por lançamento. A regra
      // aprendida da empresa roda primeiro, com custo zero, e só o que sobra
      // vai ao modelo. Com 20 lançamentos isso era 20 chamadas de IA.
      const { data, error: erroLote } = await supabase.functions.invoke("classificar-lote", {
        body: {
          company_id: company.id,
          itens: pending.map((t) => ({ descricao: t.description, tipo: t.type })),
        },
      });
      if (erroLote) throw erroLote;

      const resposta = data as {
        itens: Array<{ account_id: string | null; cost_center_id: string | null }>;
        resumo: { por_regra: number; por_ia: number };
      };

      let resolved = 0;
      for (let i = 0; i < pending.length; i++) {
        const sugestao = resposta.itens?.[i];
        if (!sugestao?.account_id) continue;
        const { error } = await supabase
          .from("transactions")
          .update({
            account_id: sugestao.account_id,
            cost_center_id: sugestao.cost_center_id ?? undefined,
          })
          .eq("id", pending[i].id);
        if (!error) resolved++;
      }

      toast.success(`${resolved} de ${pending.length} lançamento(s) classificados`, {
        description: `${resposta.resumo?.por_regra ?? 0} por regra aprendida (sem custo) e ${resposta.resumo?.por_ia ?? 0} pela IA.`,
      });
      qc.invalidateQueries({ queryKey: ["close_checklist", company.id, selected] });
    } catch (e) {
      toast.error("Não consegui classificar agora: " + mensagemDeErro(e));
    } finally {
      setClassifying(false);
    }
  };

  return (
    <AppLayout>
      <div className="animate-fade-in max-w-3xl">
        <div className="mb-6">
          <div className="flex items-center gap-2">
            <CalendarCheck className="h-5 w-5 text-primary" />
            <h1 className="text-[28px] font-semibold tracking-[-0.02em]">Fechamento mensal</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Resolva as pendências e feche o mês para congelar o resultado gerencial de {company?.name}.
          </p>
        </div>

        <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            {months.map((m) => (
              <Button
                key={m}
                size="sm"
                variant={selected === m ? "default" : "outline"}
                onClick={() => setSelected(m)}
              >
                {formatMonth(m)}
              </Button>
            ))}
          </div>
          <Button size="sm" variant="outline" className="gap-2" onClick={batchClassify} disabled={classifying}>
            {classifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Compass className="h-4 w-4" />}
            Classificar pendentes com IA
          </Button>
        </div>

        {isClosed && (
          <div className="mb-5 rounded-lg border border-[hsl(var(--success))]/40 bg-[hsl(var(--success))]/5 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm">
                <Lock className="h-4 w-4 text-[hsl(var(--success))]" />
                <span>
                  Mês fechado em {closeRow?.closed_at ? new Date(closeRow.closed_at).toLocaleDateString("pt-BR") : "—"}.
                  Lançar, alterar valor ou excluir neste período está bloqueado no banco.
                </span>
              </div>
              <Button size="sm" variant="outline" onClick={() => setReabrindo(true)}>
                Reabrir
              </Button>
            </div>

            {snapshotFechado && (
              <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 border-t border-[hsl(var(--success))]/20 pt-3 text-xs sm:grid-cols-4">
                {[
                  ["Receita", snapshotFechado.receita],
                  ["Custos", snapshotFechado.custos],
                  ["Despesas", snapshotFechado.despesas],
                  ["Lucro líquido", snapshotFechado.lucro_liquido],
                ].map(([rotulo, valor]) => (
                  <div key={String(rotulo)}>
                    <dt className="text-muted-foreground">{rotulo}</dt>
                    <dd className="font-medium tabular-nums">{brl(Number(valor) || 0)}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        )}

        <Dialog open={reabrindo} onOpenChange={setReabrindo}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Reabrir {formatMonth(selected)}</DialogTitle>
              <DialogDescription>
                O resultado já apurado continua guardado. O motivo fica no histórico do fechamento, para o contador
                saber por que o período foi mexido depois de publicado.
              </DialogDescription>
            </DialogHeader>
            <Textarea
              rows={3}
              value={motivoReabertura}
              onChange={(e) => setMotivoReabertura(e.target.value)}
              placeholder="Ex.: nota do fornecedor chegou depois do fechamento"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setReabrindo(false)}>Cancelar</Button>
              <Button
                disabled={motivoReabertura.trim().length < 5 || reopenMutation.isPending}
                onClick={() =>
                  reopenMutation.mutate(motivoReabertura.trim(), {
                    onSuccess: () => { setReabrindo(false); setMotivoReabertura(""); },
                  })
                }
              >
                {reopenMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Reabrir mês
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-3">
            {checklist.map((item) => (
              <Link
                key={item.key}
                to={item.href}
                className="flex items-center justify-between rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted/40"
              >
                <div className="flex items-center gap-3">
                  {item.count === 0 ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-[hsl(var(--success))]" />
                  ) : (
                    <AlertCircle className="h-5 w-5 shrink-0 text-[hsl(var(--warning))]" />
                  )}
                  <span className="text-sm">{item.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={item.count === 0 ? "secondary" : "default"}>{item.count}</Badge>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </Link>
            ))}
          </div>
        )}

        {!isClosed && (
          <div className="mt-6 flex items-center justify-between rounded-lg border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground">
              {totalPendencias === 0
                ? "Tudo resolvido — pode fechar o mês."
                : `${totalPendencias} pendência(s). Você ainda pode fechar, mas o snapshot registrará as pendências.`}
            </p>
            <Button onClick={() => closeMutation.mutate()} disabled={closeMutation.isPending} className="gap-2">
              {closeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
              Fechar {formatMonth(selected)}
            </Button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
