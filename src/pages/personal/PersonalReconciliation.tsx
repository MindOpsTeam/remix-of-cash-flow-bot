import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Check, X, GitMerge, Loader2, AlertTriangle, FileQuestion, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function fmt(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

interface Candidate {
  incoming_id: string;
  match_id: string;
  match_score: number;
  match_description: string;
  match_date: string;
  match_amount: number;
  match_source: string;
}

interface OrphanTx {
  id: string;
  title: string;
  amount: number;
  date: string;
  type: string;
  source: string;
  status: string;
}

function sourceLabel(source: string) {
  switch (source) {
    case "whatsapp": return "WhatsApp";
    case "manual": return "Manual";
    case "asaas": return "Asaas";
    case "inter": return "Inter";
    case "api": return "API";
    default: return source;
  }
}

export default function PersonalReconciliation() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [resolving, setResolving] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["reconciliation_candidates", user?.id],
    queryFn: async () => {
      if (!user?.id) return { candidates: [], orphans: [] };
      const { data, error } = await supabase.functions.invoke("reconcile-transactions", {
        body: { action: "list_pending", user_id: user.id },
      });
      if (error) throw error;
      return {
        candidates: (data?.candidates || []) as Candidate[],
        orphans: (data?.orphans || []) as OrphanTx[],
      };
    },
    enabled: !!user?.id,
  });

  const candidates = data?.candidates || [];
  const orphans = data?.orphans || [];

  const resolveMutation = useMutation({
    mutationFn: async ({ transactionId, matchId, decision }: { transactionId: string; matchId: string; decision: "confirm" | "reject" }) => {
      const { data, error } = await supabase.functions.invoke("reconcile-transactions", {
        body: { action: "resolve", transaction_id: transactionId, match_id: matchId, decision, table: "pf" },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      toast.success(variables.decision === "confirm" ? "Transações conciliadas!" : "Duplicata descartada");
      queryClient.invalidateQueries({ queryKey: ["reconciliation_candidates"] });
      queryClient.invalidateQueries({ queryKey: ["personal_transactions"] });
      queryClient.invalidateQueries({ queryKey: ["personal_accounts"] });
      setResolving(null);
    },
    onError: () => {
      toast.error("Erro ao resolver conciliação");
      setResolving(null);
    },
  });

  const reconcileOrphanMutation = useMutation({
    mutationFn: async ({ id, action: act }: { id: string; action: "mark_reconciled" }) => {
      const { error } = await supabase
        .from("personal_transactions")
        .update({ status: "reconciled", source: "reconciled" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Transação conciliada manualmente");
      queryClient.invalidateQueries({ queryKey: ["reconciliation_candidates"] });
      queryClient.invalidateQueries({ queryKey: ["personal_transactions"] });
    },
    onError: () => toast.error("Erro ao conciliar"),
  });

  const handleResolve = (candidate: Candidate, decision: "confirm" | "reject") => {
    setResolving(`${candidate.incoming_id}_${decision}`);
    resolveMutation.mutate({
      transactionId: candidate.incoming_id,
      matchId: candidate.match_id,
      decision,
    });
  };

  const totalItems = candidates.length + orphans.length;

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-[-0.02em] flex items-center gap-2">
              <GitMerge className="h-6 w-6 text-primary" />
              Conciliação
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Resolva duplicatas e revise lançamentos sem contrapartida
            </p>
          </div>
          <Button variant="outline" onClick={() => refetch()} disabled={isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Atualizar"}
          </Button>
        </div>

        {isLoading ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
              Buscando pendências...
            </CardContent>
          </Card>
        ) : totalItems === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Check className="h-10 w-10 text-revenue mx-auto mb-3 opacity-60" />
              <p className="text-foreground font-medium">Tudo conciliado!</p>
              <p className="text-sm text-muted-foreground mt-1">
                Não há pendências para resolver.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue={candidates.length > 0 ? "duplicates" : "orphans"}>
            <TabsList>
              <TabsTrigger value="duplicates" className="gap-1.5">
                <GitMerge className="h-3.5 w-3.5" />
                Duplicatas
                {candidates.length > 0 && (
                  <Badge variant="destructive" className="ml-1 text-[10px] px-1.5 py-0">{candidates.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="orphans" className="gap-1.5">
                <FileQuestion className="h-3.5 w-3.5" />
                Partida Única
                {orphans.length > 0 && (
                  <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">{orphans.length}</Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="duplicates" className="space-y-3 mt-4">
              {candidates.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    <Check className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    Nenhuma duplicata encontrada.
                  </CardContent>
                </Card>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    <AlertTriangle className="h-4 w-4 inline mr-1 text-warning" />
                    {candidates.length} possível(is) duplicata(s) encontrada(s)
                  </p>
                  {candidates.map((candidate) => {
                    const isResolving = resolving?.startsWith(candidate.incoming_id);
                    return (
                      <Card key={`${candidate.incoming_id}_${candidate.match_id}`} className="border-warning/30">
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-sm font-medium">Possível duplicata</CardTitle>
                            <Badge variant="outline" className="text-xs">{candidate.match_score}% match</Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div className="p-3 rounded-lg bg-muted/50">
                              <p className="text-xs text-muted-foreground mb-1 font-medium">Lançamento Manual/WhatsApp</p>
                              <p className="font-medium text-foreground">{candidate.match_description}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {candidate.match_date} • {fmt(candidate.match_amount)}
                              </p>
                              <Badge variant="secondary" className="mt-1 text-[10px]">{sourceLabel(candidate.match_source)}</Badge>
                            </div>
                            <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                              <p className="text-xs text-muted-foreground mb-1 font-medium">Dados da Integração</p>
                              <p className="font-medium text-foreground">Transação importada</p>
                              <p className="text-xs text-muted-foreground mt-1">ID: {candidate.incoming_id.slice(0, 8)}...</p>
                            </div>
                          </div>
                          <div className="flex gap-2 justify-end">
                            <Button variant="outline" size="sm" className="gap-1" disabled={isResolving} onClick={() => handleResolve(candidate, "reject")}>
                              <X className="h-3 w-3" /> Manter ambas
                            </Button>
                            <Button size="sm" className="gap-1" disabled={isResolving} onClick={() => handleResolve(candidate, "confirm")}>
                              {isResolving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Conciliar
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </>
              )}
            </TabsContent>

            <TabsContent value="orphans" className="space-y-3 mt-4">
              {orphans.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    <Check className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    Todos os lançamentos possuem contrapartida.
                  </CardContent>
                </Card>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    <FileQuestion className="h-4 w-4 inline mr-1 text-primary" />
                    {orphans.length} lançamento(s) sem contrapartida — registrados em apenas uma fonte
                  </p>
                  {orphans.map((tx) => (
                    <Card key={tx.id} className="border-muted">
                      <CardContent className="py-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {tx.type === "despesa" ? (
                              <ArrowDownCircle className="h-5 w-5 text-expense shrink-0" />
                            ) : (
                              <ArrowUpCircle className="h-5 w-5 text-revenue shrink-0" />
                            )}
                            <div>
                              <p className="font-medium text-sm text-foreground">{tx.title}</p>
                              <p className="text-xs text-muted-foreground">
                                {tx.date} • {fmt(tx.amount)}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px]">{sourceLabel(tx.source)}</Badge>
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1 text-xs"
                              onClick={() => reconcileOrphanMutation.mutate({ id: tx.id, action: "mark_reconciled" })}
                              disabled={reconcileOrphanMutation.isPending}
                            >
                              <Check className="h-3 w-3" /> Conciliar
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </AppLayout>
  );
}
