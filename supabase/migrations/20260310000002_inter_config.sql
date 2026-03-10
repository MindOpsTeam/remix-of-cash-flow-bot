-- Integração Banco Inter
-- Armazena credenciais OAuth2 + certificado mTLS por empresa

CREATE TABLE public.inter_config (
  id                UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id        UUID        NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,
  bank_account_id   UUID        REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
  client_id         TEXT        NOT NULL,
  client_secret     TEXT        NOT NULL,
  cert_pem          TEXT        NOT NULL,   -- Certificado PEM (chain)
  key_pem           TEXT        NOT NULL,   -- Chave privada PEM
  account_number    TEXT,                   -- Número da conta (opcional para multi-conta)
  environment       TEXT        NOT NULL DEFAULT 'production', -- production | sandbox
  active            BOOLEAN     NOT NULL DEFAULT true,
  last_sync_at      TIMESTAMPTZ,
  last_balance      NUMERIC(15,2),
  last_balance_at   TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.inter_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_members_inter_config"
  ON public.inter_config
  USING  (is_company_member(company_id))
  WITH CHECK (is_company_member(company_id));

-- Trigger para updated_at
CREATE TRIGGER inter_config_updated_at
  BEFORE UPDATE ON public.inter_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Adiciona external_id em transactions para deduplicação de sincronizações externas
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS external_id TEXT;

-- Índice único: evita inserção duplicada de transações sincronizadas pelo mesmo source
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_external_dedup
  ON public.transactions (company_id, source, external_id)
  WHERE external_id IS NOT NULL AND source IS NOT NULL;
