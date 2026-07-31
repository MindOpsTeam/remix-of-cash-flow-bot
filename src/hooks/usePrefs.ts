import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * Fonte única de user_preferences.prefs (jsonb) com escrita SEGURA: o upsert
 * antigo de Preferences.tsx sobrescrevia o objeto inteiro, então um segundo
 * escritor (favoritos) apagaria as preferências. Aqui toda escrita é
 * ler-mesclar-gravar; escritores parciais nunca se atropelam.
 */

export interface Prefs {
  favoritos?: string[];
  [chave: string]: unknown;
}

type PrefsFrom = (table: string) => {
  select: (q: string) => {
    eq: (c: string, v: string) => {
      maybeSingle: () => PromiseLike<{ data: unknown; error: { message: string } | null }>;
    };
  };
  upsert: (row: Record<string, unknown>, opts: { onConflict: string }) => PromiseLike<{ error: { message: string } | null }>;
};
const prefsTable = () => (supabase.from as unknown as PrefsFrom)("user_preferences");

export function usePrefs() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["user_prefs", user?.id],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await prefsTable().select("prefs").eq("user_id", user!.id).maybeSingle();
      return (((data as { prefs?: Prefs } | null)?.prefs) ?? {}) as Prefs;
    },
  });

  const patch = useMutation({
    mutationFn: async (parcial: Prefs) => {
      const { data } = await prefsTable().select("prefs").eq("user_id", user!.id).maybeSingle();
      const atuais = (((data as { prefs?: Prefs } | null)?.prefs) ?? {}) as Prefs;
      const { error } = await prefsTable().upsert(
        { user_id: user!.id, prefs: { ...atuais, ...parcial } },
        { onConflict: "user_id" },
      );
      if (error) throw new Error(error.message);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["user_prefs", user?.id] }),
  });

  return { prefs: query.data ?? {}, isLoading: query.isLoading, patch };
}
