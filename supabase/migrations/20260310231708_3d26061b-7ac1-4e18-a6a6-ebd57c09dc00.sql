
-- Create inter_config table for Banco Inter mTLS integration
CREATE TABLE public.inter_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  bank_account_id uuid REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
  client_id text NOT NULL DEFAULT '',
  client_secret text NOT NULL DEFAULT '',
  cert_pem text NOT NULL DEFAULT '',
  key_pem text NOT NULL DEFAULT '',
  account_number text,
  environment text NOT NULL DEFAULT 'sandbox',
  active boolean NOT NULL DEFAULT true,
  last_sync_at timestamptz,
  last_balance numeric,
  last_balance_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id)
);

-- Enable RLS
ALTER TABLE public.inter_config ENABLE ROW LEVEL SECURITY;

-- RLS: only company members can manage
CREATE POLICY "Members manage inter config"
  ON public.inter_config FOR ALL
  TO authenticated
  USING (public.is_company_member(company_id))
  WITH CHECK (public.is_company_member(company_id));

-- Add source and external_id columns to transactions if not exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='transactions' AND column_name='source') THEN
    ALTER TABLE public.transactions ADD COLUMN source text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='transactions' AND column_name='external_id') THEN
    ALTER TABLE public.transactions ADD COLUMN external_id text;
  END IF;
END$$;

-- Unique constraint for dedup on sync
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transactions_company_source_external_id_key') THEN
    CREATE UNIQUE INDEX transactions_company_source_external_id_key ON public.transactions (company_id, source, external_id) WHERE source IS NOT NULL AND external_id IS NOT NULL;
  END IF;
END$$;
