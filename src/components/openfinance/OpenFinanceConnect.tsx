import { useState } from "react";
import { PluggyConnect } from "react-pluggy-connect";
import { Link2, RefreshCw, Trash2, Loader2, Building2, AlertCircle, CheckCircle2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { useBankConnections } from "@/hooks/useBankConnections";
import { CONNECTION_STATUS_LABEL } from "@/lib/openfinance";
import { Link } from "react-router-dom";

/**
 * Conectar bancos via Open Finance (Pluggy). Abre o widget oficial e registra
 * a conexão; graceful quando as credenciais ainda não estão configuradas.
 */
export function OpenFinanceConnect() {
  const { company } = useCompany();
  const { connections, isLoading, pendingCount, sync, disconnect, refetch } = useBankConnections();
  const [token, setToken] = useState<string | null>(null);
  const [loadingToken, setLoadingToken] = useState(false);

  const startConnect = async () => {
    if (!company) return;
    setLoadingToken(true);
    try {
      const { data, error } = await supabase.functions.invoke("openfinance-connect", {
        body: { action: "token", company_id: company.id },
      });
      if (error) {
        // 503 = provedor não configurado
        const msg = (error as { message?: string }).message ?? "";
        if (msg.includes("PLUGGY_NOT_CONFIGURED") || msg.includes("503")) {
          toast.error("Open Finance ainda não configurado. Adicione as credenciais Pluggy nos segredos do projeto.");
          return;
        }
        throw error;
      }
      if (data?.error === "PLUGGY_NOT_CONFIGURED") {
        toast.error("Open Finance ainda não configurado (credenciais Pluggy ausentes).");
        return;
      }
      setToken(data.accessToken);
    } catch (e) {
      toast.error("Erro ao iniciar conexão: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setLoadingToken(false);
    }
  };

  const handleSuccess = async (itemData: { item: { id: string } }) => {
    setToken(null);
    if (!company) return;
    toast.loading("Registrando conexão…", { id: "of-register" });
    try {
      const { data, error } = await supabase.functions.invoke("openfinance-connect", {
        body: { action: "register", company_id: company.id, item_id: itemData.item.id },
      });
      if (error) throw error;
      toast.success(`Banco conectado — ${data?.staged ?? 0} transações trazidas para revisão`, { id: "of-register" });
      refetch();
    } catch (e) {
      toast.error("Erro ao registrar: " + (e instanceof Error ? e.message : String(e)), { id: "of-register" });
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <Link2 className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">Open Finance</h2>
            <p className="text-xs text-muted-foreground">
              Conecte os bancos da empresa e traga o extrato automaticamente para conciliação.
            </p>
          </div>
        </div>
        <Button size="sm" onClick={startConnect} disabled={loadingToken} className="gap-2">
          {loadingToken ? <Loader2 className="h-4 w-4 animate-spin" /> : <Building2 className="h-4 w-4" />}
          Conectar banco
        </Button>
      </div>

      {pendingCount > 0 && (
        <Link
          to="/transactions"
          className="mb-3 flex items-center justify-between rounded-md border border-[hsl(var(--accent))]/30 bg-[hsl(var(--accent))]/5 px-3 py-2 text-sm hover:bg-[hsl(var(--accent))]/10"
        >
          <span>{pendingCount} transação(ões) bancária(s) aguardando revisão</span>
          <ArrowRight className="h-4 w-4" />
        </Link>
      )}

      {isLoading ? (
        <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : connections.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          Nenhum banco conectado ainda. Clique em "Conectar banco" para começar.
        </p>
      ) : (
        <div className="space-y-2">
          {connections.map((c) => {
            const ok = c.status === "updated";
            return (
              <div key={c.id} className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
                <div className="flex items-center gap-3">
                  {c.institution_image ? (
                    <img src={c.institution_image} alt="" className="h-8 w-8 rounded" />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded bg-muted">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                  <div>
                    <div className="text-sm font-medium">{c.institution_name ?? "Banco"}</div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      {ok ? (
                        <CheckCircle2 className="h-3 w-3 text-[hsl(var(--success))]" />
                      ) : (
                        <AlertCircle className="h-3 w-3 text-[hsl(var(--warning))]" />
                      )}
                      {CONNECTION_STATUS_LABEL[c.status] ?? c.status}
                      {c.last_synced_at && ` · atualizado ${new Date(c.last_synced_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}`}
                    </div>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" className="h-8 w-8" title="Sincronizar" disabled={sync.isPending} onClick={() => sync.mutate(c.id)}>
                    {sync.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" title="Remover" onClick={() => disconnect.mutate(c.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {token && (
        <PluggyConnect
          connectToken={token}
          includeSandbox
          onSuccess={handleSuccess}
          onError={() => {
            setToken(null);
            toast.error("Conexão cancelada ou falhou no banco.");
          }}
          onClose={() => setToken(null)}
        />
      )}
    </div>
  );
}
