
-- 1. Recriar função seed_default_accounts com estrutura simplificada
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
    (NEW.id, 'Custo de Mercadoria/Serviço', '4.1', 'expense', false),
    (NEW.id, 'Mão de Obra Direta', '4.2', 'expense', false),
    (NEW.id, 'Taxas de Pagamento', '4.3', 'expense', false),
    (NEW.id, 'Fretes', '4.4', 'expense', false);

  -- DESPESAS
  INSERT INTO public.chart_of_accounts (company_id, name, code, type, editable) VALUES
    (NEW.id, 'Marketing', '5.1', 'expense', false),
    (NEW.id, 'Salários', '5.2', 'expense', false),
    (NEW.id, 'Pró-labore', '5.3', 'expense', false),
    (NEW.id, 'Aluguel', '5.4', 'expense', false),
    (NEW.id, 'Softwares', '5.5', 'expense', false),
    (NEW.id, 'Contabilidade', '5.6', 'expense', false),
    (NEW.id, 'Impostos', '5.7', 'expense', false),
    (NEW.id, 'Juros e Tarifas', '5.8', 'expense', false);

  -- CENTROS DE CUSTO (sem Instalação)
  INSERT INTO public.cost_centers (company_id, name, category) VALUES
    (NEW.id, 'Administrativo', 'department'),
    (NEW.id, 'Financeiro', 'department'),
    (NEW.id, 'Comercial', 'department'),
    (NEW.id, 'Marketing', 'department'),
    (NEW.id, 'Operacional', 'department');

  -- CONTA BANCÁRIA
  INSERT INTO public.bank_accounts (company_id, name, bank_name) VALUES
    (NEW.id, 'Banco Inter – Conta Principal', 'Inter');

  RETURN NEW;
END;
$function$;

-- 2. Limpar triggers duplicados e recriar um único
DROP TRIGGER IF EXISTS on_company_created ON public.companies;
DROP TRIGGER IF EXISTS on_company_created_seed ON public.companies;
DROP TRIGGER IF EXISTS seed_on_company_created ON public.companies;

CREATE TRIGGER on_company_created
  AFTER INSERT ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.seed_default_accounts();

-- 3. Corrigir TODAS as políticas RLS para PERMISSIVE

-- companies
DROP POLICY IF EXISTS "Authenticated users can create companies" ON public.companies;
DROP POLICY IF EXISTS "Members can view their companies" ON public.companies;
DROP POLICY IF EXISTS "Members can update their companies" ON public.companies;

CREATE POLICY "Authenticated users can create companies" ON public.companies AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Members can view their companies" ON public.companies AS PERMISSIVE FOR SELECT TO authenticated USING (is_company_member(id));
CREATE POLICY "Members can update their companies" ON public.companies AS PERMISSIVE FOR UPDATE TO authenticated USING (is_company_member(id));

-- company_members
DROP POLICY IF EXISTS "Members can view company members" ON public.company_members;
DROP POLICY IF EXISTS "Users can add themselves to companies" ON public.company_members;

CREATE POLICY "Members can view company members" ON public.company_members AS PERMISSIVE FOR SELECT TO authenticated USING (is_company_member(company_id));
CREATE POLICY "Users can add themselves to companies" ON public.company_members AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- chart_of_accounts
DROP POLICY IF EXISTS "Members can view chart of accounts" ON public.chart_of_accounts;
DROP POLICY IF EXISTS "Members can manage chart of accounts" ON public.chart_of_accounts;
DROP POLICY IF EXISTS "Members can update chart of accounts" ON public.chart_of_accounts;
DROP POLICY IF EXISTS "Members can delete chart of accounts" ON public.chart_of_accounts;

CREATE POLICY "Members can view chart of accounts" ON public.chart_of_accounts AS PERMISSIVE FOR SELECT TO authenticated USING (is_company_member(company_id));
CREATE POLICY "Members can manage chart of accounts" ON public.chart_of_accounts AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (is_company_member(company_id));
CREATE POLICY "Members can update chart of accounts" ON public.chart_of_accounts AS PERMISSIVE FOR UPDATE TO authenticated USING (is_company_member(company_id));
CREATE POLICY "Members can delete chart of accounts" ON public.chart_of_accounts AS PERMISSIVE FOR DELETE TO authenticated USING (is_company_member(company_id));

-- cost_centers
DROP POLICY IF EXISTS "Members can view cost centers" ON public.cost_centers;
DROP POLICY IF EXISTS "Members can manage cost centers" ON public.cost_centers;
DROP POLICY IF EXISTS "Members can update cost centers" ON public.cost_centers;
DROP POLICY IF EXISTS "Members can delete cost centers" ON public.cost_centers;

CREATE POLICY "Members can view cost centers" ON public.cost_centers AS PERMISSIVE FOR SELECT TO authenticated USING (is_company_member(company_id));
CREATE POLICY "Members can manage cost centers" ON public.cost_centers AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (is_company_member(company_id));
CREATE POLICY "Members can update cost centers" ON public.cost_centers AS PERMISSIVE FOR UPDATE TO authenticated USING (is_company_member(company_id));
CREATE POLICY "Members can delete cost centers" ON public.cost_centers AS PERMISSIVE FOR DELETE TO authenticated USING (is_company_member(company_id));

-- bank_accounts
DROP POLICY IF EXISTS "Members can view bank accounts" ON public.bank_accounts;
DROP POLICY IF EXISTS "Members can manage bank accounts" ON public.bank_accounts;
DROP POLICY IF EXISTS "Members can update bank accounts" ON public.bank_accounts;
DROP POLICY IF EXISTS "Members can delete bank accounts" ON public.bank_accounts;

CREATE POLICY "Members can view bank accounts" ON public.bank_accounts AS PERMISSIVE FOR SELECT TO authenticated USING (is_company_member(company_id));
CREATE POLICY "Members can manage bank accounts" ON public.bank_accounts AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (is_company_member(company_id));
CREATE POLICY "Members can update bank accounts" ON public.bank_accounts AS PERMISSIVE FOR UPDATE TO authenticated USING (is_company_member(company_id));
CREATE POLICY "Members can delete bank accounts" ON public.bank_accounts AS PERMISSIVE FOR DELETE TO authenticated USING (is_company_member(company_id));

-- transactions
DROP POLICY IF EXISTS "Members can view transactions" ON public.transactions;
DROP POLICY IF EXISTS "Members can create transactions" ON public.transactions;
DROP POLICY IF EXISTS "Members can update transactions" ON public.transactions;
DROP POLICY IF EXISTS "Members can delete transactions" ON public.transactions;

CREATE POLICY "Members can view transactions" ON public.transactions AS PERMISSIVE FOR SELECT TO authenticated USING (is_company_member(company_id));
CREATE POLICY "Members can create transactions" ON public.transactions AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (is_company_member(company_id) AND user_id = auth.uid());
CREATE POLICY "Members can update transactions" ON public.transactions AS PERMISSIVE FOR UPDATE TO authenticated USING (is_company_member(company_id));
CREATE POLICY "Members can delete transactions" ON public.transactions AS PERMISSIVE FOR DELETE TO authenticated USING (is_company_member(company_id));
