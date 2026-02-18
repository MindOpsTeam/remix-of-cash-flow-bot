
-- =============================================
-- 1. Add payment_method and project to transactions
-- =============================================
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS payment_method text;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS project text;

-- =============================================
-- 2. Add category to cost_centers for grouping
-- =============================================
ALTER TABLE public.cost_centers ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'department';

-- =============================================
-- 3. Fix ALL RLS policies to be PERMISSIVE
-- =============================================

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
DROP POLICY IF EXISTS "Members can delete chart of accounts" ON public.chart_of_accounts;

CREATE POLICY "Members can manage chart of accounts" ON public.chart_of_accounts FOR INSERT TO authenticated WITH CHECK (is_company_member(company_id));
CREATE POLICY "Members can update chart of accounts" ON public.chart_of_accounts FOR UPDATE TO authenticated USING (is_company_member(company_id));
CREATE POLICY "Members can view chart of accounts" ON public.chart_of_accounts FOR SELECT TO authenticated USING (is_company_member(company_id));
CREATE POLICY "Members can delete chart of accounts" ON public.chart_of_accounts FOR DELETE TO authenticated USING (is_company_member(company_id));

-- cost_centers
DROP POLICY IF EXISTS "Members can manage cost centers" ON public.cost_centers;
DROP POLICY IF EXISTS "Members can view cost centers" ON public.cost_centers;
DROP POLICY IF EXISTS "Members can update cost centers" ON public.cost_centers;
DROP POLICY IF EXISTS "Members can delete cost centers" ON public.cost_centers;

CREATE POLICY "Members can manage cost centers" ON public.cost_centers FOR INSERT TO authenticated WITH CHECK (is_company_member(company_id));
CREATE POLICY "Members can view cost centers" ON public.cost_centers FOR SELECT TO authenticated USING (is_company_member(company_id));
CREATE POLICY "Members can update cost centers" ON public.cost_centers FOR UPDATE TO authenticated USING (is_company_member(company_id));
CREATE POLICY "Members can delete cost centers" ON public.cost_centers FOR DELETE TO authenticated USING (is_company_member(company_id));

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

-- =============================================
-- 4. Update seed_default_accounts with new structure
-- =============================================
CREATE OR REPLACE FUNCTION public.seed_default_accounts()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  -- RECEITAS
  INSERT INTO public.chart_of_accounts (company_id, name, code, type) VALUES
    (NEW.id, 'Receita de Serviços', '3.1', 'revenue'),
    (NEW.id, 'Receita de Produtos', '3.2', 'revenue'),
    (NEW.id, 'Receita Recorrente', '3.3', 'revenue'),
    (NEW.id, 'Outras Receitas', '3.4', 'revenue');

  -- CUSTOS
  INSERT INTO public.chart_of_accounts (company_id, name, code, type) VALUES
    (NEW.id, 'Custo de Mercadorias Vendidas', '4.1', 'expense'),
    (NEW.id, 'Custo de Serviços Prestados', '4.2', 'expense'),
    (NEW.id, 'Mão de Obra Direta', '4.3', 'expense'),
    (NEW.id, 'Taxas de Meios de Pagamento', '4.4', 'expense'),
    (NEW.id, 'Fretes', '4.5', 'expense');

  -- DESPESAS ADMINISTRATIVAS
  INSERT INTO public.chart_of_accounts (company_id, name, code, type) VALUES
    (NEW.id, 'Pró-labore', '5.1.1', 'expense'),
    (NEW.id, 'Salários Administrativos', '5.1.2', 'expense'),
    (NEW.id, 'Contabilidade', '5.1.3', 'expense'),
    (NEW.id, 'Jurídico', '5.1.4', 'expense'),
    (NEW.id, 'Aluguel', '5.1.5', 'expense'),
    (NEW.id, 'Energia/Internet', '5.1.6', 'expense'),
    (NEW.id, 'Softwares', '5.1.7', 'expense');

  -- DESPESAS COMERCIAIS
  INSERT INTO public.chart_of_accounts (company_id, name, code, type) VALUES
    (NEW.id, 'Marketing', '5.2.1', 'expense'),
    (NEW.id, 'Tráfego Pago', '5.2.2', 'expense'),
    (NEW.id, 'Comissão de Vendas', '5.2.3', 'expense');

  -- DESPESAS FINANCEIRAS
  INSERT INTO public.chart_of_accounts (company_id, name, code, type) VALUES
    (NEW.id, 'Juros', '5.3.1', 'expense'),
    (NEW.id, 'Tarifas Bancárias', '5.3.2', 'expense');

  -- DESPESAS TRIBUTÁRIAS
  INSERT INTO public.chart_of_accounts (company_id, name, code, type) VALUES
    (NEW.id, 'Impostos sobre Faturamento', '5.4.1', 'expense'),
    (NEW.id, 'Outros Impostos', '5.4.2', 'expense');

  -- CENTROS DE CUSTO - Departamentos
  INSERT INTO public.cost_centers (company_id, name, category) VALUES
    (NEW.id, 'Administrativo', 'department'),
    (NEW.id, 'Financeiro', 'department'),
    (NEW.id, 'Comercial', 'department'),
    (NEW.id, 'Marketing', 'department'),
    (NEW.id, 'Operacional', 'department');

  -- CONTAS BANCÁRIAS
  INSERT INTO public.bank_accounts (company_id, name, bank_name) VALUES
    (NEW.id, 'Conta Principal', 'Banco Principal');

  RETURN NEW;
END;
$function$;

-- Recreate the trigger
DROP TRIGGER IF EXISTS seed_default_accounts_trigger ON public.companies;
CREATE TRIGGER seed_default_accounts_trigger
  AFTER INSERT ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.seed_default_accounts();
