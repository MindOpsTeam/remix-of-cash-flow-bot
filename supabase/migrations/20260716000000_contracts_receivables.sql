-- Contratos recorrentes + Contas a Receber (diretriz do cliente).
-- receivables espelha bills_payable (Contas a Pagar). contracts = acordo recorrente
-- que gera cobrança/boleto (via Asaas) e cujo recebimento vira receita no DRE.
-- Aditiva e idempotente. Infra nova — NÃO altera a régua do DRE, só ACRESCENTA
-- um writer classificado ao ledger (account_id/cost_center herdados).

CREATE TABLE IF NOT EXISTS public.contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  description text NOT NULL,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  cycle text NOT NULL DEFAULT 'MONTHLY'
    CHECK (cycle IN ('WEEKLY','BIWEEKLY','MONTHLY','QUARTERLY','SEMIANNUALLY','YEARLY')),
  billing_day int NOT NULL DEFAULT 1 CHECK (billing_day BETWEEN 1 AND 28),
  payment_method text NOT NULL DEFAULT 'BOLETO'
    CHECK (payment_method IN ('BOLETO','PIX','CREDIT_CARD','UNDEFINED')),
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','ended')),
  -- Classificação contábil da receita — herdada pelo lançamento no recebimento (DRE)
  account_id uuid REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
  cost_center_id uuid REFERENCES public.cost_centers(id) ON DELETE SET NULL,
  asaas_customer_id text,
  asaas_subscription_id text,
  next_due_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS contracts_company ON public.contracts (company_id, status);

CREATE TABLE IF NOT EXISTS public.receivables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  contract_id uuid REFERENCES public.contracts(id) ON DELETE SET NULL,
  description text NOT NULL,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  due_date date NOT NULL,
  status text NOT NULL DEFAULT 'a_receber'
    CHECK (status IN ('a_receber','recebido','vencido','cancelado')),
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('contrato','asaas','manual')),
  asaas_payment_id text,
  boleto_url text,
  pix_url text,
  payment_date date,
  -- Loop DRE: lançamento de receita gerado no recebimento
  transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  account_id uuid REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
  cost_center_id uuid REFERENCES public.cost_centers(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS receivables_company_status ON public.receivables (company_id, status, due_date);
-- Dedupe: uma cobrança Asaas = um receivable
CREATE UNIQUE INDEX IF NOT EXISTS receivables_asaas
  ON public.receivables (company_id, asaas_payment_id) WHERE asaas_payment_id IS NOT NULL;

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receivables ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Members manage contracts" ON public.contracts FOR ALL
    USING (public.is_company_member(company_id)) WITH CHECK (public.is_company_member(company_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Members manage receivables" ON public.receivables FOR ALL
    USING (public.is_company_member(company_id)) WITH CHECK (public.is_company_member(company_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
