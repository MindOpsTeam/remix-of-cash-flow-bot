-- Open Finance: conexões bancárias multi-instituição via agregador (Pluggy/Belvo).
-- Provider-agnóstico. Aditiva e idempotente. Ver docs/OPEN-FINANCE-DECISAO.md.

-- Uma conexão = um "item" (Pluggy) / "link" (Belvo) = vínculo cliente↔banco.
CREATE TABLE IF NOT EXISTS public.bank_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'pluggy' CHECK (provider IN ('pluggy', 'belvo')),
  external_id text NOT NULL,                    -- itemId / linkId no provedor
  institution_name text,
  institution_image text,
  status text NOT NULL DEFAULT 'updating'
    CHECK (status IN ('updating', 'updated', 'login_error', 'outdated', 'error', 'waiting_user_input')),
  status_detail text,
  consent_expires_at timestamptz,
  last_synced_at timestamptz,
  -- Guard de custo: chamadas ao histórico por mês (limite OFB = 8/CNPJ/mês)
  history_calls_month int NOT NULL DEFAULT 0,
  history_calls_reset_at date NOT NULL DEFAULT date_trunc('month', now())::date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, provider, external_id)
);

CREATE INDEX IF NOT EXISTS bank_connections_company ON public.bank_connections (company_id);
CREATE INDEX IF NOT EXISTS bank_connections_external ON public.bank_connections (provider, external_id);

-- Vincula contas bancárias existentes à conexão + dados do provedor
ALTER TABLE public.bank_accounts
  ADD COLUMN IF NOT EXISTS connection_id uuid REFERENCES public.bank_connections(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS account_type text,
  ADD COLUMN IF NOT EXISTS balance numeric(14,2),
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;

CREATE INDEX IF NOT EXISTS bank_accounts_external ON public.bank_accounts (external_id) WHERE external_id IS NOT NULL;

-- Staging de transações brutas do provedor (dedupe por external_id/empresa).
-- Vira `transactions` após conciliação/classificação (status='imported').
CREATE TABLE IF NOT EXISTS public.bank_transactions_raw (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  connection_id uuid REFERENCES public.bank_connections(id) ON DELETE CASCADE,
  provider text NOT NULL,
  external_id text NOT NULL,                    -- id da transação no provedor
  account_external_id text,
  date date NOT NULL,
  description text,
  amount numeric(14,2) NOT NULL,                -- valor absoluto
  direction text NOT NULL CHECK (direction IN ('revenue', 'expense')),
  category text,
  payment_method text,
  raw jsonb,
  status text NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'imported', 'ignored', 'matched')),
  transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, provider, external_id)
);

CREATE INDEX IF NOT EXISTS bank_transactions_raw_status
  ON public.bank_transactions_raw (company_id, status, date DESC);

ALTER TABLE public.bank_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_transactions_raw ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Members manage bank connections"
    ON public.bank_connections FOR ALL
    USING (public.is_company_member(company_id))
    WITH CHECK (public.is_company_member(company_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Members read bank transactions raw"
    ON public.bank_transactions_raw FOR ALL
    USING (public.is_company_member(company_id))
    WITH CHECK (public.is_company_member(company_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
