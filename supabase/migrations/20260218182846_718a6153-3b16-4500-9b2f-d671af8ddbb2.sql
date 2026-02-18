
-- Create companies table
CREATE TABLE public.companies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  cnpj TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- Create company_members to link users to companies
CREATE TABLE public.company_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, user_id)
);
ALTER TABLE public.company_members ENABLE ROW LEVEL SECURITY;

-- Create chart_of_accounts (plano de contas)
CREATE TABLE public.chart_of_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.chart_of_accounts(id),
  name TEXT NOT NULL,
  code TEXT,
  type TEXT NOT NULL DEFAULT 'expense', -- 'revenue' or 'expense'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.chart_of_accounts ENABLE ROW LEVEL SECURITY;

-- Create cost_centers
CREATE TABLE public.cost_centers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.cost_centers ENABLE ROW LEVEL SECURITY;

-- Create bank_accounts
CREATE TABLE public.bank_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  bank_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;

-- Create transactions table
CREATE TABLE public.transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  date DATE NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC(15,2) NOT NULL,
  type TEXT NOT NULL, -- 'revenue' or 'expense'
  account_id UUID REFERENCES public.chart_of_accounts(id),
  cost_center_id UUID REFERENCES public.cost_centers(id),
  bank_account_id UUID REFERENCES public.bank_accounts(id),
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'confirmed', 'reconciled'
  source TEXT NOT NULL DEFAULT 'manual', -- 'manual', 'whatsapp', 'bank', 'import'
  attachment_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Helper function to check company membership
CREATE OR REPLACE FUNCTION public.is_company_member(_company_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_members
    WHERE company_id = _company_id AND user_id = auth.uid()
  )
$$;

-- RLS Policies
-- Companies: members can view their companies
CREATE POLICY "Members can view their companies"
  ON public.companies FOR SELECT
  TO authenticated
  USING (public.is_company_member(id));

CREATE POLICY "Authenticated users can create companies"
  ON public.companies FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Members can update their companies"
  ON public.companies FOR UPDATE
  TO authenticated
  USING (public.is_company_member(id));

-- Company members
CREATE POLICY "Members can view company members"
  ON public.company_members FOR SELECT
  TO authenticated
  USING (public.is_company_member(company_id));

CREATE POLICY "Users can add themselves to companies"
  ON public.company_members FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Chart of accounts
CREATE POLICY "Members can view chart of accounts"
  ON public.chart_of_accounts FOR SELECT
  TO authenticated
  USING (public.is_company_member(company_id));

CREATE POLICY "Members can manage chart of accounts"
  ON public.chart_of_accounts FOR INSERT
  TO authenticated
  WITH CHECK (public.is_company_member(company_id));

CREATE POLICY "Members can update chart of accounts"
  ON public.chart_of_accounts FOR UPDATE
  TO authenticated
  USING (public.is_company_member(company_id));

-- Cost centers
CREATE POLICY "Members can view cost centers"
  ON public.cost_centers FOR SELECT
  TO authenticated
  USING (public.is_company_member(company_id));

CREATE POLICY "Members can manage cost centers"
  ON public.cost_centers FOR INSERT
  TO authenticated
  WITH CHECK (public.is_company_member(company_id));

-- Bank accounts
CREATE POLICY "Members can view bank accounts"
  ON public.bank_accounts FOR SELECT
  TO authenticated
  USING (public.is_company_member(company_id));

CREATE POLICY "Members can manage bank accounts"
  ON public.bank_accounts FOR INSERT
  TO authenticated
  WITH CHECK (public.is_company_member(company_id));

-- Transactions
CREATE POLICY "Members can view transactions"
  ON public.transactions FOR SELECT
  TO authenticated
  USING (public.is_company_member(company_id));

CREATE POLICY "Members can create transactions"
  ON public.transactions FOR INSERT
  TO authenticated
  WITH CHECK (public.is_company_member(company_id) AND user_id = auth.uid());

CREATE POLICY "Members can update transactions"
  ON public.transactions FOR UPDATE
  TO authenticated
  USING (public.is_company_member(company_id));

CREATE POLICY "Members can delete transactions"
  ON public.transactions FOR DELETE
  TO authenticated
  USING (public.is_company_member(company_id));

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_companies_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default chart of accounts for new companies
CREATE OR REPLACE FUNCTION public.seed_default_accounts()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.chart_of_accounts (company_id, name, code, type) VALUES
    (NEW.id, 'Receita Operacional', '3.1', 'revenue'),
    (NEW.id, 'Receita de Produtos', '3.2', 'revenue'),
    (NEW.id, 'Receita Recorrente', '3.3', 'revenue'),
    (NEW.id, 'Custos com Pessoal', '4.1', 'expense'),
    (NEW.id, 'Despesas Fixas', '4.2', 'expense'),
    (NEW.id, 'Despesas Operacionais', '4.3', 'expense'),
    (NEW.id, 'Marketing', '4.4', 'expense'),
    (NEW.id, 'Impostos e Taxas', '4.5', 'expense');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER seed_accounts_on_company_create
  AFTER INSERT ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.seed_default_accounts();
