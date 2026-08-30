-- =========================================================
-- Hardening — o que estava aberto em 29/08/2026
--
-- 1. `v_group_account_totals` devolvia a receita e a despesa de TODAS as
--    empresas para quem não tinha login. Provado antes deste arquivo:
--
--      curl "$URL/rest/v1/v_group_account_totals?select=*" -H "apikey: <anon>"
--      → 111 linhas, company_id + mês + grupo contábil + total
--
--    `transactions` no mesmo curl devolve `[]` — a RLS da tabela funciona. A
--    view é que não aplicava RLS nenhuma: sem `security_invoker`, uma view roda
--    com os poderes de QUEM A CRIOU (postgres), e postgres ignora RLS. A tabela
--    estava trancada e a janela ao lado, aberta.
--
-- 2. A correção de uma view só não resolve: a próxima view que o editor criar
--    nasce com o mesmo defeito. Por isso a trava vira função repetível.
--
-- 3. Escrita de negócio fora da trava de whitelabel: `title_payments` e as sete
--    tabelas `stay_*` nasceram depois de 20260801100000_whitelabel_lock.sql e
--    ficaram sem as policies RESTRICTIVE. Num template bloqueado dava para
--    lançar baixa e reserva.
--
-- 4. Teto de requisição por janela: até aqui nenhum endpoint público tinha
--    limite. Quem descobrisse a URL da API pública podia varrer chave até
--    acertar, de graça e sem deixar contador.
-- =========================================================

-- ── 1. Views: RLS de quem chama, não de quem criou ────────────────────────
--
-- `security_invoker = on` faz a view rodar com o papel do chamador, então a RLS
-- das tabelas de baixo passa a valer. É o padrão do Postgres 15+ e o resto das
-- views deste banco já estava assim; só esta ficou para trás.
CREATE OR REPLACE FUNCTION public.travar_views_na_rls()
RETURNS TABLE (view_corrigida text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v record;
BEGIN
  FOR v IN
    SELECT c.oid, c.relname
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relkind = 'v'
       AND COALESCE(
             (SELECT option_value
                FROM pg_options_to_table(c.reloptions)
               WHERE option_name = 'security_invoker'),
             'off'
           ) NOT IN ('on', 'true')
  LOOP
    EXECUTE format('ALTER VIEW public.%I SET (security_invoker = on)', v.relname);
    view_corrigida := v.relname;
    RETURN NEXT;
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.travar_views_na_rls() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.travar_views_na_rls() TO service_role;

SELECT public.travar_views_na_rls();

-- Fecha a leitura sem login em todas as views. Nenhuma tela pré-login consulta
-- `v_*`: o que a página de entrada precisa saber vem de `platform_settings`,
-- `platform_lock` e `demo_dataset`, que continuam abertas de propósito.
DO $$
DECLARE v record;
BEGIN
  FOR v IN
    SELECT c.relname
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind IN ('v', 'm')
  LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', v.relname);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', v.relname);
  END LOOP;
END $$;

-- ── 2. RPC de escrita não é chamada sem sessão ────────────────────────────
--
-- As cinco abaixo já barram por dentro (`is_company_member` /
-- `pode_escrever_na_empresa`, que dependem de auth.uid()), então isto é a
-- segunda tranca, não a primeira. Fica de fora, de propósito,
-- `limpar_demonstracao_se_remixado()`: ela É chamada sem sessão, num remix
-- recém-criado, antes de existir a primeira pessoa (ver src/lib/rpc-plataforma.ts).
--
-- ATENÇÃO — `REVOKE ... FROM anon` sozinho NÃO tira nada.
-- O default do Postgres para função é EXECUTE para PUBLIC, e `anon` herda por
-- ali. A ACL destas cinco era `=X/postgres | ... | authenticated=X/postgres`:
-- aquele grantee vazio no começo é PUBLIC. Revogar de `anon` removia um grant
-- explícito que às vezes nem existia, e `has_function_privilege('anon', …)`
-- continuava true — a migration parecia ter rodado e não tinha mudado nada.
-- Por isso: revoga de PUBLIC e devolve o acesso NOMEANDO quem deve ter.
REVOKE EXECUTE ON FUNCTION public.baixar_titulo(text, uuid, numeric, date, numeric, numeric, numeric, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.estornar_baixa(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.desfazer_importacao(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.autores_da_empresa(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.auditar_integridade_contabil(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.baixar_titulo(text, uuid, numeric, date, numeric, numeric, numeric, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.estornar_baixa(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.desfazer_importacao(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.autores_da_empresa(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.auditar_integridade_contabil(uuid) TO authenticated, service_role;

-- Prova de que rodou: sem esta trava, a migration seguinte poderia acreditar
-- num estado que não existe.
DO $$
DECLARE v_abertas int;
BEGIN
  SELECT count(*) INTO v_abertas
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname IN ('baixar_titulo','estornar_baixa','desfazer_importacao',
                       'autores_da_empresa','auditar_integridade_contabil')
     AND has_function_privilege('anon', p.oid, 'EXECUTE');
  IF v_abertas > 0 THEN
    RAISE EXCEPTION 'REVOKE nao pegou: % RPC de escrita ainda executam como anon', v_abertas;
  END IF;
END $$;

-- ── 3. Trava de whitelabel nas tabelas que nasceram depois ────────────────
--
-- Repetível de propósito: 20260801100000_whitelabel_lock.sql rodou uma vez e
-- toda tabela criada depois ficou fora. Agora é uma função que o bootstrap
-- pode chamar de novo.
CREATE OR REPLACE FUNCTION public.aplicar_trava_de_template()
RETURNS TABLE (tabela_coberta text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t record;
  -- platform_lock é o próprio interruptor; platform_settings é a configuração
  -- do dono, que precisa funcionar justamente com a trava ligada; demo_dataset
  -- é higiene do remix, apagada antes de existir sessão.
  v_pular text[] := ARRAY['platform_lock', 'platform_settings', 'demo_dataset', 'rate_limit_counters'];
BEGIN
  FOR t IN
    SELECT c.relname
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relkind = 'r'
       AND c.relrowsecurity
       AND NOT (c.relname = ANY (v_pular))
       AND NOT EXISTS (
             SELECT 1 FROM pg_policy p
              WHERE p.polrelid = c.oid
                AND p.polname = 'Template nao aceita insert'
           )
  LOOP
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR INSERT WITH CHECK (NOT public.plataforma_bloqueada())',
      'Template nao aceita insert', t.relname);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR UPDATE USING (NOT public.plataforma_bloqueada())',
      'Template nao aceita update', t.relname);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR DELETE USING (NOT public.plataforma_bloqueada())',
      'Template nao aceita delete', t.relname);
    tabela_coberta := t.relname;
    RETURN NEXT;
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.aplicar_trava_de_template() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.aplicar_trava_de_template() TO service_role;

SELECT public.aplicar_trava_de_template();

-- ── 4. Teto de requisição por janela ──────────────────────────────────────
--
-- Contador de janela fixa, no banco, porque edge function não guarda estado
-- entre invocações: cada chamada pode cair num isolate novo, e um contador em
-- memória zeraria sozinho — dando limite nenhum e a impressão de ter um.
CREATE TABLE IF NOT EXISTS public.rate_limit_counters (
  bucket     text        NOT NULL,
  janela     timestamptz NOT NULL,
  contador   integer     NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket, janela)
);

CREATE INDEX IF NOT EXISTS rate_limit_counters_janela_idx
  ON public.rate_limit_counters (janela);

ALTER TABLE public.rate_limit_counters ENABLE ROW LEVEL SECURITY;

-- Sem policy permissiva: só service_role (que ignora RLS) entra aqui. A tabela
-- guarda o rastro de quem bateu no teto; não é dado de empresa nenhuma.
REVOKE ALL ON public.rate_limit_counters FROM anon, authenticated;
GRANT ALL ON public.rate_limit_counters TO service_role;

CREATE POLICY "Ninguem le o contador pela API"
  ON public.rate_limit_counters AS RESTRICTIVE FOR SELECT USING (false);

/**
 * Consome uma unidade do teto e diz se a chamada passa.
 *
 * Janela fixa (não deslizante) porque o custo importa: uma janela deslizante
 * exigiria guardar cada batida, e o ponto aqui é justamente não deixar um
 * atacante escrever linha à vontade no meu banco.
 *
 * O INSERT ... ON CONFLICT DO UPDATE é atômico: duas invocações simultâneas da
 * mesma função não conseguem ler o mesmo contador e gravar o mesmo valor.
 */
CREATE OR REPLACE FUNCTION public.consumir_limite(
  p_bucket           text,
  p_teto             integer,
  p_janela_segundos  integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_janela   timestamptz;
  v_contador integer;
BEGIN
  IF p_bucket IS NULL OR length(p_bucket) = 0 THEN
    RAISE EXCEPTION 'bucket vazio' USING ERRCODE = '22023';
  END IF;
  IF coalesce(p_teto, 0) <= 0 OR coalesce(p_janela_segundos, 0) <= 0 THEN
    RAISE EXCEPTION 'teto e janela precisam ser positivos' USING ERRCODE = '22023';
  END IF;

  v_janela := to_timestamp(
    floor(extract(epoch FROM now()) / p_janela_segundos) * p_janela_segundos
  );

  INSERT INTO public.rate_limit_counters AS r (bucket, janela, contador)
       VALUES (p_bucket, v_janela, 1)
  ON CONFLICT (bucket, janela)
    DO UPDATE SET contador = r.contador + 1
    RETURNING r.contador INTO v_contador;

  -- Higiene determinística: as janelas velhas DESTE bucket somem a cada
  -- chamada. Sem isso um bucket movimentado deixaria uma linha por janela para
  -- sempre. As janelas de buckets abandonados caem no cron diário abaixo.
  DELETE FROM public.rate_limit_counters
   WHERE bucket = p_bucket AND janela < v_janela;

  RETURN jsonb_build_object(
    'permitido',   v_contador <= p_teto,
    'contador',    v_contador,
    'teto',        p_teto,
    'reinicia_em', v_janela + make_interval(secs => p_janela_segundos)
  );
END $$;

REVOKE ALL ON FUNCTION public.consumir_limite(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consumir_limite(text, integer, integer) TO service_role;

-- Varredura das janelas de buckets que pararam de ser usados. SQL puro no cron:
-- não precisa de segredo nem de edge function, então não há o que vazar nem o
-- que esquecer de configurar num remix.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('rate-limit-limpeza')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'rate-limit-limpeza');
    PERFORM cron.schedule(
      'rate-limit-limpeza',
      '17 4 * * *',
      $cron$DELETE FROM public.rate_limit_counters WHERE janela < now() - interval '2 days'$cron$
    );
  END IF;
END $$;
