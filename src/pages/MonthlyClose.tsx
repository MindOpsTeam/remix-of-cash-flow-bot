import { AppLayout } from "@/components/AppLayout";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  CalendarCheck, CheckCircle2, AlertCircle, Loader2, Lock, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { useAuth } from "@/hooks/useAuth";
import { formatMonth } from "@/lib/margin";

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
      return data as { id: string; status: string; closed_at: string | null } | null;
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

  const closeMutation = useMutation({
    mutationFn: async () => {
      const snapshot = Object.fromEntries(checklist.map((i) => [i.key, i.count]));
      const payload = {
        company_id: company!.id,
        month: selected,
        status: "closed",
        snapshot,
        closed_at: new Date().toISOString(),
        closed_by: user?.id ?? null,
      };
      const { error } = await (supabase as any)
        .from("monthly_close")
        .upsert(payload, { onConflict: "company_id,month" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`Mês ${formatMonth(selected)} fechado`);
      qc.invalidateQueries({ queryKey: ["monthly_close", company?.id] });
    },
    onError: (e: Error) => toast.error("Erro ao fechar: " + e.message),
  });

  const reopenMutation = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any)
        .from("monthly_close")
        .update({ status: "open", closed_at: null })
        .eq("company_id", company!.id)
        .eq("month", selected);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Mês reaberto");
      qc.invalidateQueries({ queryKey: ["monthly_close", company?.id] });
    },
  });

  const months = [monthKey(0), monthKey(-1), monthKey(-2), monthKey(-3)];

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

        <div className="mb-5 flex flex-wrap gap-2">
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

        {isClosed && (
          <div className="mb-5 flex items-center justify-between rounded-lg border border-[hsl(var(--success))]/40 bg-[hsl(var(--success))]/5 p-4">
            <div className="flex items-center gap-2 text-sm">
              <Lock className="h-4 w-4 text-[hsl(var(--success))]" />
              <span>
                Mês fechado em {closeRow?.closed_at ? new Date(closeRow.closed_at).toLocaleDateString("pt-BR") : "—"}.
              </span>
            </div>
            <Button size="sm" variant="outline" onClick={() => reopenMutation.mutate()}>
              Reabrir
            </Button>
          </div>
        )}

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
