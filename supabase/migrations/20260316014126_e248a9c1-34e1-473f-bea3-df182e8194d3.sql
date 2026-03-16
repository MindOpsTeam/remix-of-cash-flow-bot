-- Migration 3: NFS-e Config
CREATE TABLE IF NOT EXISTS public.nfse_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  cert_pfx_base64 TEXT NOT NULL DEFAULT '',
  cert_password TEXT NOT NULL DEFAULT '',
  cert_cnpj TEXT,
  cert_razao_social TEXT,
  cert_expires_at TIMESTAMPTZ,
  ambiente TEXT NOT NULL DEFAULT 'homologacao'
    CHECK (ambiente IN ('producao', 'homologacao')),
  serie_dps TEXT NOT NULL DEFAULT '1',
  proximo_numero_dps BIGINT NOT NULL DEFAULT 1,
  codigo_municipio TEXT,
  inscricao_municipal TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  last_test_at TIMESTAMPTZ,
  last_test_status TEXT,
  last_emission_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id)
);

ALTER TABLE public.nfse_config ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='nfse_config' AND policyname='cm_nfse_config_select') THEN
    CREATE POLICY "cm_nfse_config_select" ON public.nfse_config FOR SELECT USING (is_company_member(company_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='nfse_config' AND policyname='cm_nfse_config_insert') THEN
    CREATE POLICY "cm_nfse_config_insert" ON public.nfse_config FOR INSERT WITH CHECK (is_company_member(company_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='nfse_config' AND policyname='cm_nfse_config_update') THEN
    CREATE POLICY "cm_nfse_config_update" ON public.nfse_config FOR UPDATE USING (is_company_member(company_id)) WITH CHECK (is_company_member(company_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='nfse_config' AND policyname='cm_nfse_config_delete') THEN
    CREATE POLICY "cm_nfse_config_delete" ON public.nfse_config FOR DELETE USING (is_company_member(company_id));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_nfse_config_company ON public.nfse_config(company_id);

DROP TRIGGER IF EXISTS update_nfse_config_updated_at ON public.nfse_config;
CREATE TRIGGER update_nfse_config_updated_at
  BEFORE UPDATE ON public.nfse_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();