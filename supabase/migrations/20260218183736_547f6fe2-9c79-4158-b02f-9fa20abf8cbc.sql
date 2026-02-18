
-- Drop and recreate the seed function with better defaults
CREATE OR REPLACE FUNCTION public.seed_default_accounts()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.chart_of_accounts (company_id, name, code, type) VALUES
    -- Receitas
    (NEW.id, 'Receita de Serviços', '3.1', 'revenue'),
    (NEW.id, 'Receita de Produtos', '3.2', 'revenue'),
    (NEW.id, 'Receita Recorrente', '3.3', 'revenue'),
    (NEW.id, 'Outras Receitas', '3.4', 'revenue'),
    -- Custos
    (NEW.id, 'Custos com Pessoal', '4.1', 'expense'),
    (NEW.id, 'Custos com Veículos', '4.2', 'expense'),
    (NEW.id, 'Combustível', '4.3', 'expense'),
    (NEW.id, 'Manutenção e Reparos', '4.4', 'expense'),
    (NEW.id, 'Material de Trabalho', '4.5', 'expense'),
    -- Despesas
    (NEW.id, 'Despesas Fixas', '5.1', 'expense'),
    (NEW.id, 'Despesas Operacionais', '5.2', 'expense'),
    (NEW.id, 'Marketing e Publicidade', '5.3', 'expense'),
    (NEW.id, 'Impostos e Taxas', '5.4', 'expense'),
    (NEW.id, 'Alimentação', '5.5', 'expense'),
    (NEW.id, 'Viagens e Deslocamento', '5.6', 'expense'),
    (NEW.id, 'Aluguel e Condomínio', '5.7', 'expense'),
    (NEW.id, 'Telecomunicações', '5.8', 'expense'),
    (NEW.id, 'Software e Assinaturas', '5.9', 'expense');

  -- Seed default cost centers
  INSERT INTO public.cost_centers (company_id, name) VALUES
    (NEW.id, 'Instalação'),
    (NEW.id, 'Operações'),
    (NEW.id, 'Comercial'),
    (NEW.id, 'Administrativo'),
    (NEW.id, 'TI'),
    (NEW.id, 'RH'),
    (NEW.id, 'Marketing'),
    (NEW.id, 'Financeiro');

  -- Seed default bank account
  INSERT INTO public.bank_accounts (company_id, name, bank_name) VALUES
    (NEW.id, 'Banco Inter', 'Inter'),
    (NEW.id, 'Conta Principal', 'Banco Principal');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;
