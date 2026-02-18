
-- =============================================
-- 1. ADD MISSING COLUMNS
-- =============================================

-- chart_of_accounts: add 'editable' flag to protect default accounts
ALTER TABLE public.chart_of_accounts ADD COLUMN IF NOT EXISTS editable boolean NOT NULL DEFAULT true;

-- cost_centers: add 'active' flag
ALTER TABLE public.cost_centers ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

-- =============================================
-- 2. DROP ALL EXISTING RLS POLICIES
-- =============================================

-- companies
DROP POLICY IF EXISTS "Authenticated users can create companies" ON public.companies;
DROP POLICY IF EXISTS "Members can view their companies" ON public.companies;
DROP POLICY IF EXISTS "Members can update their companies" ON public.companies;

-- company_members
DROP POLICY IF EXISTS "Members can view company members" ON public.company_members;
DROP POLICY IF EXISTS "Users can add themselves to companies" ON public.company_members;

-- chart_of_accounts
DROP POLICY IF EXISTS "Members can view chart of accounts" ON public.chart_of_accounts;
DROP POLICY IF EXISTS "Members can manage chart of accounts" ON public.chart_of_accounts;
DROP POLICY IF EXISTS "Members can update chart of accounts" ON public.chart_of_accounts;
DROP POLICY IF EXISTS "Members can delete chart of accounts" ON public.chart_of_accounts;

-- cost_centers
DROP POLICY IF EXISTS "Members can view cost centers" ON public.cost_centers;
DROP POLICY IF EXISTS "Members can manage cost centers" ON public.cost_centers;
DROP POLICY IF EXISTS "Members can update cost centers" ON public.cost_centers;
DROP POLICY IF EXISTS "Members can delete cost centers" ON public.cost_centers;

-- bank_accounts
DROP POLICY IF EXISTS "Members can view bank accounts" ON public.bank_accounts;
DROP POLICY IF EXISTS "Members can manage bank accounts" ON public.bank_accounts;
DROP POLICY IF EXISTS "Members can update bank accounts" ON public.bank_accounts;
DROP POLICY IF EXISTS "Members can delete bank accounts" ON public.bank_accounts;

-- transactions
DROP POLICY IF EXISTS "Members can view transactions" ON public.transactions;
DROP POLICY IF EXISTS "Members can create transactions" ON public.transactions;
DROP POLICY IF EXISTS "Members can update transactions" ON public.transactions;
DROP POLICY IF EXISTS "Members can delete transactions" ON public.transactions;

-- =============================================
-- 3. RECREATE ALL POLICIES AS PERMISSIVE
-- =============================================

-- companies
CREATE POLICY "Authenticated users can create companies"
  ON public.companies AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Members can view their companies"
  ON public.companies AS PERMISSIVE FOR SELECT TO authenticated
  USING (is_company_member(id));

CREATE POLICY "Members can update their companies"
  ON public.companies AS PERMISSIVE FOR UPDATE TO authenticated
  USING (is_company_member(id));

-- company_members
CREATE POLICY "Members can view company members"
  ON public.company_members AS PERMISSIVE FOR SELECT TO authenticated
  USING (is_company_member(company_id));

CREATE POLICY "Users can add themselves to companies"
  ON public.company_members AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- chart_of_accounts
CREATE POLICY "Members can view chart of accounts"
  ON public.chart_of_accounts AS PERMISSIVE FOR SELECT TO authenticated
  USING (is_company_member(company_id));

CREATE POLICY "Members can manage chart of accounts"
  ON public.chart_of_accounts AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (is_company_member(company_id));

CREATE POLICY "Members can update chart of accounts"
  ON public.chart_of_accounts AS PERMISSIVE FOR UPDATE TO authenticated
  USING (is_company_member(company_id));

CREATE POLICY "Members can delete chart of accounts"
  ON public.chart_of_accounts AS PERMISSIVE FOR DELETE TO authenticated
  USING (is_company_member(company_id));

-- cost_centers
CREATE POLICY "Members can view cost centers"
  ON public.cost_centers AS PERMISSIVE FOR SELECT TO authenticated
  USING (is_company_member(company_id));

CREATE POLICY "Members can manage cost centers"
  ON public.cost_centers AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (is_company_member(company_id));

CREATE POLICY "Members can update cost centers"
  ON public.cost_centers AS PERMISSIVE FOR UPDATE TO authenticated
  USING (is_company_member(company_id));

CREATE POLICY "Members can delete cost centers"
  ON public.cost_centers AS PERMISSIVE FOR DELETE TO authenticated
  USING (is_company_member(company_id));

-- bank_accounts
CREATE POLICY "Members can view bank accounts"
  ON public.bank_accounts AS PERMISSIVE FOR SELECT TO authenticated
  USING (is_company_member(company_id));

CREATE POLICY "Members can manage bank accounts"
  ON public.bank_accounts AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (is_company_member(company_id));

CREATE POLICY "Members can update bank accounts"
  ON public.bank_accounts AS PERMISSIVE FOR UPDATE TO authenticated
  USING (is_company_member(company_id));

CREATE POLICY "Members can delete bank accounts"
  ON public.bank_accounts AS PERMISSIVE FOR DELETE TO authenticated
  USING (is_company_member(company_id));

-- transactions
CREATE POLICY "Members can view transactions"
  ON public.transactions AS PERMISSIVE FOR SELECT TO authenticated
  USING (is_company_member(company_id));

CREATE POLICY "Members can create transactions"
  ON public.transactions AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (is_company_member(company_id) AND user_id = auth.uid());

CREATE POLICY "Members can update transactions"
  ON public.transactions AS PERMISSIVE FOR UPDATE TO authenticated
  USING (is_company_member(company_id));

CREATE POLICY "Members can delete transactions"
  ON public.transactions AS PERMISSIVE FOR DELETE TO authenticated
  USING (is_company_member(company_id));

-- =============================================
-- 4. UPDATE SEED FUNCTION WITH editable FLAG
-- =============================================

CREATE OR REPLACE FUNCTION public.seed_default_accounts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- RECEITAS
  INSERT INTO public.chart_of_accounts (company_id, name, code, type, editable) VALUES
    (NEW.id, 'Receita de Serviços', '3.1', 'revenue', false),
    (NEW.id, 'Receita de Produtos', '3.2', 'revenue', false),
    (NEW.id, 'Receita Recorrente', '3.3', 'revenue', false),
    (NEW.id, 'Outras Receitas', '3.4', 'revenue', false);

  -- CUSTOS
  INSERT INTO public.chart_of_accounts (company_id, name, code, type, editable) VALUES
    (NEW.id, 'Custo de Mercadorias Vendidas', '4.1', 'expense', false),
    (NEW.id, 'Custo de Serviços Prestados', '4.2', 'expense', false),
    (NEW.id, 'Mão de Obra Direta', '4.3', 'expense', false),
    (NEW.id, 'Taxas de Meios de Pagamento', '4.4', 'expense', false),
    (NEW.id, 'Fretes', '4.5', 'expense', false);

  -- DESPESAS ADMINISTRATIVAS
  INSERT INTO public.chart_of_accounts (company_id, name, code, type, editable) VALUES
    (NEW.id, 'Pró-labore', '5.1.1', 'expense', false),
    (NEW.id, 'Salários Administrativos', '5.1.2', 'expense', false),
    (NEW.id, 'Contabilidade', '5.1.3', 'expense', false),
    (NEW.id, 'Jurídico', '5.1.4', 'expense', false),
    (NEW.id, 'Aluguel', '5.1.5', 'expense', false),
    (NEW.id, 'Energia/Internet', '5.1.6', 'expense', false),
    (NEW.id, 'Softwares', '5.1.7', 'expense', false);

  -- DESPESAS COMERCIAIS
  INSERT INTO public.chart_of_accounts (company_id, name, code, type, editable) VALUES
    (NEW.id, 'Marketing', '5.2.1', 'expense', false),
    (NEW.id, 'Tráfego Pago', '5.2.2', 'expense', false),
    (NEW.id, 'Comissão de Vendas', '5.2.3', 'expense', false);

  -- DESPESAS FINANCEIRAS
  INSERT INTO public.chart_of_accounts (company_id, name, code, type, editable) VALUES
    (NEW.id, 'Juros', '5.3.1', 'expense', false),
    (NEW.id, 'Tarifas Bancárias', '5.3.2', 'expense', false);

  -- DESPESAS TRIBUTÁRIAS
  INSERT INTO public.chart_of_accounts (company_id, name, code, type, editable) VALUES
    (NEW.id, 'Impostos sobre Faturamento', '5.4.1', 'expense', false),
    (NEW.id, 'Outros Impostos', '5.4.2', 'expense', false);

  -- CENTROS DE CUSTO
  INSERT INTO public.cost_centers (company_id, name, category) VALUES
    (NEW.id, 'Administrativo', 'department'),
    (NEW.id, 'Financeiro', 'department'),
    (NEW.id, 'Comercial', 'department'),
    (NEW.id, 'Marketing', 'department'),
    (NEW.id, 'Operacional', 'department'),
    (NEW.id, 'Instalação', 'department');

  -- CONTAS BANCÁRIAS
  INSERT INTO public.bank_accounts (company_id, name, bank_name) VALUES
    (NEW.id, 'Banco Inter', 'Inter');

  RETURN NEW;
END;
$function$;

-- =============================================
-- 5. RECREATE TRIGGER
-- =============================================

DROP TRIGGER IF EXISTS on_company_created ON public.companies;
CREATE TRIGGER on_company_created
  AFTER INSERT ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.seed_default_accounts();
