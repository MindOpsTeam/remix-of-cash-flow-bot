-- Integração Conta Azul: config por empresa (credencial no Vault) e o
-- external_id que faltava para dedupe de importação em receivables,
-- bills_payable e contacts/products.
--
-- Padrão de segredo da casa (Focus/Pluggy): a tabela guarda só telemetria e
-- preview; o trio client_id/secret/refresh_token vive no Vault, gravado por
-- RPC SECURITY DEFINER que checa membresia e lido só por service_role.

CREATE TABLE IF NOT EXISTS public.contaazul_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,
  client_id_preview text,
  ativo boolean NOT NULL DEFAULT true,
  last_import_at timestamptz,
  last_import_result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.contaazul_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members manage contaazul config" ON public.contaazul_config;
CREATE POLICY "Members manage contaazul config"
  ON public.contaazul_config FOR ALL
  USING (public.is_company_member(company_id))
  WITH CHECK (public.is_company_member(company_id));

-- Vault: um segredo por empresa, nome determinístico.
CREATE OR REPLACE FUNCTION public.set_contaazul_credentials(
  p_company_id uuid,
  p_client_id text,
  p_client_secret text,
  p_refresh_token text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nome text := 'contaazul:' || p_company_id::text;
  v_valor text;
  v_id uuid;
BEGIN
  IF NOT public.is_company_member(p_company_id) THEN
    RAISE EXCEPTION 'Sem acesso a esta empresa.' USING ERRCODE = '42501';
  END IF;
  IF coalesce(trim(p_client_id), '') = '' OR coalesce(trim(p_client_secret), '') = '' OR coalesce(trim(p_refresh_token), '') = '' THEN
    RAISE EXCEPTION 'client_id, client_secret e refresh_token são obrigatórios.' USING ERRCODE = '23514';
  END IF;

  v_valor := json_build_object(
    'client_id', trim(p_client_id),
    'client_secret', trim(p_client_secret),
    'refresh_token', trim(p_refresh_token)
  )::text;

  SELECT id INTO v_id FROM vault.secrets WHERE name = v_nome;
  IF v_id IS NULL THEN
    PERFORM vault.create_secret(v_valor, v_nome);
  ELSE
    PERFORM vault.update_secret(v_id, v_valor);
  END IF;

  INSERT INTO public.contaazul_config (company_id, client_id_preview)
  VALUES (p_company_id, '••••' || right(trim(p_client_id), 4))
  ON CONFLICT (company_id) DO UPDATE
    SET client_id_preview = '••••' || right(trim(p_client_id), 4),
        ativo = true,
        updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.get_contaazul_credentials(p_company_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT decrypted_secret FROM vault.decrypted_secrets
   WHERE name = 'contaazul:' || p_company_id::text
   LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.set_contaazul_credentials(uuid, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_contaazul_credentials(uuid, text, text, text) TO authenticated;
REVOKE ALL ON FUNCTION public.get_contaazul_credentials(uuid) FROM PUBLIC, anon, authenticated;

-- Rotação de refresh_token acontece DENTRO da edge (service_role): permitir
-- update só do refresh sem reexigir o par completo.
CREATE OR REPLACE FUNCTION public.rotate_contaazul_refresh_token(p_company_id uuid, p_refresh_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nome text := 'contaazul:' || p_company_id::text;
  v_atual json;
  v_id uuid;
BEGIN
  SELECT id, decrypted_secret::json INTO v_id, v_atual
    FROM vault.decrypted_secrets WHERE name = v_nome LIMIT 1;
  IF v_id IS NULL THEN RETURN; END IF;
  PERFORM vault.update_secret(v_id, json_build_object(
    'client_id', v_atual->>'client_id',
    'client_secret', v_atual->>'client_secret',
    'refresh_token', p_refresh_token
  )::text);
END;
$$;
REVOKE ALL ON FUNCTION public.rotate_contaazul_refresh_token(uuid, text) FROM PUBLIC, anon, authenticated;

-- Dedupe de importação: external_id nas tabelas que recebem dados de fora.
ALTER TABLE public.receivables ADD COLUMN IF NOT EXISTS external_id text;
ALTER TABLE public.bills_payable ADD COLUMN IF NOT EXISTS external_id text;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS external_id text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS external_id text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_receivables_external_unique
  ON public.receivables (company_id, external_id) WHERE external_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_bills_payable_external_unique
  ON public.bills_payable (company_id, external_id) WHERE external_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_external_unique
  ON public.contacts (company_id, external_id) WHERE external_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_external_unique
  ON public.products (company_id, external_id) WHERE external_id IS NOT NULL;
