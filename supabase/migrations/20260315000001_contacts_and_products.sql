-- ============================================================
-- Contacts (Clientes / Fornecedores)
-- ============================================================
CREATE TABLE public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  trade_name TEXT,                          -- nome fantasia
  type TEXT NOT NULL DEFAULT 'customer'     -- customer, supplier, both
    CHECK (type IN ('customer', 'supplier', 'both')),
  person_type TEXT NOT NULL DEFAULT 'pj'    -- pj, pf
    CHECK (person_type IN ('pj', 'pf')),
  document TEXT,                            -- CPF ou CNPJ
  state_registration TEXT,                  -- inscrição estadual
  email TEXT,
  phone TEXT,
  whatsapp TEXT,
  website TEXT,
  -- Address
  zip_code TEXT,
  street TEXT,
  number TEXT,
  complement TEXT,
  neighborhood TEXT,
  city TEXT,
  state TEXT,
  -- Financial
  default_payment_terms INTEGER,            -- dias para pagamento padrão
  credit_limit NUMERIC(15,2),
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_members_contacts_select" ON public.contacts
  FOR SELECT USING (is_company_member(company_id));
CREATE POLICY "company_members_contacts_insert" ON public.contacts
  FOR INSERT WITH CHECK (is_company_member(company_id));
CREATE POLICY "company_members_contacts_update" ON public.contacts
  FOR UPDATE USING (is_company_member(company_id)) WITH CHECK (is_company_member(company_id));
CREATE POLICY "company_members_contacts_delete" ON public.contacts
  FOR DELETE USING (is_company_member(company_id));

CREATE INDEX idx_contacts_company ON public.contacts(company_id);
CREATE INDEX idx_contacts_document ON public.contacts(company_id, document) WHERE document IS NOT NULL;

CREATE TRIGGER update_contacts_updated_at
  BEFORE UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- Products / Services (Produtos / Serviços)
-- ============================================================
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'product'      -- product, service
    CHECK (type IN ('product', 'service')),
  sku TEXT,
  barcode TEXT,
  unit TEXT NOT NULL DEFAULT 'un',          -- un, kg, lt, hr, m, m2, cx, pct
  sell_price NUMERIC(15,2) NOT NULL DEFAULT 0,
  cost_price NUMERIC(15,2),
  -- Tax
  ncm TEXT,                                 -- NCM code (products)
  cfop TEXT,                                -- CFOP
  tax_origin TEXT,                          -- origem tributária
  -- Stock
  track_stock BOOLEAN NOT NULL DEFAULT false,
  min_stock NUMERIC(15,3) DEFAULT 0,
  current_stock NUMERIC(15,3) DEFAULT 0,
  -- Accounting link
  account_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
  -- Meta
  category TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_members_products_select" ON public.products
  FOR SELECT USING (is_company_member(company_id));
CREATE POLICY "company_members_products_insert" ON public.products
  FOR INSERT WITH CHECK (is_company_member(company_id));
CREATE POLICY "company_members_products_update" ON public.products
  FOR UPDATE USING (is_company_member(company_id)) WITH CHECK (is_company_member(company_id));
CREATE POLICY "company_members_products_delete" ON public.products
  FOR DELETE USING (is_company_member(company_id));

CREATE INDEX idx_products_company ON public.products(company_id);
CREATE INDEX idx_products_sku ON public.products(company_id, sku) WHERE sku IS NOT NULL;

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
