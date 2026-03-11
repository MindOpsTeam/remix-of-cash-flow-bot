
-- =====================================================
-- 1. Journal Entries PF (Partidas Dobradas)
-- =====================================================
CREATE TABLE public.journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  transaction_id uuid REFERENCES public.personal_transactions(id) ON DELETE CASCADE,
  debit_account text NOT NULL,
  credit_account text NOT NULL,
  amount numeric NOT NULL,
  date date NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own journal entries"
  ON public.journal_entries FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_journal_entries_user_date ON public.journal_entries(user_id, date);
CREATE INDEX idx_journal_entries_transaction ON public.journal_entries(transaction_id);

-- =====================================================
-- 2. Journal Entries PJ (Partidas Dobradas)
-- =====================================================
CREATE TABLE public.company_journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  transaction_id uuid REFERENCES public.transactions(id) ON DELETE CASCADE,
  debit_account text NOT NULL,
  credit_account text NOT NULL,
  amount numeric NOT NULL,
  date date NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.company_journal_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members manage company journal entries"
  ON public.company_journal_entries FOR ALL
  TO authenticated
  USING (is_company_member(company_id))
  WITH CHECK (is_company_member(company_id));

CREATE INDEX idx_company_journal_entries_company_date ON public.company_journal_entries(company_id, date);
CREATE INDEX idx_company_journal_entries_transaction ON public.company_journal_entries(transaction_id);

-- =====================================================
-- 3. Add reconciliation columns to personal_transactions
-- =====================================================
ALTER TABLE public.personal_transactions
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS reconciled_with_id uuid REFERENCES public.personal_transactions(id),
  ADD COLUMN IF NOT EXISTS reconciled_at timestamptz;

CREATE INDEX idx_personal_transactions_external ON public.personal_transactions(user_id, external_id) WHERE external_id IS NOT NULL;
CREATE INDEX idx_personal_transactions_reconciliation ON public.personal_transactions(user_id, date, amount, type) WHERE status != 'reconciled';

-- =====================================================
-- 4. Trigger: auto-create journal entries on PF insert
-- =====================================================
CREATE OR REPLACE FUNCTION public.auto_journal_entry_pf()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_debit text;
  v_credit text;
  v_account_name text;
  v_category_name text;
BEGIN
  -- Get account name
  IF NEW.account_id IS NOT NULL THEN
    SELECT name INTO v_account_name FROM public.personal_accounts WHERE id = NEW.account_id;
  ELSIF NEW.credit_card_id IS NOT NULL THEN
    SELECT name INTO v_account_name FROM public.personal_credit_cards WHERE id = NEW.credit_card_id;
  END IF;
  v_account_name := COALESCE(v_account_name, 'Caixa');

  -- Get category name
  IF NEW.category_id IS NOT NULL THEN
    SELECT name INTO v_category_name FROM public.personal_categories WHERE id = NEW.category_id;
  END IF;
  v_category_name := COALESCE(v_category_name, CASE WHEN NEW.type = 'receita' THEN 'Receitas' ELSE 'Despesas' END);

  -- Double-entry: Despesa = Debit expense, Credit asset; Receita = Debit asset, Credit revenue
  IF NEW.type = 'despesa' THEN
    v_debit := 'Despesas:' || v_category_name;
    v_credit := 'Ativo:' || v_account_name;
  ELSE
    v_debit := 'Ativo:' || v_account_name;
    v_credit := 'Receitas:' || v_category_name;
  END IF;

  INSERT INTO public.journal_entries (user_id, transaction_id, debit_account, credit_account, amount, date, description)
  VALUES (NEW.user_id, NEW.id, v_debit, v_credit, NEW.amount, NEW.date::date, NEW.title);

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_journal_pf
  AFTER INSERT ON public.personal_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_journal_entry_pf();

-- =====================================================
-- 5. Trigger: auto-create journal entries on PJ insert
-- =====================================================
CREATE OR REPLACE FUNCTION public.auto_journal_entry_pj()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_debit text;
  v_credit text;
  v_account_name text;
  v_bank_name text;
BEGIN
  -- Get chart of accounts name
  IF NEW.account_id IS NOT NULL THEN
    SELECT name INTO v_account_name FROM public.chart_of_accounts WHERE id = NEW.account_id;
  END IF;
  v_account_name := COALESCE(v_account_name, CASE WHEN NEW.type = 'revenue' THEN 'Receitas' ELSE 'Despesas' END);

  -- Get bank account name
  IF NEW.bank_account_id IS NOT NULL THEN
    SELECT name INTO v_bank_name FROM public.bank_accounts WHERE id = NEW.bank_account_id;
  END IF;
  v_bank_name := COALESCE(v_bank_name, 'Caixa');

  IF NEW.type = 'expense' THEN
    v_debit := 'Despesas:' || v_account_name;
    v_credit := 'Ativo:' || v_bank_name;
  ELSE
    v_debit := 'Ativo:' || v_bank_name;
    v_credit := 'Receitas:' || v_account_name;
  END IF;

  INSERT INTO public.company_journal_entries (company_id, transaction_id, debit_account, credit_account, amount, date, description)
  VALUES (NEW.company_id, NEW.id, v_debit, v_credit, NEW.amount, NEW.date::date, NEW.description);

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_journal_pj
  AFTER INSERT ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_journal_entry_pj();

-- =====================================================
-- 6. Enable realtime for journal tables
-- =====================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.journal_entries;
ALTER PUBLICATION supabase_realtime ADD TABLE public.company_journal_entries;
