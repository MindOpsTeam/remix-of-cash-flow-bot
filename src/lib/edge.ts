import { supabase } from "@/integrations/supabase/client";

/**
 * Headers autenticados para chamar edge functions via fetch cru (necessário
 * para respostas em streaming/SSE, onde supabase.functions.invoke não serve).
 *
 * Usa SEMPRE o access_token da sessão do usuário logado. Mandar a publishable
 * key como Bearer faz getUser() retornar null na edge → 401 (bug que derrubava
 * CFO Digital, o resumo de IA do dashboard e o OCR de documentos).
 */
export async function edgeAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

export function edgeUrl(fn: string): string {
  return `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${fn}`;
}
