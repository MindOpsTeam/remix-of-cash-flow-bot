
-- ============================
-- TABELA: user_preferences (sistema de modo)
-- ============================
CREATE TABLE public.user_preferences (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  preferred_mode text NOT NULL DEFAULT 'business',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own preferences" ON public.user_preferences FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own preferences" ON public.user_preferences FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own preferences" ON public.user_preferences FOR UPDATE USING (auth.uid() = user_id);

-- ============================
-- TABELA: personal_accounts (contas bancárias pessoais)
-- ============================
CREATE TABLE public.personal_accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'checking',
  bank_name text,
  icon text,
  color text,
  initial_balance numeric NOT NULL DEFAULT 0,
  current_balance numeric NOT NULL DEFAULT 0,
  owner text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.personal_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own accounts" ON public.personal_accounts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own accounts" ON public.personal_accounts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own accounts" ON public.personal_accounts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own accounts" ON public.personal_accounts FOR DELETE USING (auth.uid() = user_id);

-- ============================
-- TABELA: personal_categories
-- ============================
CREATE TABLE public.personal_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid,
  name text NOT NULL,
  type text NOT NULL,
  icon text,
  color text,
  default_kakeibo_group text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.personal_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view categories" ON public.personal_categories FOR SELECT USING (user_id IS NULL OR auth.uid() = user_id);
CREATE POLICY "Users can insert own categories" ON public.personal_categories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own categories" ON public.personal_categories FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own categories" ON public.personal_categories FOR DELETE USING (auth.uid() = user_id);

-- ============================
-- TABELA: personal_subcategories
-- ============================
CREATE TABLE public.personal_subcategories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id uuid NOT NULL REFERENCES public.personal_categories(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.personal_subcategories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view subcategories" ON public.personal_subcategories FOR SELECT USING (true);
CREATE POLICY "Users can manage subcategories" ON public.personal_subcategories FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update subcategories" ON public.personal_subcategories FOR UPDATE USING (true);
CREATE POLICY "Users can delete subcategories" ON public.personal_subcategories FOR DELETE USING (true);

-- ============================
-- TABELA: personal_category_rules
-- ============================
CREATE TABLE public.personal_category_rules (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid,
  keyword text NOT NULL,
  category_id uuid NOT NULL REFERENCES public.personal_categories(id) ON DELETE CASCADE,
  subcategory_id uuid REFERENCES public.personal_subcategories(id) ON DELETE SET NULL,
  kakeibo_group text,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.personal_category_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view rules" ON public.personal_category_rules FOR SELECT USING (user_id IS NULL OR auth.uid() = user_id);
CREATE POLICY "Users can insert own rules" ON public.personal_category_rules FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own rules" ON public.personal_category_rules FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own rules" ON public.personal_category_rules FOR DELETE USING (auth.uid() = user_id);

-- ============================
-- TABELA: personal_credit_cards
-- ============================
CREATE TABLE public.personal_credit_cards (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  name text NOT NULL,
  brand text,
  closing_day integer NOT NULL,
  due_day integer NOT NULL,
  credit_limit numeric NOT NULL DEFAULT 0,
  icon text,
  color text,
  owner text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.personal_credit_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own cards" ON public.personal_credit_cards FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own cards" ON public.personal_credit_cards FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own cards" ON public.personal_credit_cards FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own cards" ON public.personal_credit_cards FOR DELETE USING (auth.uid() = user_id);

-- ============================
-- TABELA: personal_transactions
-- ============================
CREATE TABLE public.personal_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  title text NOT NULL,
  amount numeric NOT NULL,
  type text NOT NULL,
  date date NOT NULL,
  description text,
  category_id uuid REFERENCES public.personal_categories(id) ON DELETE SET NULL,
  subcategory_id uuid REFERENCES public.personal_subcategories(id) ON DELETE SET NULL,
  account_id uuid REFERENCES public.personal_accounts(id) ON DELETE SET NULL,
  credit_card_id uuid REFERENCES public.personal_credit_cards(id) ON DELETE SET NULL,
  person text,
  is_recurring boolean NOT NULL DEFAULT false,
  is_essential boolean,
  is_planned boolean,
  kakeibo_group text,
  kakeibo_note text,
  nature text,
  impact text,
  status text NOT NULL DEFAULT 'confirmed',
  import_session_id uuid,
  original_import_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.personal_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own transactions" ON public.personal_transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own transactions" ON public.personal_transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own transactions" ON public.personal_transactions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own transactions" ON public.personal_transactions FOR DELETE USING (auth.uid() = user_id);

-- ============================
-- TABELA: personal_transfers
-- ============================
CREATE TABLE public.personal_transfers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  from_account_id uuid NOT NULL REFERENCES public.personal_accounts(id) ON DELETE CASCADE,
  to_account_id uuid NOT NULL REFERENCES public.personal_accounts(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  date date NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'confirmed',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.personal_transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own transfers" ON public.personal_transfers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own transfers" ON public.personal_transfers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own transfers" ON public.personal_transfers FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own transfers" ON public.personal_transfers FOR DELETE USING (auth.uid() = user_id);

-- ============================
-- TABELA: personal_budgets
-- ============================
CREATE TABLE public.personal_budgets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  category_id uuid NOT NULL REFERENCES public.personal_categories(id) ON DELETE CASCADE,
  monthly_limit numeric NOT NULL,
  alert_threshold numeric NOT NULL DEFAULT 80,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.personal_budgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own budgets" ON public.personal_budgets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own budgets" ON public.personal_budgets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own budgets" ON public.personal_budgets FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own budgets" ON public.personal_budgets FOR DELETE USING (auth.uid() = user_id);

-- ============================
-- TABELA: personal_goals
-- ============================
CREATE TABLE public.personal_goals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  target_amount numeric NOT NULL,
  current_amount numeric NOT NULL DEFAULT 0,
  deadline date NOT NULL,
  icon text,
  color text,
  owner text NOT NULL DEFAULT 'user',
  priority text NOT NULL DEFAULT 'medium',
  is_emergency_fund boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.personal_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own goals" ON public.personal_goals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own goals" ON public.personal_goals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own goals" ON public.personal_goals FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own goals" ON public.personal_goals FOR DELETE USING (auth.uid() = user_id);

-- ============================
-- TABELA: personal_control_charts
-- ============================
CREATE TABLE public.personal_control_charts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  name text NOT NULL,
  category_ids text[] NOT NULL,
  monthly_limit numeric NOT NULL DEFAULT 0,
  is_visible boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.personal_control_charts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own charts" ON public.personal_control_charts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own charts" ON public.personal_control_charts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own charts" ON public.personal_control_charts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own charts" ON public.personal_control_charts FOR DELETE USING (auth.uid() = user_id);

-- ============================
-- TABELA: personal_import_sessions
-- ============================
CREATE TABLE public.personal_import_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  file_name text NOT NULL,
  file_content text,
  status text NOT NULL DEFAULT 'pending',
  bank_detected text,
  total_rows integer,
  imported_rows integer,
  parsed_data jsonb,
  error_message text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.personal_import_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own imports" ON public.personal_import_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own imports" ON public.personal_import_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own imports" ON public.personal_import_sessions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own imports" ON public.personal_import_sessions FOR DELETE USING (auth.uid() = user_id);

-- FK for personal_transactions.import_session_id
ALTER TABLE public.personal_transactions
  ADD CONSTRAINT personal_transactions_import_session_fkey
  FOREIGN KEY (import_session_id) REFERENCES public.personal_import_sessions(id) ON DELETE SET NULL;

-- ============================
-- TABELA: personal_reconciliation
-- ============================
CREATE TABLE public.personal_reconciliation (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  reference_month text NOT NULL,
  source_type text NOT NULL,
  source_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  total_income numeric,
  total_expense numeric,
  transaction_count integer,
  imported_at timestamptz,
  reconciled_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.personal_reconciliation ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own reconciliation" ON public.personal_reconciliation FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own reconciliation" ON public.personal_reconciliation FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own reconciliation" ON public.personal_reconciliation FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own reconciliation" ON public.personal_reconciliation FOR DELETE USING (auth.uid() = user_id);

-- ============================
-- TABELA: personal_alerts
-- ============================
CREATE TABLE public.personal_alerts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  alert_type text NOT NULL,
  impact_value numeric,
  reference_month text,
  action_url text,
  is_read boolean NOT NULL DEFAULT false,
  is_dismissed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.personal_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own alerts" ON public.personal_alerts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own alerts" ON public.personal_alerts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own alerts" ON public.personal_alerts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own alerts" ON public.personal_alerts FOR DELETE USING (auth.uid() = user_id);

-- ============================
-- TABELA: personal_ai_conversations
-- ============================
CREATE TABLE public.personal_ai_conversations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  title text NOT NULL DEFAULT 'Nova conversa',
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  financial_context text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.personal_ai_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own conversations" ON public.personal_ai_conversations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own conversations" ON public.personal_ai_conversations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own conversations" ON public.personal_ai_conversations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own conversations" ON public.personal_ai_conversations FOR DELETE USING (auth.uid() = user_id);

-- Triggers para updated_at
CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE ON public.user_preferences FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_personal_accounts_updated_at BEFORE UPDATE ON public.personal_accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_personal_credit_cards_updated_at BEFORE UPDATE ON public.personal_credit_cards FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_personal_transactions_updated_at BEFORE UPDATE ON public.personal_transactions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_personal_transfers_updated_at BEFORE UPDATE ON public.personal_transfers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_personal_budgets_updated_at BEFORE UPDATE ON public.personal_budgets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_personal_goals_updated_at BEFORE UPDATE ON public.personal_goals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_personal_reconciliation_updated_at BEFORE UPDATE ON public.personal_reconciliation FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_personal_ai_conversations_updated_at BEFORE UPDATE ON public.personal_ai_conversations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
