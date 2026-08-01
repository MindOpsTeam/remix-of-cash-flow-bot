import { mensagemDeErro } from "@/lib/erros";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { toast } from "sonner";

export interface BankConnection {
  id: string;
  provider: string;
  external_id: string;
  institution_name: string | null;
  institution_image: string | null;
  status: string;
  last_synced_at: string | null;
  consent_expires_at: string | null;
}

export function useBankConnections() {
  const { company } = useCompany();
  const qc = useQueryClient();

  const connections = useQuery({
    queryKey: ["bank_connections", company?.id],
    enabled: !!company,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("bank_connections")
        .select("id, provider, external_id, institution_name, institution_image, status, last_synced_at, consent_expires_at")
        .eq("company_id", company!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as BankConnection[];
    },
  });

  const pendingCount = useQuery({
    queryKey: ["bank_raw_pending", company?.id],
    enabled: !!company,
    queryFn: async () => {
      const { count } = await (supabase as any)
        .from("bank_transactions_raw")
        .select("id", { count: "exact", head: true })
        .eq("company_id", company!.id)
        .eq("status", "new");
      return count ?? 0;
    },
  });

  const sync = useMutation({
    mutationFn: async (connectionId: string) => {
      const { data, error } = await supabase.functions.invoke("openfinance-sync", {
        body: { action: "sync", company_id: company!.id, connection_id: connectionId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (d: { staged?: number }) => {
      toast.success(`Sincronizado — ${d?.staged ?? 0} nova(s) transação(ões) para revisar`);
      qc.invalidateQueries({ queryKey: ["bank_connections", company?.id] });
      qc.invalidateQueries({ queryKey: ["bank_raw_pending", company?.id] });
    },
    onError: (e: Error) => toast.error("Erro ao sincronizar: " + mensagemDeErro(e)),
  });

  const disconnect = useMutation({
    mutationFn: async (connectionId: string) => {
      const { error } = await (supabase as any).from("bank_connections").delete().eq("id", connectionId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Conexão removida");
      qc.invalidateQueries({ queryKey: ["bank_connections", company?.id] });
    },
    onError: (e: Error) => toast.error("Erro: " + mensagemDeErro(e)),
  });

  return {
    connections: connections.data ?? [],
    isLoading: connections.isLoading,
    pendingCount: pendingCount.data ?? 0,
    sync,
    disconnect,
    refetch: () => {
      qc.invalidateQueries({ queryKey: ["bank_connections", company?.id] });
      qc.invalidateQueries({ queryKey: ["bank_raw_pending", company?.id] });
    },
  };
}
