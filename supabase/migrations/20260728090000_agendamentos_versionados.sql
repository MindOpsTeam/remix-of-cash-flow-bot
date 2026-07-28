-- Os agendamentos do pg_cron passam a existir no repositório.
--
-- Dois problemas de uma vez:
--
--   1. Os cinco jobs foram criados direto no banco e não existiam em migration
--      nenhuma. Ambiente novo subia sem cobrança, sem alerta, sem faturamento
--      de contrato e sem sincronismo de alíquota, e ninguém perceberia até o
--      cliente perguntar por que o contrato não gerou recebível.
--
--   2. Pior: o `CRON_SECRET` estava em TEXTO CLARO dentro de
--      `cron.job.command`. Qualquer um com leitura no schema `cron` lia o
--      segredo que autentica as chamadas internas, e versionar o agendamento
--      como estava significaria commitar o segredo junto.
--
-- A função abaixo busca o segredo no Vault na hora da chamada. O agendamento
-- passa a guardar só o nome da função, e o segredo sai do texto do job.
--
-- Pré-requisito: o segredo precisa existir no Vault com o nome CRON_SECRET.
-- Sem ele a função falha alto, de propósito: agendamento que erra calado é
-- pior do que agendamento que não roda.

CREATE OR REPLACE FUNCTION public.chamar_funcao_agendada(p_slug text)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_secret text;
  v_url text;
BEGIN
  SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET' LIMIT 1;

  IF v_secret IS NULL OR v_secret = '' THEN
    RAISE EXCEPTION 'CRON_SECRET não está no Vault. Os agendamentos não podem autenticar.';
  END IF;

  v_url := 'https://oxymhnddzamsjxwfglud.supabase.co/functions/v1/' || p_slug;

  RETURN net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', v_secret
    ),
    body := '{}'::jsonb
  );
END;
$$;

REVOKE ALL ON FUNCTION public.chamar_funcao_agendada(text) FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.chamar_funcao_agendada(text) IS
  'Chama uma edge function pelo slug, buscando o CRON_SECRET no Vault. Usada só pelos jobs do pg_cron.';

-- Reagenda os cinco jobs sem o segredo no comando. `cron.schedule` com nome
-- existente substitui, então isto é idempotente.
SELECT cron.schedule('smart-alerts-daily',      '0 11 * * *',  $$SELECT public.chamar_funcao_agendada('smart-alerts')$$);
SELECT cron.schedule('agent-anomalies-daily',   '30 11 * * *', $$SELECT public.chamar_funcao_agendada('agent-anomalies')$$);
SELECT cron.schedule('agent-collections-daily', '0 12 * * *',  $$SELECT public.chamar_funcao_agendada('agent-collections')$$);
SELECT cron.schedule('contracts-billing-daily', '0 6 * * *',   $$SELECT public.chamar_funcao_agendada('contracts-billing')$$);
SELECT cron.schedule('tax-rates-sync-weekly',   '0 4 * * 1',   $$SELECT public.chamar_funcao_agendada('tax-rates-sync')$$);
