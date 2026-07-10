-- API pública v1: chaves por empresa (hash SHA-256, nunca a chave em claro).
-- Aditiva e idempotente.

CREATE TABLE IF NOT EXISTS public.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  -- SHA-256 hex da chave completa; prefixo em claro para localizar/exibir
  key_hash text NOT NULL UNIQUE,
  prefix text NOT NULL,
  scopes text[] NOT NULL DEFAULT ARRAY['read'],
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS api_keys_company ON public.api_keys (company_id);

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Members manage api keys"
    ON public.api_keys FOR ALL
    USING (public.is_company_member(company_id))
    WITH CHECK (public.is_company_member(company_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
