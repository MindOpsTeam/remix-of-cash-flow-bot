import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface RealtimeConfig {
  table: string;
  filter?: string; // e.g. "user_id=eq.xxx"
  queryKeys: string[][];
}

/**
 * Subscribes to Supabase Realtime changes on multiple tables
 * and invalidates the corresponding React Query keys.
 */
export function useRealtimeInvalidation(
  channelName: string,
  configs: RealtimeConfig[]
) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (configs.length === 0) return;

    let channel = supabase.channel(channelName);

    for (const config of configs) {
      const opts: any = {
        event: "*" as const,
        schema: "public",
        table: config.table,
      };
      if (config.filter) {
        opts.filter = config.filter;
      }

      channel = channel.on(
        "postgres_changes" as any,
        opts,
        () => {
          for (const key of config.queryKeys) {
            queryClient.invalidateQueries({ queryKey: key });
          }
        }
      );
    }

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelName, configs, queryClient]);
}
