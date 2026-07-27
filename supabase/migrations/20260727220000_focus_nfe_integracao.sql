-- Integração Focus NFe: mais um emissor de nota fiscal, ao lado do PlugNotas e
-- da NFS-e Nacional. A Focus emite NFe, NFCe, NFSe, NFSe Nacional, CTe, MDFe,
-- NFCom, NFGás e DCe pela mesma API v2.
--
-- Chave: o token NÃO fica em coluna nem em env secret. Vai para o Vault do
-- Supabase, escrito por RPC que a própria tela de configurações chama, e lido
-- só pelo service_role das edge functions. A tabela guarda apenas um preview
-- mascarado (4 últimos dígitos) para a UI mostrar que existe token gravado.
--
-- Homologação e produção têm TOKENS DIFERENTES na Focus, por isso dois slots.

CREATE TABLE IF NOT EXISTS public.focus_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  environment text NOT NULL DEFAULT 'homologacao'
    CHECK (environment IN ('homologacao', 'producao')),
  token_homologacao_preview text,
  token_producao_preview text,
  enabled_nfse boolean NOT NULL DEFAULT true,
  enabled_nfe boolean NOT NULL DEFAULT false,
  enabled_nfce boolean NOT NULL DEFAULT false,
  enabled_cte boolean NOT NULL DEFAULT false,
  enabled_mdfe boolean NOT NULL DEFAULT false,
  serie_padrao text DEFAULT '1',
  active boolean NOT NULL DEFAULT true,
  last_test_at timestamptz,
  last_test_status text,
  last_emission_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id)
);

ALTER TABLE public.focus_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view focus config" ON public.focus_config;
CREATE POLICY "Members can view focus config" ON public.focus_config
  FOR SELECT TO authenticated USING (public.is_company_member(company_id));

DROP POLICY IF EXISTS "Members can insert focus config" ON public.focus_config;
CREATE POLICY "Members can insert focus config" ON public.focus_config
  FOR INSERT TO authenticated WITH CHECK (public.is_company_member(company_id));

DROP POLICY IF EXISTS "Members can update focus config" ON public.focus_config;
CREATE POLICY "Members can update focus config" ON public.focus_config
  FOR UPDATE TO authenticated USING (public.is_company_member(company_id))
  WITH CHECK (public.is_company_member(company_id));

DROP POLICY IF EXISTS "Members can delete focus config" ON public.focus_config;
CREATE POLICY "Members can delete focus config" ON public.focus_config
  FOR DELETE TO authenticated USING (public.is_company_member(company_id));

DROP TRIGGER IF EXISTS update_focus_config_updated_at ON public.focus_config;
CREATE TRIGGER update_focus_config_updated_at
  BEFORE UPDATE ON public.focus_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── Escrita do token: RPC chamada pela tela de configurações ──────────────────
-- Passar p_token vazio/nulo APAGA o token daquele ambiente.
CREATE OR REPLACE FUNCTION public.set_focus_token(
  p_company_id uuid,
  p_environment text,
  p_token text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nome text;
  v_id uuid;
  v_preview text;
BEGIN
  IF NOT public.is_company_member(p_company_id) THEN
    RAISE EXCEPTION 'Sem permissão nesta empresa';
  END IF;
  IF p_environment NOT IN ('homologacao', 'producao') THEN
    RAISE EXCEPTION 'Ambiente inválido: %', p_environment;
  END IF;

  v_nome := 'focus_nfe_' || p_environment || '_' || p_company_id::text;
  SELECT id INTO v_id FROM vault.secrets WHERE name = v_nome;

  IF p_token IS NULL OR length(trim(p_token)) = 0 THEN
    IF v_id IS NOT NULL THEN DELETE FROM vault.secrets WHERE id = v_id; END IF;
    v_preview := NULL;
  ELSE
    IF v_id IS NULL THEN
      PERFORM vault.create_secret(trim(p_token), v_nome, 'Token Focus NFe (' || p_environment || ')');
    ELSE
      PERFORM vault.update_secret(v_id, trim(p_token));
    END IF;
    v_preview := '••••' || right(trim(p_token), 4);
  END IF;

  INSERT INTO public.focus_config (company_id) VALUES (p_company_id)
  ON CONFLICT (company_id) DO NOTHING;

  IF p_environment = 'homologacao' THEN
    UPDATE public.focus_config SET token_homologacao_preview = v_preview WHERE company_id = p_company_id;
  ELSE
    UPDATE public.focus_config SET token_producao_preview = v_preview WHERE company_id = p_company_id;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_focus_token(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_focus_token(uuid, text, text) TO authenticated;

-- ── Leitura do token: SÓ o service_role das edge functions ────────────────────
CREATE OR REPLACE FUNCTION public.get_focus_token(
  p_company_id uuid,
  p_environment text
) RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT decrypted_secret FROM vault.decrypted_secrets
  WHERE name = 'focus_nfe_' || p_environment || '_' || p_company_id::text
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.get_focus_token(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_focus_token(uuid, text) TO service_role;
