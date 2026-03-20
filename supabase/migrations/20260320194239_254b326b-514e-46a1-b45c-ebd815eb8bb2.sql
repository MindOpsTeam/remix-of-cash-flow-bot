
-- Table: tax_guides
CREATE TABLE public.tax_guides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  competencia text NOT NULL,
  vencimento date NOT NULL,
  valor numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'a_pagar',
  source text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tax_guides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members manage tax_guides" ON public.tax_guides FOR ALL TO authenticated
  USING (public.is_company_member(company_id))
  WITH CHECK (public.is_company_member(company_id));

CREATE TRIGGER set_updated_at_tax_guides BEFORE UPDATE ON public.tax_guides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Table: bills_payable
CREATE TABLE public.bills_payable (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  fornecedor text NOT NULL,
  descricao text,
  valor numeric NOT NULL DEFAULT 0,
  vencimento date NOT NULL,
  status text NOT NULL DEFAULT 'a_vencer',
  source text NOT NULL DEFAULT 'manual',
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bills_payable ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members manage bills_payable" ON public.bills_payable FOR ALL TO authenticated
  USING (public.is_company_member(company_id))
  WITH CHECK (public.is_company_member(company_id));

CREATE TRIGGER set_updated_at_bills_payable BEFORE UPDATE ON public.bills_payable
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Table: fiscal_files
CREATE TABLE public.fiscal_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  nome text NOT NULL,
  tipo text NOT NULL DEFAULT 'outro',
  file_url text,
  file_size text,
  source text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fiscal_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members manage fiscal_files" ON public.fiscal_files FOR ALL TO authenticated
  USING (public.is_company_member(company_id))
  WITH CHECK (public.is_company_member(company_id));

CREATE TRIGGER set_updated_at_fiscal_files BEFORE UPDATE ON public.fiscal_files
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
