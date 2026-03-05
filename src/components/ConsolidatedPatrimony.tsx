import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Scale, ArrowRight, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { usePersonalAccounts } from "@/hooks/usePersonalAccounts";
import { useCompany } from "@/hooks/useCompany";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

function fmt(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

export function ConsolidatedPatrimony() {
  const { user } = useAuth();
  const { company } = useCompany();
  const { totalBalance: pfBalance, isLoading: pfLoading } = usePersonalAccounts();

  // Fetch PJ balance from transactions
  const { data: pjData, isLoading: pjLoading } = useQuery({
    queryKey: ["pj_balance_consolidated", company?.id],
    queryFn: async () => {
      if (!company?.id) return { balance: 0, revenue: 0, expense: 0 };
      const { data, error } = await supabase
        .from("transactions")
        .select("amount, type")
        .eq("company_id", company.id)
        .eq("status", "confirmed");
      if (error) throw error;
      const revenue = (data || [])
        .filter((t) => t.type === "revenue")
        .reduce((s, t) => s + Number(t.amount), 0);
      const expense = (data || [])
        .filter((t) => t.type === "expense")
        .reduce((s, t) => s + Number(t.amount), 0);
      return { balance: revenue - expense, revenue, expense };
    },
    enabled: !!company?.id,
  });

  // Fetch company Asaas balance (PJ gateway)
  const { data: companyAsaasConfig } = useQuery({
    queryKey: ["company_asaas_config_exists", company?.id],
    queryFn: async () => {
      if (!company?.id) return null;
      const { data, error } = await supabase
        .from("company_asaas_config")
        .select("id, environment")
        .eq("company_id", company.id)
        .maybeSingle();
      if (error) return null;
      return data;
    },
    enabled: !!company?.id,
  });

  const { data: companyAsaasBalance = 0 } = useQuery({
    queryKey: ["company_asaas_balance_consolidated", company?.id],
    queryFn: async () => {
      if (!company?.id) return 0;
      // Try edge function first
      try {
        const { data, error } = await supabase.functions.invoke("company-asaas-api", {
          body: { action: "test-connection", company_id: company.id },
        });
        if (!error && data?.ok && typeof data?.data?.totalBalance === "number") {
          return data.data.totalBalance;
        }
      } catch {}
      // Fallback: sum from company_asaas_payments
      const { data: payments, error } = await supabase
        .from("company_asaas_payments")
        .select("net_value")
        .eq("company_id", company.id)
        .in("status", ["RECEIVED", "CONFIRMED"]);
      if (error) return 0;
      return (payments || []).reduce((sum, p) => sum + (Number(p.net_value) || 0), 0);
    },
    enabled: !!company?.id && !!companyAsaasConfig,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  // Fetch recent owner transactions
  const { data: ownerTxs = [] } = useQuery({
    queryKey: ["owner_transactions_recent", user?.id, company?.id],
    queryFn: async () => {
      if (!user?.id || !company?.id) return [];
      const { data, error } = await supabase
        .from("owner_transactions")
        .select("*")
        .eq("user_id", user.id)
        .eq("company_id", company.id)
        .order("date", { ascending: false })
        .limit(3);
      if (error) return [];
      return data || [];
    },
    enabled: !!user?.id && !!company?.id,
  });

  const pjTransactionsBalance = pjData?.balance ?? 0;
  const pjBalance = pjTransactionsBalance + companyAsaasBalance;
  const totalPatrimony = pfBalance + pjBalance;
  const isLoading = pfLoading || pjLoading;

  // Alert if PJ is negative but PF is positive (possible patrimonial confusion)
  const showAlert = pjBalance < 0 && pfBalance > 0;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-muted-foreground text-sm">
          Carregando patrimônio...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Scale className="h-4 w-4 text-primary" />
          Patrimônio Consolidado
        </CardTitle>
        <Link to="/owner-transactions">
          <Button variant="ghost" size="sm" className="gap-1 text-xs">
            Sócio ↔ Empresa <ArrowRight className="h-3 w-3" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Total */}
        <div className="text-center pb-3 border-b">
          <p className="text-xs text-muted-foreground mb-1">Patrimônio Total</p>
          <p className={`text-3xl font-bold font-mono ${totalPatrimony >= 0 ? "text-foreground" : "text-destructive"}`}>
            {fmt(totalPatrimony)}
          </p>
        </div>

        {/* PF vs PJ breakdown */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">Pessoal (PF)</p>
            <p className={`text-lg font-bold font-mono ${pfBalance >= 0 ? "text-revenue" : "text-destructive"}`}>
              {fmt(pfBalance)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">Empresa (PJ)</p>
            <p className={`text-lg font-bold font-mono ${pjBalance >= 0 ? "text-revenue" : "text-destructive"}`}>
              {fmt(pjBalance)}
            </p>
          </div>
        </div>

        {/* Alert */}
        {showAlert && (
          <div className="flex items-start gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-md p-3">
            <AlertTriangle className="h-4 w-4 text-yellow-600 shrink-0 mt-0.5" />
            <div className="text-xs text-yellow-700 dark:text-yellow-400">
              <p className="font-medium">Atenção: possível confusão patrimonial</p>
              <p className="mt-0.5">
                A empresa está com saldo negativo enquanto seu patrimônio pessoal é positivo.
                Considere registrar um aporte ou verificar se há despesas pessoais na empresa.
              </p>
            </div>
          </div>
        )}

        {/* Recent owner transactions */}
        {ownerTxs.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-2">Últimas movimentações sócio ↔ empresa</p>
            <div className="space-y-1">
              {ownerTxs.map((tx: any) => {
                const isPjToPf = ["retirada", "pro_labore", "dividendo", "emprestimo_pj_pf"].includes(tx.transaction_type);
                return (
                  <div key={tx.id} className="flex items-center justify-between text-xs py-1">
                    <div className="flex items-center gap-1.5">
                      {isPjToPf ? (
                        <TrendingDown className="h-3 w-3 text-destructive" />
                      ) : (
                        <TrendingUp className="h-3 w-3 text-revenue" />
                      )}
                      <span className="text-muted-foreground">{tx.description || tx.transaction_type}</span>
                    </div>
                    <span className={`font-mono ${isPjToPf ? "text-destructive" : "text-revenue"}`}>
                      {fmt(Number(tx.amount))}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
