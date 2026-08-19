import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";

/**
 * Segredo que autoriza as chamadas do pg_cron às edge functions.
 *
 * Vive no Vault e é lido por `get_cron_secret()` (execute só para service_role).
 * NÃO existe fallback para variável de ambiente, de propósito: toda
 * leitura de env numa edge function faz o Lovable pedir aquela chave na tela
 * "Update secrets" do remix, que é justamente a fricção que este arquivo
 * remove. Num remix o env não existiria, então o fallback só mascararia o erro.
 *
 * O valor é gerado pela migration 20260819160000_cron_secret_no_vault.sql, um
 * por instalação. Ninguém digita nada.
 */
export async function getCronSecret(): Promise<string | null> {
  try {
    const svc = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );
    const { data, error } = await svc.rpc("get_cron_secret");
    if (error) {
      console.error("[cron] get_cron_secret falhou:", error.message);
      return null;
    }
    return (data as string | null) ?? null;
  } catch (err) {
    console.error("[cron] get_cron_secret exceção:", String(err));
    return null;
  }
}
