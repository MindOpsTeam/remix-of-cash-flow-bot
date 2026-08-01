import { mensagemDeErro } from "@/lib/erros";
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * Convite de equipe, lado do convidado.
 *
 * `capturarConvite` roda na tela pública: guarda o token de ?invite= antes do
 * login/cadastro (o redirect do auth perderia o parâmetro). `useAceitarConvite`
 * roda no shell autenticado: com sessão + token pendente, chama a RPC
 * aceitar_convite UMA vez, avisa e recarrega as empresas.
 */

const CHAVE = "financeai:invite-token";

/**
 * O token pendente, se houver. Lido no cadastro: sem ele no metadata, o gatilho
 * do banco não tem como saber que aquela pessoa foi convidada e recusa a conta.
 */
export function tokenDoConvite(): string | null {
  if (typeof window === "undefined") return null;
  const daUrl = new URLSearchParams(window.location.search).get("invite");
  if (daUrl && /^[0-9a-f-]{36}$/i.test(daUrl)) return daUrl;
  return localStorage.getItem(CHAVE);
}

export function capturarConvite() {
  if (typeof window === "undefined") return false;
  const token = new URLSearchParams(window.location.search).get("invite");
  if (token && /^[0-9a-f-]{36}$/i.test(token)) {
    localStorage.setItem(CHAVE, token);
    return true;
  }
  return localStorage.getItem(CHAVE) !== null;
}

export function useAceitarConvite() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const tentado = useRef(false);

  useEffect(() => {
    if (!user || tentado.current) return;
    const token = localStorage.getItem(CHAVE);
    if (!token) return;
    tentado.current = true;

    (supabase.rpc as unknown as (fn: string, args: Record<string, string>) => PromiseLike<{ data: unknown; error: { message: string } | null }>)(
      "aceitar_convite",
      { p_token: token },
    ).then(({ data, error }) => {
      localStorage.removeItem(CHAVE);
      if (error) {
        toast.error("Convite não aceito: " + mensagemDeErro(error));
        return;
      }
      const r = data as { empresa?: string; ja_era_membro?: boolean };
      toast.success(
        r.ja_era_membro
          ? `Você já fazia parte de ${r.empresa}.`
          : `Bem-vindo à equipe de ${r.empresa}!`,
      );
      queryClient.invalidateQueries();
    });
  }, [user, queryClient]);
}
