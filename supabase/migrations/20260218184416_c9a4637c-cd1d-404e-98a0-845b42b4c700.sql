
-- Fix: Drop all RESTRICTIVE policies and recreate as PERMISSIVE

-- companies
DROP POLICY IF EXISTS "Authenticated users can create companies" ON public.companies;
DROP POLICY IF EXISTS "Members can update their companies" ON public.companies;
DROP POLICY IF EXISTS "Members can view their companies" ON public.companies;

CREATE POLICY "Authenticated users can create companies" ON public.companies FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Members can update their companies" ON public.companies FOR UPDATE TO authenticated USING (is_company_member(id));
CREATE POLICY "Members can view their companies" ON public.companies FOR SELECT TO authenticated USING (is_company_member(id));

-- company_members
DROP POLICY IF EXISTS "Members can view company members" ON public.company_members;
DROP POLICY IF EXISTS "Users can add themselves to companies" ON public.company_members;

CREATE POLICY "Members can view company members" ON public.company_members FOR SELECT TO authenticated USING (is_company_member(company_id));
CREATE POLICY "Users can add themselves to companies" ON public.company_members FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- chart_of_accounts
DROP POLICY IF EXISTS "Members can manage chart of accounts" ON public.chart_of_accounts;
DROP POLICY IF EXISTS "Members can update chart of accounts" ON public.chart_of_accounts;
DROP POLICY IF EXISTS "Members can view chart of accounts" ON public.chart_of_accounts;

CREATE POLICY "Members can manage chart of accounts" ON public.chart_of_accounts FOR INSERT TO authenticated WITH CHECK (is_company_member(company_id));
CREATE POLICY "Members can update chart of accounts" ON public.chart_of_accounts FOR UPDATE TO authenticated USING (is_company_member(company_id));
CREATE POLICY "Members can view chart of accounts" ON public.chart_of_accounts FOR SELECT TO authenticated USING (is_company_member(company_id));

-- cost_centers
DROP POLICY IF EXISTS "Members can manage cost centers" ON public.cost_centers;
DROP POLICY IF EXISTS "Members can view cost centers" ON public.cost_centers;

CREATE POLICY "Members can manage cost centers" ON public.cost_centers FOR INSERT TO authenticated WITH CHECK (is_company_member(company_id));
CREATE POLICY "Members can view cost centers" ON public.cost_centers FOR SELECT TO authenticated USING (is_company_member(company_id));

-- bank_accounts
DROP POLICY IF EXISTS "Members can manage bank accounts" ON public.bank_accounts;
DROP POLICY IF EXISTS "Members can view bank accounts" ON public.bank_accounts;

CREATE POLICY "Members can manage bank accounts" ON public.bank_accounts FOR INSERT TO authenticated WITH CHECK (is_company_member(company_id));
CREATE POLICY "Members can view bank accounts" ON public.bank_accounts FOR SELECT TO authenticated USING (is_company_member(company_id));

-- transactions
DROP POLICY IF EXISTS "Members can create transactions" ON public.transactions;
DROP POLICY IF EXISTS "Members can delete transactions" ON public.transactions;
DROP POLICY IF EXISTS "Members can update transactions" ON public.transactions;
DROP POLICY IF EXISTS "Members can view transactions" ON public.transactions;

CREATE POLICY "Members can create transactions" ON public.transactions FOR INSERT TO authenticated WITH CHECK (is_company_member(company_id) AND user_id = auth.uid());
CREATE POLICY "Members can delete transactions" ON public.transactions FOR DELETE TO authenticated USING (is_company_member(company_id));
CREATE POLICY "Members can update transactions" ON public.transactions FOR UPDATE TO authenticated USING (is_company_member(company_id));
CREATE POLICY "Members can view transactions" ON public.transactions FOR SELECT TO authenticated USING (is_company_member(company_id));

-- Create the missing trigger for seed_default_accounts
CREATE OR REPLACE TRIGGER seed_default_accounts_trigger
  AFTER INSERT ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.seed_default_accounts();
