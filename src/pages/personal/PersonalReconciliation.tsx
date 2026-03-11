import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Check, X, GitMerge, Loader2, AlertTriangle } from "lucide-react";

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

export default function PersonalReconciliation() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [resolving, setResolving] = useState<string | null>(null);

  const { data: candidates = [], isLoading, refetch } = useQuery({
    queryKey: ["reconciliation_candidates", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase.functions.invoke("reconcile-transactions", {
        body: { action: "list_pending", user_id: user.id },
      });
      if (error) throw error;
      return (data?.candidates || []) as Candidate[];
    },
    enabled: !!user?.id,
  });

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

  const handleResolve = (candidate: Candidate, decision: "confirm" | "reject") => {
    setResolving(`${candidate.incoming_id}_${decision}`);
    resolveMutation.mutate({
      transactionId: candidate.incoming_id,
      matchId: candidate.match_id,
      decision,
    });
  };

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
              Resolva possíveis duplicatas entre lançamentos manuais e dados de APIs
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
              Buscando possíveis duplicatas...
            </CardContent>
          </Card>
        ) : candidates.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Check className="h-10 w-10 text-revenue mx-auto mb-3 opacity-60" />
              <p className="text-foreground font-medium">Tudo conciliado!</p>
              <p className="text-sm text-muted-foreground mt-1">
                Não há duplicatas pendentes para resolver.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
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
                      <CardTitle className="text-sm font-medium">
                        Possível duplicata
                      </CardTitle>
                      <Badge variant="outline" className="text-xs">
                        {candidate.match_score}% match
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="p-3 rounded-lg bg-muted/50">
                        <p className="text-xs text-muted-foreground mb-1 font-medium">Lançamento Manual</p>
                        <p className="font-medium text-foreground">{candidate.match_description}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {candidate.match_date} • {fmt(candidate.match_amount)}
                        </p>
                        <Badge variant="secondary" className="mt-1 text-[10px]">
                          {candidate.match_source}
                        </Badge>
                      </div>
                      <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                        <p className="text-xs text-muted-foreground mb-1 font-medium">Dados da API</p>
                        <p className="font-medium text-foreground">Transação importada</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          ID: {candidate.incoming_id.slice(0, 8)}...
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1"
                        disabled={isResolving}
                        onClick={() => handleResolve(candidate, "reject")}
                      >
                        <X className="h-3 w-3" />
                        Manter ambas
                      </Button>
                      <Button
                        size="sm"
                        className="gap-1"
                        disabled={isResolving}
                        onClick={() => handleResolve(candidate, "confirm")}
                      >
                        {isResolving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                        Conciliar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
