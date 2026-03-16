-- Migration 1: Contacts & Products
CREATE TABLE IF NOT EXISTS public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  trade_name TEXT,
  type TEXT NOT NULL DEFAULT 'customer'
    CHECK (type IN ('customer', 'supplier', 'both')),
  person_type TEXT NOT NULL DEFAULT 'pj'
    CHECK (person_type IN ('pj', 'pf')),
  document TEXT,
  state_registration TEXT,
  email TEXT,
  phone TEXT,
  whatsapp TEXT,
  website TEXT,
  zip_code TEXT,
  street TEXT,
  number TEXT,
  complement TEXT,
  neighborhood TEXT,
  city TEXT,
  state TEXT,
  default_payment_terms INTEGER,
  credit_limit NUMERIC(15,2),
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'contacts' AND policyname = 'company_members_contacts_select') THEN
    CREATE POLICY "company_members_contacts_select" ON public.contacts FOR SELECT USING (is_company_member(company_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'contacts' AND policyname = 'company_members_contacts_insert') THEN
    CREATE POLICY "company_members_contacts_insert" ON public.contacts FOR INSERT WITH CHECK (is_company_member(company_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'contacts' AND policyname = 'company_members_contacts_update') THEN
    CREATE POLICY "company_members_contacts_update" ON public.contacts FOR UPDATE USING (is_company_member(company_id)) WITH CHECK (is_company_member(company_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'contacts' AND policyname = 'company_members_contacts_delete') THEN
    CREATE POLICY "company_members_contacts_delete" ON public.contacts FOR DELETE USING (is_company_member(company_id));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_contacts_company ON public.contacts(company_id);
CREATE INDEX IF NOT EXISTS idx_contacts_document ON public.contacts(company_id, document) WHERE document IS NOT NULL;

DROP TRIGGER IF EXISTS update_contacts_updated_at ON public.contacts;
CREATE TRIGGER update_contacts_updated_at
  BEFORE UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Products
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'product'
    CHECK (type IN ('product', 'service')),
  sku TEXT,
  barcode TEXT,
  unit TEXT NOT NULL DEFAULT 'un',
  sell_price NUMERIC(15,2) NOT NULL DEFAULT 0,
  cost_price NUMERIC(15,2),
  ncm TEXT,
  cfop TEXT,
  tax_origin TEXT,
  track_stock BOOLEAN NOT NULL DEFAULT false,
  min_stock NUMERIC(15,3) DEFAULT 0,
  current_stock NUMERIC(15,3) DEFAULT 0,
  account_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
  category TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'products' AND policyname = 'company_members_products_select') THEN
    CREATE POLICY "company_members_products_select" ON public.products FOR SELECT USING (is_company_member(company_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'products' AND policyname = 'company_members_products_insert') THEN
    CREATE POLICY "company_members_products_insert" ON public.products FOR INSERT WITH CHECK (is_company_member(company_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'products' AND policyname = 'company_members_products_update') THEN
    CREATE POLICY "company_members_products_update" ON public.products FOR UPDATE USING (is_company_member(company_id)) WITH CHECK (is_company_member(company_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'products' AND policyname = 'company_members_products_delete') THEN
    CREATE POLICY "company_members_products_delete" ON public.products FOR DELETE USING (is_company_member(company_id));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_products_company ON public.products(company_id);
CREATE INDEX IF NOT EXISTS idx_products_sku ON public.products(company_id, sku) WHERE sku IS NOT NULL;

DROP TRIGGER IF EXISTS update_products_updated_at ON public.products;
CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();