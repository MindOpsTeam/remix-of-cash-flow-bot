-- PlugNotas configuration table (one per company)
-- Provedor alternativo ao NFS-e Nacional. Suporta NFe, NFSe, NFCe, CTe e MDFe.
-- Diferente do NFS-e Nacional, o certificado fica hospedado na PlugNotas,
-- portanto aqui guardamos apenas credenciais e referências.

CREATE TABLE IF NOT EXISTS plugnotas_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE,

  -- Credenciais PlugNotas
  api_key TEXT NOT NULL DEFAULT '',
  environment TEXT NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox', 'producao')),

  -- Referências de cadastro no PlugNotas
  plugnotas_empresa_cnpj TEXT,
  plugnotas_empresa_id TEXT,

  -- Tipos de documento habilitados
  enabled_nfe BOOLEAN NOT NULL DEFAULT false,
  enabled_nfse BOOLEAN NOT NULL DEFAULT true,
  enabled_nfce BOOLEAN NOT NULL DEFAULT false,
  enabled_cte BOOLEAN NOT NULL DEFAULT false,
  enabled_mdfe BOOLEAN NOT NULL DEFAULT false,

  -- Configuração fiscal padrão (numeração / série)
  serie_padrao TEXT DEFAULT '1',

  -- Status
  active BOOLEAN NOT NULL DEFAULT true,
  last_test_at TIMESTAMPTZ,
  last_test_status TEXT,
  last_emission_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plugnotas_config_company ON plugnotas_config(company_id);

ALTER TABLE plugnotas_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their company plugnotas_config"
  ON plugnotas_config FOR SELECT
  USING (company_id IN (SELECT id FROM companies WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert their company plugnotas_config"
  ON plugnotas_config FOR INSERT
  WITH CHECK (company_id IN (SELECT id FROM companies WHERE user_id = auth.uid()));

CREATE POLICY "Users can update their company plugnotas_config"
  ON plugnotas_config FOR UPDATE
  USING (company_id IN (SELECT id FROM companies WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete their company plugnotas_config"
  ON plugnotas_config FOR DELETE
  USING (company_id IN (SELECT id FROM companies WHERE user_id = auth.uid()));


-- Log de emissões/consultas PlugNotas (auditoria + cache de status)
CREATE TABLE IF NOT EXISTS plugnotas_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  doc_type TEXT NOT NULL CHECK (doc_type IN ('nfe', 'nfse', 'nfce', 'cte', 'mdfe')),
  plugnotas_id TEXT,                 -- id retornado pelo PlugNotas (idIntegracao ou _id)
  plugnotas_protocolo TEXT,
  chave_acesso TEXT,                 -- chave NFe/NFCe/CTe ou número NFSe
  numero TEXT,
  serie TEXT,

  status TEXT NOT NULL DEFAULT 'enviado',  -- enviado | processando | autorizado | rejeitado | cancelado | erro
  status_message TEXT,

  invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,

  payload_request JSONB,
  payload_response JSONB,
  xml_url TEXT,
  pdf_url TEXT,

  emitted_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  last_check_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plugnotas_documents_company ON plugnotas_documents(company_id);
CREATE INDEX IF NOT EXISTS idx_plugnotas_documents_chave   ON plugnotas_documents(chave_acesso);
CREATE INDEX IF NOT EXISTS idx_plugnotas_documents_type    ON plugnotas_documents(doc_type);

ALTER TABLE plugnotas_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their company plugnotas_documents"
  ON plugnotas_documents FOR SELECT
  USING (company_id IN (SELECT id FROM companies WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert their company plugnotas_documents"
  ON plugnotas_documents FOR INSERT
  WITH CHECK (company_id IN (SELECT id FROM companies WHERE user_id = auth.uid()));

CREATE POLICY "Users can update their company plugnotas_documents"
  ON plugnotas_documents FOR UPDATE
  USING (company_id IN (SELECT id FROM companies WHERE user_id = auth.uid()));
