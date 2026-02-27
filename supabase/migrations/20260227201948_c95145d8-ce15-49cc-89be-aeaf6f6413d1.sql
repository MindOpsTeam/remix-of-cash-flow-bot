
-- 1. Criar tabela owner_transactions
CREATE TABLE IF NOT EXISTS public.owner_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  transaction_type text NOT NULL CHECK (transaction_type IN ('retirada', 'aporte', 'pro_labore', 'dividendo', 'emprestimo_pf_pj', 'emprestimo_pj_pf')),
  amount numeric(15,2) NOT NULL CHECK (amount > 0),
  date date NOT NULL,
  description text,
  pf_account_id uuid REFERENCES public.personal_accounts(id) ON DELETE SET NULL,
  pj_bank_account_id uuid REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
  pf_transaction_id uuid REFERENCES public.personal_transactions(id) ON DELETE SET NULL,
  pj_transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'confirmed',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_owner_transactions_user_id ON public.owner_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_owner_transactions_company_id ON public.owner_transactions(company_id);
CREATE INDEX IF NOT EXISTS idx_owner_transactions_date ON public.owner_transactions(date DESC);

-- RLS
ALTER TABLE public.owner_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own owner transactions"
  ON public.owner_transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own owner transactions"
  ON public.owner_transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own owner transactions"
  ON public.owner_transactions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own owner transactions"
  ON public.owner_transactions FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger updated_at
CREATE TRIGGER update_owner_transactions_updated_at
  BEFORE UPDATE ON public.owner_transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Garantir colunas source e source_id em personal_transactions (no-op se ja existem)
ALTER TABLE public.personal_transactions
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual';

ALTER TABLE public.personal_transactions
  ADD COLUMN IF NOT EXISTS source_id uuid;
