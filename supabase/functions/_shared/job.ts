import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";

/**
 * Fechamento do registro de execução de um job.
 *
 * POR QUE ISTO EXISTE
 * O pg_cron dispara por `net.http_post`, que é assíncrono: ele marca o job como
 * "succeeded" mesmo quando a função devolve 500 ou nem carrega. Foi assim que
 * duas edge functions ficaram mortas em produção por semanas sem ninguém ver.
 *
 * `chamar_funcao_agendada` abre uma linha em `job_runs` ANTES do disparo e manda
 * o id no header `X-Job-Run`. Quem fecha a linha é a própria função. Linha que
 * fica aberta é a prova de que a função não respondeu: a ausência vira sinal em
 * vez de virar silêncio.
 *
 * O cliente é criado aqui dentro de propósito. Cada função de cron nomeia o
 * cliente de um jeito, e obrigar todas a passarem o seu transformaria uma
 * mudança de duas linhas em oito refatorações diferentes.
 */

/** Id do run que o cron mandou. Ausente quando a função foi chamada à mão. */
export function idDoJobRun(req: Request): string | null {
  return req.headers.get("x-job-run") || req.headers.get("X-Job-Run") || null;
}

/**
 * Fecha a linha. NUNCA lança: falhar ao registrar não pode derrubar o trabalho
 * que já foi feito, e um erro aqui viraria "job falhou" para um job que rodou.
 */
export async function encerrarJobRun(
  runId: string | null,
  ok: boolean,
  erro?: string,
  detalhe?: Record<string, unknown>,
): Promise<void> {
  if (!runId) return;
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    await supabase.rpc("encerrar_job_run", {
      p_run_id: runId,
      p_ok: ok,
      p_erro: erro ?? null,
      p_detalhe: detalhe ?? null,
    });
  } catch (e) {
    console.error("[job] nao consegui encerrar o run:", e);
  }
}
