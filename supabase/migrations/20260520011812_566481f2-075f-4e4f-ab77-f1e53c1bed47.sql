
CREATE TABLE IF NOT EXISTS public.plugnotas_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,
  api_key TEXT NOT NULL DEFAULT '',
  environment TEXT NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox', 'producao')),
  plugnotas_empresa_cnpj TEXT,
  plugnotas_empresa_id TEXT,
  enabled_nfe BOOLEAN NOT NULL DEFAULT false,
  enabled_nfse BOOLEAN NOT NULL DEFAULT true,
  enabled_nfce BOOLEAN NOT NULL DEFAULT false,
  enabled_cte BOOLEAN NOT NULL DEFAULT false,
  enabled_mdfe BOOLEAN NOT NULL DEFAULT false,
  serie_padrao TEXT DEFAULT '1',
  active BOOLEAN NOT NULL DEFAULT true,
  last_test_at TIMESTAMPTZ,
  last_test_status TEXT,
  last_emission_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plugnotas_config_company ON public.plugnotas_config(company_id);

ALTER TABLE public.plugnotas_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members manage plugnotas_config"
  ON public.plugnotas_config FOR ALL
  TO authenticated
  USING (public.is_company_member(company_id))
  WITH CHECK (public.is_company_member(company_id));

CREATE TRIGGER trg_plugnotas_config_updated
  BEFORE UPDATE ON public.plugnotas_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


CREATE TABLE IF NOT EXISTS public.plugnotas_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL CHECK (doc_type IN ('nfe', 'nfse', 'nfce', 'cte', 'mdfe')),
  plugnotas_id TEXT,
  plugnotas_protocolo TEXT,
  chave_acesso TEXT,
  numero TEXT,
  serie TEXT,
  status TEXT NOT NULL DEFAULT 'enviado',
  status_message TEXT,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  payload_request JSONB,
  payload_response JSONB,
  xml_url TEXT,
  pdf_url TEXT,
  emitted_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  last_check_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plugnotas_documents_company ON public.plugnotas_documents(company_id);
CREATE INDEX IF NOT EXISTS idx_plugnotas_documents_chave   ON public.plugnotas_documents(chave_acesso);
CREATE INDEX IF NOT EXISTS idx_plugnotas_documents_type    ON public.plugnotas_documents(doc_type);

ALTER TABLE public.plugnotas_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members manage plugnotas_documents"
  ON public.plugnotas_documents FOR ALL
  TO authenticated
  USING (public.is_company_member(company_id))
  WITH CHECK (public.is_company_member(company_id));

CREATE TRIGGER trg_plugnotas_documents_updated
  BEFORE UPDATE ON public.plugnotas_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
