
-- ============ COMPANIES ============
DROP POLICY IF EXISTS "Authenticated users can create companies" ON public.companies;
CREATE POLICY "Authenticated users can create companies"
  ON public.companies AS PERMISSIVE FOR INSERT
  TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Members can view their companies" ON public.companies;
CREATE POLICY "Members can view their companies"
  ON public.companies AS PERMISSIVE FOR SELECT
  TO authenticated USING (is_company_member(id));

DROP POLICY IF EXISTS "Members can update their companies" ON public.companies;
CREATE POLICY "Members can update their companies"
  ON public.companies AS PERMISSIVE FOR UPDATE
  TO authenticated USING (is_company_member(id));

-- ============ COMPANY_MEMBERS ============
DROP POLICY IF EXISTS "Members can view company members" ON public.company_members;
CREATE POLICY "Members can view company members"
  ON public.company_members AS PERMISSIVE FOR SELECT
  TO authenticated USING (is_company_member(company_id));

DROP POLICY IF EXISTS "Users can add themselves to companies" ON public.company_members;
CREATE POLICY "Users can add themselves to companies"
  ON public.company_members AS PERMISSIVE FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid());

-- ============ CHART_OF_ACCOUNTS ============
DROP POLICY IF EXISTS "Members can view chart of accounts" ON public.chart_of_accounts;
CREATE POLICY "Members can view chart of accounts"
  ON public.chart_of_accounts AS PERMISSIVE FOR SELECT
  TO authenticated USING (is_company_member(company_id));

DROP POLICY IF EXISTS "Members can manage chart of accounts" ON public.chart_of_accounts;
CREATE POLICY "Members can manage chart of accounts"
  ON public.chart_of_accounts AS PERMISSIVE FOR INSERT
  TO authenticated WITH CHECK (is_company_member(company_id));

DROP POLICY IF EXISTS "Members can update chart of accounts" ON public.chart_of_accounts;
CREATE POLICY "Members can update chart of accounts"
  ON public.chart_of_accounts AS PERMISSIVE FOR UPDATE
  TO authenticated USING (is_company_member(company_id));

DROP POLICY IF EXISTS "Members can delete chart of accounts" ON public.chart_of_accounts;
CREATE POLICY "Members can delete chart of accounts"
  ON public.chart_of_accounts AS PERMISSIVE FOR DELETE
  TO authenticated USING (is_company_member(company_id));

-- ============ COST_CENTERS ============
DROP POLICY IF EXISTS "Members can view cost centers" ON public.cost_centers;
CREATE POLICY "Members can view cost centers"
  ON public.cost_centers AS PERMISSIVE FOR SELECT
  TO authenticated USING (is_company_member(company_id));

DROP POLICY IF EXISTS "Members can manage cost centers" ON public.cost_centers;
CREATE POLICY "Members can manage cost centers"
  ON public.cost_centers AS PERMISSIVE FOR INSERT
  TO authenticated WITH CHECK (is_company_member(company_id));

DROP POLICY IF EXISTS "Members can update cost centers" ON public.cost_centers;
CREATE POLICY "Members can update cost centers"
  ON public.cost_centers AS PERMISSIVE FOR UPDATE
  TO authenticated USING (is_company_member(company_id));

DROP POLICY IF EXISTS "Members can delete cost centers" ON public.cost_centers;
CREATE POLICY "Members can delete cost centers"
  ON public.cost_centers AS PERMISSIVE FOR DELETE
  TO authenticated USING (is_company_member(company_id));

-- ============ BANK_ACCOUNTS ============
DROP POLICY IF EXISTS "Members can view bank accounts" ON public.bank_accounts;
CREATE POLICY "Members can view bank accounts"
  ON public.bank_accounts AS PERMISSIVE FOR SELECT
  TO authenticated USING (is_company_member(company_id));

DROP POLICY IF EXISTS "Members can manage bank accounts" ON public.bank_accounts;
CREATE POLICY "Members can manage bank accounts"
  ON public.bank_accounts AS PERMISSIVE FOR INSERT
  TO authenticated WITH CHECK (is_company_member(company_id));

DROP POLICY IF EXISTS "Members can update bank accounts" ON public.bank_accounts;
CREATE POLICY "Members can update bank accounts"
  ON public.bank_accounts AS PERMISSIVE FOR UPDATE
  TO authenticated USING (is_company_member(company_id));

DROP POLICY IF EXISTS "Members can delete bank accounts" ON public.bank_accounts;
CREATE POLICY "Members can delete bank accounts"
  ON public.bank_accounts AS PERMISSIVE FOR DELETE
  TO authenticated USING (is_company_member(company_id));

-- ============ TRANSACTIONS ============
DROP POLICY IF EXISTS "Members can view transactions" ON public.transactions;
CREATE POLICY "Members can view transactions"
  ON public.transactions AS PERMISSIVE FOR SELECT
  TO authenticated USING (is_company_member(company_id));

DROP POLICY IF EXISTS "Members can create transactions" ON public.transactions;
CREATE POLICY "Members can create transactions"
  ON public.transactions AS PERMISSIVE FOR INSERT
  TO authenticated WITH CHECK (is_company_member(company_id) AND user_id = auth.uid());

DROP POLICY IF EXISTS "Members can update transactions" ON public.transactions;
CREATE POLICY "Members can update transactions"
  ON public.transactions AS PERMISSIVE FOR UPDATE
  TO authenticated USING (is_company_member(company_id));

DROP POLICY IF EXISTS "Members can delete transactions" ON public.transactions;
CREATE POLICY "Members can delete transactions"
  ON public.transactions AS PERMISSIVE FOR DELETE
  TO authenticated USING (is_company_member(company_id));

-- ============ TRIGGER ============
DROP TRIGGER IF EXISTS on_company_created ON public.companies;
DROP TRIGGER IF EXISTS seed_accounts_on_company_create ON public.companies;
DROP TRIGGER IF EXISTS seed_default_accounts_trigger ON public.companies;

CREATE TRIGGER on_company_created
  AFTER INSERT ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.seed_default_accounts();

-- ============ CACHE ============
NOTIFY pgrst, 'reload schema';
