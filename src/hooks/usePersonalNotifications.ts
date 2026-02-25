import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

function fmt(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

const eventMap: Record<string, { icon: string; style: "default" | "success" | "warning" | "error" | "info" }> = {
  PAYMENT_RECEIVED: { icon: "💰", style: "success" },
  PAYMENT_CONFIRMED: { icon: "✅", style: "info" },
  PAYMENT_OVERDUE: { icon: "⚠️", style: "warning" },
  PAYMENT_REFUNDED: { icon: "🔄", style: "error" },
  TRANSFER_DONE: { icon: "📤", style: "default" },
  BILL_PAID: { icon: "📄", style: "default" },
};

export function usePersonalNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Unread alerts count
  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["personal_alerts_unread", user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      const { count, error } = await supabase
        .from("personal_alerts")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_read", false)
        .eq("is_dismissed", false);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!user?.id,
  });

  // Recent alerts
  const { data: alerts = [] } = useQuery({
    queryKey: ["personal_alerts", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("personal_alerts")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_dismissed", false)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Realtime subscription for webhook events
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel("personal-notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "asaas_webhook_events",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const evt = payload.new as any;
          const eventType = evt.event_type || "";
          const mapping = eventMap[eventType];
          if (!mapping) return;

          const p = evt.payload?.payment || evt.payload || {};
          const value = p.value ? fmt(Number(p.value)) : "";
          const desc = p.description || p.customer || "";

          const message = `${mapping.icon} ${value}${desc ? ` — ${desc}` : ""}`;

          toast(message, {
            description: eventType.replace(/_/g, " "),
            duration: 5000,
          });

          // Invalidate alerts
          queryClient.invalidateQueries({ queryKey: ["personal_alerts"] });
          queryClient.invalidateQueries({ queryKey: ["personal_alerts_unread"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  const markAsRead = async (alertId: string) => {
    await supabase
      .from("personal_alerts")
      .update({ is_read: true })
      .eq("id", alertId);
    queryClient.invalidateQueries({ queryKey: ["personal_alerts"] });
    queryClient.invalidateQueries({ queryKey: ["personal_alerts_unread"] });
  };

  const markAllRead = async () => {
    if (!user?.id) return;
    await supabase
      .from("personal_alerts")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("is_read", false);
    queryClient.invalidateQueries({ queryKey: ["personal_alerts"] });
    queryClient.invalidateQueries({ queryKey: ["personal_alerts_unread"] });
  };

  return { alerts, unreadCount, markAsRead, markAllRead };
}
