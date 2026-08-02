-- Os agendamentos precisam sobreviver ao remix, e apontar para o PRÓPRIO projeto.
--
-- Dois problemas achados na revisão final, e o segundo é grave.
--
-- 1. Os jobs do pg_cron vivem no schema `cron`, não em `public`. O remix do
--    Lovable copia só a estrutura de `public`, então o banco novo nasce com ZERO
--    agendamentos: sem alerta diário, sem faturamento de contrato, sem varredura
--    de cobrança e sem sincronismo de alíquota/municípios. Medido num remix real:
--    `select count(*) from cron.job` = 0.
--
-- 2. `chamar_funcao_agendada` tinha a URL do projeto ORIGINAL escrita no corpo
--    da função. Como função viaja (está em `public`), todo remix herdava essa
--    URL. Enquanto os jobs não existiam, isso ficava latente. No instante em que
--    eu recriasse os agendamentos — que é justamente a correção do item 1 —
--    cada instalação de cliente passaria a chamar as edge functions do template
--    todo dia. Corrigir o item 1 sem o item 2 teria transformado uma ausência
--    silenciosa num vazamento entre projetos.
--
-- Correção: a URL passa a ser um DADO da instalação, gravado pelo app (que sabe
-- para qual Supabase ele aponta), e os agendamentos são recriados por uma função
-- de `public`, chamada no login.

ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS functions_url text;

COMMENT ON COLUMN public.platform_settings.functions_url IS
  'Base das edge functions DESTA instalação. Gravada pelo app no login. Existe porque a URL não pode ser constante no código: ela viaja no remix e apontaria para o projeto de origem.';

/**
 * O app informa em que ambiente está rodando.
 *
 * Idempotente e sem efeito quando nada mudou. Aceita gravação de qualquer
 * autenticado de propósito: quem está logado nesta instalação já é, por
 * definição, desta instalação — e sem isso o primeiro usuário (que ainda não é
 * dono) não conseguiria registrar o ambiente.
 */
CREATE OR REPLACE FUNCTION public.registrar_ambiente(p_functions_url text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_url text;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NULL; END IF;

  v_url := rtrim(coalesce(nullif(trim(p_functions_url), ''), ''), '/');
  -- Só aceita o que parece endereço de funções do Supabase. Sem isso, um valor
  -- torto faria os agendamentos baterem em lugar nenhum, calados.
  IF v_url !~ '^https://[a-z0-9-]+\.supabase\.co/functions/v1$' THEN
    RETURN (SELECT functions_url FROM public.platform_settings WHERE id);
  END IF;

  INSERT INTO public.platform_settings (id, functions_url)
  VALUES (true, v_url)
  ON CONFLICT (id) DO UPDATE SET functions_url = EXCLUDED.functions_url;

  RETURN v_url;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.registrar_ambiente(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_ambiente(text) TO authenticated;

/** Chama uma edge function DESTA instalação, com o segredo vindo do Vault. */
CREATE OR REPLACE FUNCTION public.chamar_funcao_agendada(p_slug text)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_secret text;
  v_base text;
BEGIN
  SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET' LIMIT 1;
  IF v_secret IS NULL OR v_secret = '' THEN
    RAISE EXCEPTION 'CRON_SECRET não está no Vault. Os agendamentos não podem autenticar.';
  END IF;

  SELECT functions_url INTO v_base FROM public.platform_settings WHERE id;
  IF v_base IS NULL OR v_base = '' THEN
    -- Falhar aqui é melhor do que chutar uma URL: chutar significaria chamar o
    -- projeto de outra pessoa.
    RAISE EXCEPTION 'O endereço das edge functions desta instalação não foi registrado ainda.';
  END IF;

  RETURN net.http_post(
    url := v_base || '/' || p_slug,
    headers := jsonb_build_object('Content-Type', 'application/json', 'X-Cron-Secret', v_secret),
    body := '{}'::jsonb
  );
END;
$$;

REVOKE ALL ON FUNCTION public.chamar_funcao_agendada(text) FROM PUBLIC, anon, authenticated;

/**
 * Recria os agendamentos desta instalação. Idempotente: `cron.schedule` com nome
 * existente substitui.
 *
 * Só agenda quando há CRON_SECRET e endereço registrados. Agendar antes disso
 * criaria cinco jobs falhando todo dia numa instalação que o cliente ainda nem
 * configurou — ruído que ensina a ignorar erro.
 */
CREATE OR REPLACE FUNCTION public.garantir_agendamentos()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_base text; v_secret text; v_n integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN RETURN 0; END IF;

  SELECT functions_url INTO v_base FROM public.platform_settings WHERE id;
  SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET' LIMIT 1;
  IF v_base IS NULL OR v_base = '' OR v_secret IS NULL OR v_secret = '' THEN RETURN 0; END IF;

  PERFORM cron.schedule('smart-alerts-daily',      '0 11 * * *',  $c$SELECT public.chamar_funcao_agendada('smart-alerts')$c$);
  PERFORM cron.schedule('agent-anomalies-daily',   '30 11 * * *', $c$SELECT public.chamar_funcao_agendada('agent-anomalies')$c$);
  PERFORM cron.schedule('agent-collections-daily', '0 12 * * *',  $c$SELECT public.chamar_funcao_agendada('agent-collections')$c$);
  PERFORM cron.schedule('contracts-billing-daily', '0 6 * * *',   $c$SELECT public.chamar_funcao_agendada('contracts-billing')$c$);
  PERFORM cron.schedule('tax-rates-sync-weekly',   '0 4 * * 1',   $c$SELECT public.chamar_funcao_agendada('tax-rates-sync')$c$);

  SELECT count(*) INTO v_n FROM cron.job;
  RETURN v_n;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.garantir_agendamentos() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.garantir_agendamentos() TO authenticated, service_role;

/** O login passa a garantir também os agendamentos, além dos planos. */
CREATE OR REPLACE FUNCTION public.consagrar_dono_se_primeiro()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_email text;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
  IF lower(coalesce(v_email, '')) IN ('demo@financeai.app', 'dono-demo@financeai.app') THEN RETURN false; END IF;

  PERFORM public.garantir_planos();
  PERFORM public.garantir_agendamentos();

  INSERT INTO public.platform_owner (id, user_id) VALUES (true, auth.uid())
  ON CONFLICT (id) DO NOTHING;
  RETURN EXISTS (SELECT 1 FROM public.platform_owner WHERE user_id = auth.uid());
END;
$$;

REVOKE EXECUTE ON FUNCTION public.consagrar_dono_se_primeiro() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consagrar_dono_se_primeiro() TO authenticated;
