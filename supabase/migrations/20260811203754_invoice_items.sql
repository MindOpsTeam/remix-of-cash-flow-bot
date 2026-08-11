-- Achado 2 (mapa de integração): itens da nota fiscal, ligando a nota ao catálogo
-- de produtos/serviços. RLS espelha sales_order_items (membro da empresa via join,
-- viewer barrado, template whitelabel bloqueado).
CREATE TABLE IF NOT EXISTS public.invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id),
  description text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS invoice_items_invoice_idx ON public.invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS invoice_items_product_idx ON public.invoice_items(product_id);
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY cm_ii_select ON public.invoice_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM invoices i WHERE i.id = invoice_id AND is_company_member(i.company_id)));
CREATE POLICY cm_ii_insert ON public.invoice_items FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM invoices i WHERE i.id = invoice_id AND is_company_member(i.company_id)));
CREATE POLICY cm_ii_update ON public.invoice_items FOR UPDATE
  USING (EXISTS (SELECT 1 FROM invoices i WHERE i.id = invoice_id AND is_company_member(i.company_id)));
CREATE POLICY cm_ii_delete ON public.invoice_items FOR DELETE
  USING (EXISTS (SELECT 1 FROM invoices i WHERE i.id = invoice_id AND is_company_member(i.company_id)));

CREATE POLICY "Template nao aceita insert" ON public.invoice_items AS RESTRICTIVE FOR INSERT WITH CHECK (NOT plataforma_bloqueada());
CREATE POLICY "Template nao aceita update" ON public.invoice_items AS RESTRICTIVE FOR UPDATE USING (NOT plataforma_bloqueada());
CREATE POLICY "Template nao aceita delete" ON public.invoice_items AS RESTRICTIVE FOR DELETE USING (NOT plataforma_bloqueada());

CREATE POLICY "Viewer nao insere itens" ON public.invoice_items AS RESTRICTIVE FOR INSERT
  WITH CHECK (pode_escrever_na_empresa((SELECT i.company_id FROM invoices i WHERE i.id = invoice_id)));
CREATE POLICY "Viewer nao altera itens" ON public.invoice_items AS RESTRICTIVE FOR UPDATE
  USING (pode_escrever_na_empresa((SELECT i.company_id FROM invoices i WHERE i.id = invoice_id)));
CREATE POLICY "Viewer nao apaga itens" ON public.invoice_items AS RESTRICTIVE FOR DELETE
  USING (pode_escrever_na_empresa((SELECT i.company_id FROM invoices i WHERE i.id = invoice_id)));

COMMENT ON TABLE public.invoice_items IS 'Itens de uma nota fiscal (produto/serviço). Liga a nota ao catálogo de products.';
