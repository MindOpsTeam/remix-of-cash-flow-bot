
-- Fix: The trigger function needs SECURITY DEFINER to bypass RLS
-- because it inserts into tables with RLS before company_members exists
CREATE OR REPLACE FUNCTION public.seed_default_accounts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
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
