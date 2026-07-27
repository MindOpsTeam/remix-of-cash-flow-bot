-- Open Finance (Pluggy) configurável pela UI, com credencial no Vault.
--
-- Antes: PLUGGY_CLIENT_ID/SECRET viviam como env secret do Supabase, que só se
-- troca no painel da conta e por isso vira bloqueio quando a conta é do cliente.
-- Agora cada empresa guarda o próprio par no Vault, escrito pela tela de
-- configurações e lido só pelo service_role das edge functions. O env continua
-- valendo como fallback, para nenhuma conexão existente cair.

CREATE TABLE IF NOT EXISTS public.openfinance_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'pluggy' CHECK (provider IN ('pluggy', 'belvo')),
  client_id_preview text,
  sandbox boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true,
  last_test_at timestamptz,
  last_test_status text,
  last_sync_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, provider)
);

ALTER TABLE public.openfinance_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view openfinance config" ON public.openfinance_config;
CREATE POLICY "Members can view openfinance config" ON public.openfinance_config
  FOR SELECT TO authenticated USING (public.is_company_member(company_id));

DROP POLICY IF EXISTS "Members can insert openfinance config" ON public.openfinance_config;
CREATE POLICY "Members can insert openfinance config" ON public.openfinance_config
  FOR INSERT TO authenticated WITH CHECK (public.is_company_member(company_id));

DROP POLICY IF EXISTS "Members can update openfinance config" ON public.openfinance_config;
CREATE POLICY "Members can update openfinance config" ON public.openfinance_config
  FOR UPDATE TO authenticated USING (public.is_company_member(company_id))
  WITH CHECK (public.is_company_member(company_id));

DROP POLICY IF EXISTS "Members can delete openfinance config" ON public.openfinance_config;
CREATE POLICY "Members can delete openfinance config" ON public.openfinance_config
  FOR DELETE TO authenticated USING (public.is_company_member(company_id));

DROP TRIGGER IF EXISTS update_openfinance_config_updated_at ON public.openfinance_config;
CREATE TRIGGER update_openfinance_config_updated_at
  BEFORE UPDATE ON public.openfinance_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Escrita: a tela chama. Passar vazio apaga o par.
CREATE OR REPLACE FUNCTION public.set_pluggy_credentials(
  p_company_id uuid,
  p_client_id text,
  p_client_secret text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_nome_id text; v_nome_secret text; v_id uuid; v_preview text;
BEGIN
  IF NOT public.is_company_member(p_company_id) THEN
    RAISE EXCEPTION 'Sem permissão nesta empresa';
  END IF;

  v_nome_id := 'pluggy_client_id_' || p_company_id::text;
  v_nome_secret := 'pluggy_client_secret_' || p_company_id::text;

  IF p_client_id IS NULL OR length(trim(p_client_id)) = 0 THEN
    DELETE FROM vault.secrets WHERE name IN (v_nome_id, v_nome_secret);
    v_preview := NULL;
  ELSE
    SELECT id INTO v_id FROM vault.secrets WHERE name = v_nome_id;
    IF v_id IS NULL THEN PERFORM vault.create_secret(trim(p_client_id), v_nome_id, 'Pluggy Client ID');
    ELSE PERFORM vault.update_secret(v_id, trim(p_client_id)); END IF;

    IF p_client_secret IS NOT NULL AND length(trim(p_client_secret)) > 0 THEN
      v_id := NULL;
      SELECT id INTO v_id FROM vault.secrets WHERE name = v_nome_secret;
      IF v_id IS NULL THEN PERFORM vault.create_secret(trim(p_client_secret), v_nome_secret, 'Pluggy Client Secret');
      ELSE PERFORM vault.update_secret(v_id, trim(p_client_secret)); END IF;
    END IF;

    -- Client ID não é segredo forte (o secret é), então mostramos o prefixo,
    -- que é o que a pessoa confere contra o dashboard da Pluggy.
    v_preview := left(trim(p_client_id), 8) || '…';
  END IF;

  INSERT INTO public.openfinance_config (company_id, provider) VALUES (p_company_id, 'pluggy')
  ON CONFLICT (company_id, provider) DO NOTHING;
  UPDATE public.openfinance_config SET client_id_preview = v_preview
   WHERE company_id = p_company_id AND provider = 'pluggy';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_pluggy_credentials(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_pluggy_credentials(uuid, text, text) TO authenticated;

-- Leitura: só as edge functions.
CREATE OR REPLACE FUNCTION public.get_pluggy_credentials(p_company_id uuid)
RETURNS json
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT json_build_object(
    'client_id', (SELECT decrypted_secret FROM vault.decrypted_secrets
                   WHERE name = 'pluggy_client_id_' || p_company_id::text LIMIT 1),
    'client_secret', (SELECT decrypted_secret FROM vault.decrypted_secrets
                       WHERE name = 'pluggy_client_secret_' || p_company_id::text LIMIT 1)
  );
$$;

REVOKE EXECUTE ON FUNCTION public.get_pluggy_credentials(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_pluggy_credentials(uuid) TO service_role;
