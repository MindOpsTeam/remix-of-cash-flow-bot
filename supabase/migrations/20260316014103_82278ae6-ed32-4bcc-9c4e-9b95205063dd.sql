-- Migration 2: Sales, Purchases, Stock, Fiscal

-- Sales Orders
CREATE TABLE IF NOT EXISTS public.sales_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  user_id UUID NOT NULL,
  order_number SERIAL,
  status TEXT NOT NULL DEFAULT 'quote'
    CHECK (status IN ('quote', 'confirmed', 'invoiced', 'delivered', 'cancelled')),
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  subtotal NUMERIC(15,2) NOT NULL DEFAULT 0,
  discount_percent NUMERIC(5,2) DEFAULT 0,
  discount_value NUMERIC(15,2) DEFAULT 0,
  shipping NUMERIC(15,2) DEFAULT 0,
  total NUMERIC(15,2) NOT NULL DEFAULT 0,
  payment_method TEXT,
  payment_terms INTEGER,
  notes TEXT,
  internal_notes TEXT,
  salesperson TEXT,
  commission_percent NUMERIC(5,2),
  commission_value NUMERIC(15,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.sales_orders ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='sales_orders' AND policyname='cm_sales_orders_select') THEN
    CREATE POLICY "cm_sales_orders_select" ON public.sales_orders FOR SELECT USING (is_company_member(company_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='sales_orders' AND policyname='cm_sales_orders_insert') THEN
    CREATE POLICY "cm_sales_orders_insert" ON public.sales_orders FOR INSERT WITH CHECK (is_company_member(company_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='sales_orders' AND policyname='cm_sales_orders_update') THEN
    CREATE POLICY "cm_sales_orders_update" ON public.sales_orders FOR UPDATE USING (is_company_member(company_id)) WITH CHECK (is_company_member(company_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='sales_orders' AND policyname='cm_sales_orders_delete') THEN
    CREATE POLICY "cm_sales_orders_delete" ON public.sales_orders FOR DELETE USING (is_company_member(company_id));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_sales_orders_company ON public.sales_orders(company_id);
DROP TRIGGER IF EXISTS update_sales_orders_updated_at ON public.sales_orders;
CREATE TRIGGER update_sales_orders_updated_at BEFORE UPDATE ON public.sales_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Sales Order Items
CREATE TABLE IF NOT EXISTS public.sales_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  quantity NUMERIC(15,3) NOT NULL DEFAULT 1,
  unit_price NUMERIC(15,2) NOT NULL DEFAULT 0,
  discount_percent NUMERIC(5,2) DEFAULT 0,
  total NUMERIC(15,2) NOT NULL DEFAULT 0,
  sort_order INTEGER DEFAULT 0
);
ALTER TABLE public.sales_order_items ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='sales_order_items' AND policyname='cm_soi_select') THEN
    CREATE POLICY "cm_soi_select" ON public.sales_order_items FOR SELECT USING (EXISTS (SELECT 1 FROM public.sales_orders o WHERE o.id = order_id AND is_company_member(o.company_id)));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='sales_order_items' AND policyname='cm_soi_insert') THEN
    CREATE POLICY "cm_soi_insert" ON public.sales_order_items FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.sales_orders o WHERE o.id = order_id AND is_company_member(o.company_id)));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='sales_order_items' AND policyname='cm_soi_update') THEN
    CREATE POLICY "cm_soi_update" ON public.sales_order_items FOR UPDATE USING (EXISTS (SELECT 1 FROM public.sales_orders o WHERE o.id = order_id AND is_company_member(o.company_id)));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='sales_order_items' AND policyname='cm_soi_delete') THEN
    CREATE POLICY "cm_soi_delete" ON public.sales_order_items FOR DELETE USING (EXISTS (SELECT 1 FROM public.sales_orders o WHERE o.id = order_id AND is_company_member(o.company_id)));
  END IF;
END $$;

-- Purchase Orders
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  user_id UUID NOT NULL,
  order_number SERIAL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'confirmed', 'received', 'cancelled')),
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_date DATE,
  subtotal NUMERIC(15,2) NOT NULL DEFAULT 0,
  discount_value NUMERIC(15,2) DEFAULT 0,
  shipping NUMERIC(15,2) DEFAULT 0,
  total NUMERIC(15,2) NOT NULL DEFAULT 0,
  payment_terms INTEGER,
  notes TEXT,
  internal_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='purchase_orders' AND policyname='cm_purchase_orders_select') THEN
    CREATE POLICY "cm_purchase_orders_select" ON public.purchase_orders FOR SELECT USING (is_company_member(company_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='purchase_orders' AND policyname='cm_purchase_orders_insert') THEN
    CREATE POLICY "cm_purchase_orders_insert" ON public.purchase_orders FOR INSERT WITH CHECK (is_company_member(company_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='purchase_orders' AND policyname='cm_purchase_orders_update') THEN
    CREATE POLICY "cm_purchase_orders_update" ON public.purchase_orders FOR UPDATE USING (is_company_member(company_id)) WITH CHECK (is_company_member(company_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='purchase_orders' AND policyname='cm_purchase_orders_delete') THEN
    CREATE POLICY "cm_purchase_orders_delete" ON public.purchase_orders FOR DELETE USING (is_company_member(company_id));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_purchase_orders_company ON public.purchase_orders(company_id);
DROP TRIGGER IF EXISTS update_purchase_orders_updated_at ON public.purchase_orders;
CREATE TRIGGER update_purchase_orders_updated_at BEFORE UPDATE ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Purchase Order Items
CREATE TABLE IF NOT EXISTS public.purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  quantity NUMERIC(15,3) NOT NULL DEFAULT 1,
  unit_price NUMERIC(15,2) NOT NULL DEFAULT 0,
  total NUMERIC(15,2) NOT NULL DEFAULT 0,
  sort_order INTEGER DEFAULT 0
);
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='purchase_order_items' AND policyname='cm_poi_select') THEN
    CREATE POLICY "cm_poi_select" ON public.purchase_order_items FOR SELECT USING (EXISTS (SELECT 1 FROM public.purchase_orders o WHERE o.id = order_id AND is_company_member(o.company_id)));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='purchase_order_items' AND policyname='cm_poi_insert') THEN
    CREATE POLICY "cm_poi_insert" ON public.purchase_order_items FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.purchase_orders o WHERE o.id = order_id AND is_company_member(o.company_id)));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='purchase_order_items' AND policyname='cm_poi_update') THEN
    CREATE POLICY "cm_poi_update" ON public.purchase_order_items FOR UPDATE USING (EXISTS (SELECT 1 FROM public.purchase_orders o WHERE o.id = order_id AND is_company_member(o.company_id)));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='purchase_order_items' AND policyname='cm_poi_delete') THEN
    CREATE POLICY "cm_poi_delete" ON public.purchase_order_items FOR DELETE USING (EXISTS (SELECT 1 FROM public.purchase_orders o WHERE o.id = order_id AND is_company_member(o.company_id)));
  END IF;
END $$;

-- Warehouses
CREATE TABLE IF NOT EXISTS public.warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='warehouses' AND policyname='cm_warehouses_select') THEN
    CREATE POLICY "cm_warehouses_select" ON public.warehouses FOR SELECT USING (is_company_member(company_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='warehouses' AND policyname='cm_warehouses_insert') THEN
    CREATE POLICY "cm_warehouses_insert" ON public.warehouses FOR INSERT WITH CHECK (is_company_member(company_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='warehouses' AND policyname='cm_warehouses_update') THEN
    CREATE POLICY "cm_warehouses_update" ON public.warehouses FOR UPDATE USING (is_company_member(company_id)) WITH CHECK (is_company_member(company_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='warehouses' AND policyname='cm_warehouses_delete') THEN
    CREATE POLICY "cm_warehouses_delete" ON public.warehouses FOR DELETE USING (is_company_member(company_id));
  END IF;
END $$;

-- Stock Movements
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('in', 'out', 'adjustment', 'transfer')),
  quantity NUMERIC(15,3) NOT NULL,
  unit_cost NUMERIC(15,2),
  reference_type TEXT,
  reference_id UUID,
  notes TEXT,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='stock_movements' AND policyname='cm_stock_movements_select') THEN
    CREATE POLICY "cm_stock_movements_select" ON public.stock_movements FOR SELECT USING (is_company_member(company_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='stock_movements' AND policyname='cm_stock_movements_insert') THEN
    CREATE POLICY "cm_stock_movements_insert" ON public.stock_movements FOR INSERT WITH CHECK (is_company_member(company_id));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON public.stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_company ON public.stock_movements(company_id);

-- Invoices
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  sales_order_id UUID REFERENCES public.sales_orders(id) ON DELETE SET NULL,
  type TEXT NOT NULL DEFAULT 'nfe'
    CHECK (type IN ('nfe', 'nfse', 'nfce')),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'authorized', 'cancelled', 'denied')),
  number TEXT,
  series TEXT,
  access_key TEXT,
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total NUMERIC(15,2) NOT NULL DEFAULT 0,
  xml_url TEXT,
  pdf_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='invoices' AND policyname='cm_invoices_select') THEN
    CREATE POLICY "cm_invoices_select" ON public.invoices FOR SELECT USING (is_company_member(company_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='invoices' AND policyname='cm_invoices_insert') THEN
    CREATE POLICY "cm_invoices_insert" ON public.invoices FOR INSERT WITH CHECK (is_company_member(company_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='invoices' AND policyname='cm_invoices_update') THEN
    CREATE POLICY "cm_invoices_update" ON public.invoices FOR UPDATE USING (is_company_member(company_id)) WITH CHECK (is_company_member(company_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='invoices' AND policyname='cm_invoices_delete') THEN
    CREATE POLICY "cm_invoices_delete" ON public.invoices FOR DELETE USING (is_company_member(company_id));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_invoices_company ON public.invoices(company_id);
DROP TRIGGER IF EXISTS update_invoices_updated_at ON public.invoices;
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();