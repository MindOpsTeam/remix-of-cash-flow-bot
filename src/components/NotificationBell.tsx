import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { EmptyState } from "@viverdeia/design-system";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";

/**
 * Sino de verdade: lê a tabela notifications (escrita pelos agentes), badge de
 * não lidas, marcar tudo como lido e realtime para o aviso chegar sem refresh.
 */
interface Notificacao {
  id: string;
  titulo: string;
  corpo: string | null;
  link: string | null;
  lida: boolean;
  created_at: string;
}

type NotificationsFrom = (table: string) => {
  select: (q: string) => {
    eq: (c: string, v: string) => {
      order: (c: string, o: { ascending: boolean }) => {
        limit: (n: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
      };
    };
  };
  update: (patch: Record<string, unknown>) => {
    eq: (c: string, v: string) => {
      eq: (c: string, v: boolean) => PromiseLike<{ error: { message: string } | null }>;
    };
  };
};
const notificationsTable = () => (supabase.from as unknown as NotificationsFrom)("notifications");

export function NotificationBell() {
  const { company } = useCompany();
  const queryClient = useQueryClient();

  const { data: notificacoes = [] } = useQuery({
    queryKey: ["notifications", company?.id],
    enabled: !!company,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await notificationsTable()
        .select("id, titulo, corpo, link, lida, created_at")
        .eq("company_id", company!.id)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw new Error(error.message);
      return (data ?? []) as Notificacao[];
    },
  });

  useEffect(() => {
    if (!company?.id) return;
    const channel = supabase
      .channel(`notifications-${company.id}`)
      .on(
        // O overload tipado ainda não conhece a tabela nova; o filtro é validado em runtime.
        "postgres_changes" as never,
        { event: "INSERT", schema: "public", table: "notifications", filter: `company_id=eq.${company.id}` } as never,
        () => queryClient.invalidateQueries({ queryKey: ["notifications", company.id] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [company?.id, queryClient]);

  const naoLidas = notificacoes.filter((n) => !n.lida).length;

  const marcarLidas = useMutation({
    mutationFn: async () => {
      const { error } = await notificationsTable()
        .update({ lida: true })
        .eq("company_id", company!.id)
        .eq("lida", false);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications", company?.id] }),
  });

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 rounded-full"
          aria-label={`Notificações${naoLidas > 0 ? ` (${naoLidas} não lidas)` : ""}`}
        >
          <Bell className="h-4 w-4" />
          {naoLidas > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--via-coral)] px-1 font-mono text-[10px] font-semibold leading-none text-white">
              {naoLidas > 9 ? "9+" : naoLidas}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h4 className="text-sm font-semibold">Notificações</h4>
          {naoLidas > 0 && (
            <button
              type="button"
              onClick={() => marcarLidas.mutate()}
              className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <CheckCheck className="h-3.5 w-3.5" /> Marcar lidas
            </button>
          )}
        </div>
        {notificacoes.length === 0 ? (
          <EmptyState
            className="border-0 py-8 shadow-none"
            variant="soft"
            icon={<Bell size={18} strokeWidth={1.8} />}
            title="Tudo em dia"
            description="Os avisos dos seus agentes aparecem aqui."
          />
        ) : (
          <div className="max-h-[380px] overflow-y-auto">
            {notificacoes.map((n) => {
              const conteudo = (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-xs ${n.lida ? "font-normal text-muted-foreground" : "font-semibold text-foreground"}`}>
                      {n.titulo}
                    </p>
                    {!n.lida && <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--via-data-1)]" />}
                  </div>
                  {n.corpo && (
                    <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">{n.corpo}</p>
                  )}
                  <p className="mt-1 text-[10px] text-muted-foreground/70">
                    {new Date(n.created_at).toLocaleString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </>
              );
              const classes =
                "block border-b border-border/60 px-4 py-3 last:border-b-0 transition-colors hover:bg-muted/40";
              return n.link ? (
                <Link key={n.id} to={n.link} className={classes}>
                  {conteudo}
                </Link>
              ) : (
                <div key={n.id} className={classes}>
                  {conteudo}
                </div>
              );
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
