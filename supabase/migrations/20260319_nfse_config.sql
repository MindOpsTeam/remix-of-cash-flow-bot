-- NFS-e configuration table (one per company)
CREATE TABLE IF NOT EXISTS nfse_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE,

  -- Certificate
  cert_pfx_base64 TEXT NOT NULL DEFAULT '',
  cert_password TEXT NOT NULL DEFAULT '',
  cert_cnpj TEXT,
  cert_razao_social TEXT,
  cert_expires_at TIMESTAMPTZ,

  -- Fiscal settings
  ambiente TEXT NOT NULL DEFAULT 'homologacao' CHECK (ambiente IN ('producao', 'homologacao')),
  serie_dps TEXT NOT NULL DEFAULT '1',
  proximo_numero_dps BIGINT NOT NULL DEFAULT 1,
  codigo_municipio TEXT NOT NULL DEFAULT '',
  inscricao_municipal TEXT DEFAULT '',

  -- Status
  active BOOLEAN NOT NULL DEFAULT true,
  last_test_at TIMESTAMPTZ,
  last_test_status TEXT,
  last_emission_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE nfse_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their company nfse_config"
  ON nfse_config FOR SELECT
  USING (company_id IN (
    SELECT id FROM companies WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can insert their company nfse_config"
  ON nfse_config FOR INSERT
  WITH CHECK (company_id IN (
    SELECT id FROM companies WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can update their company nfse_config"
  ON nfse_config FOR UPDATE
  USING (company_id IN (
    SELECT id FROM companies WHERE user_id = auth.uid()
  ));

-- Add xml_content column to invoices if not exists
DO $$ BEGIN
  ALTER TABLE invoices ADD COLUMN IF NOT EXISTS xml_content TEXT;
EXCEPTION WHEN undefined_table THEN
  NULL;
END $$;
