
-- Fix: INSERT policy on companies must be PERMISSIVE (restrictive requires a permissive to work)
DROP POLICY IF EXISTS "Authenticated users can create companies" ON public.companies;
CREATE POLICY "Authenticated users can create companies"
  ON public.companies FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Fix: SELECT/UPDATE policies on companies should also be permissive
DROP POLICY IF EXISTS "Members can view their companies" ON public.companies;
CREATE POLICY "Members can view their companies"
  ON public.companies FOR SELECT
  USING (is_company_member(id));

DROP POLICY IF EXISTS "Members can update their companies" ON public.companies;
CREATE POLICY "Members can update their companies"
  ON public.companies FOR UPDATE
  USING (is_company_member(id));

-- Fix: company_members policies
DROP POLICY IF EXISTS "Members can view company members" ON public.company_members;
CREATE POLICY "Members can view company members"
  ON public.company_members FOR SELECT
  USING (is_company_member(company_id));

DROP POLICY IF EXISTS "Users can add themselves to companies" ON public.company_members;
CREATE POLICY "Users can add themselves to companies"
  ON public.company_members FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Fix: chart_of_accounts policies
DROP POLICY IF EXISTS "Members can view chart of accounts" ON public.chart_of_accounts;
CREATE POLICY "Members can view chart of accounts"
  ON public.chart_of_accounts FOR SELECT
  USING (is_company_member(company_id));

DROP POLICY IF EXISTS "Members can manage chart of accounts" ON public.chart_of_accounts;
CREATE POLICY "Members can manage chart of accounts"
  ON public.chart_of_accounts FOR INSERT
  WITH CHECK (is_company_member(company_id));

DROP POLICY IF EXISTS "Members can update chart of accounts" ON public.chart_of_accounts;
CREATE POLICY "Members can update chart of accounts"
  ON public.chart_of_accounts FOR UPDATE
  USING (is_company_member(company_id));

DROP POLICY IF EXISTS "Members can delete chart of accounts" ON public.chart_of_accounts;
CREATE POLICY "Members can delete chart of accounts"
  ON public.chart_of_accounts FOR DELETE
  USING (is_company_member(company_id));

-- Fix: cost_centers policies
DROP POLICY IF EXISTS "Members can view cost centers" ON public.cost_centers;
CREATE POLICY "Members can view cost centers"
  ON public.cost_centers FOR SELECT
  USING (is_company_member(company_id));

DROP POLICY IF EXISTS "Members can manage cost centers" ON public.cost_centers;
CREATE POLICY "Members can manage cost centers"
  ON public.cost_centers FOR INSERT
  WITH CHECK (is_company_member(company_id));

DROP POLICY IF EXISTS "Members can update cost centers" ON public.cost_centers;
CREATE POLICY "Members can update cost centers"
  ON public.cost_centers FOR UPDATE
  USING (is_company_member(company_id));

DROP POLICY IF EXISTS "Members can delete cost centers" ON public.cost_centers;
CREATE POLICY "Members can delete cost centers"
  ON public.cost_centers FOR DELETE
  USING (is_company_member(company_id));

-- Fix: bank_accounts policies
DROP POLICY IF EXISTS "Members can view bank accounts" ON public.bank_accounts;
CREATE POLICY "Members can view bank accounts"
  ON public.bank_accounts FOR SELECT
  USING (is_company_member(company_id));

DROP POLICY IF EXISTS "Members can manage bank accounts" ON public.bank_accounts;
CREATE POLICY "Members can manage bank accounts"
  ON public.bank_accounts FOR INSERT
  WITH CHECK (is_company_member(company_id));

-- Fix: transactions policies
DROP POLICY IF EXISTS "Members can view transactions" ON public.transactions;
CREATE POLICY "Members can view transactions"
  ON public.transactions FOR SELECT
  USING (is_company_member(company_id));

DROP POLICY IF EXISTS "Members can create transactions" ON public.transactions;
CREATE POLICY "Members can create transactions"
  ON public.transactions FOR INSERT
  WITH CHECK (is_company_member(company_id) AND user_id = auth.uid());

DROP POLICY IF EXISTS "Members can update transactions" ON public.transactions;
CREATE POLICY "Members can update transactions"
  ON public.transactions FOR UPDATE
  USING (is_company_member(company_id));

DROP POLICY IF EXISTS "Members can delete transactions" ON public.transactions;
CREATE POLICY "Members can delete transactions"
  ON public.transactions FOR DELETE
  USING (is_company_member(company_id));

-- Create the missing trigger for seed_default_accounts
DROP TRIGGER IF EXISTS on_company_created ON public.companies;
CREATE TRIGGER on_company_created
  AFTER INSERT ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.seed_default_accounts();
