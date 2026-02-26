
-- ============================================
-- 1. company_asaas_config
-- ============================================
CREATE TABLE public.company_asaas_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  environment text NOT NULL DEFAULT 'sandbox',
  api_key_sandbox text,
  api_key_production text,
  webhook_id text,
  webhook_url text,
  webhook_email text,
  webhook_auth_token text,
  webhook_send_type text DEFAULT 'SEQUENTIALLY',
  webhook_status text NOT NULL DEFAULT 'inactive',
  enabled_events text[] DEFAULT '{}',
  notification_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id)
);

ALTER TABLE public.company_asaas_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members manage company asaas config"
  ON public.company_asaas_config FOR ALL
  USING (is_company_member(company_id))
  WITH CHECK (is_company_member(company_id));

CREATE TRIGGER update_company_asaas_config_updated_at
  BEFORE UPDATE ON public.company_asaas_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- 2. company_asaas_payments
-- ============================================
CREATE TABLE public.company_asaas_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  asaas_id text NOT NULL,
  customer_id text,
  subscription_id text,
  installment_id text,
  payment_link text,
  billing_type text,
  status text NOT NULL,
  value numeric,
  net_value numeric,
  description text,
  external_reference text,
  due_date date,
  payment_date date,
  confirmed_date date,
  credit_date date,
  invoice_url text,
  bank_slip_url text,
  pix_transaction jsonb,
  credit_card jsonb,
  discount jsonb,
  fine jsonb,
  interest jsonb,
  split jsonb,
  chargeback jsonb,
  refunds jsonb,
  raw_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id, asaas_id)
);

ALTER TABLE public.company_asaas_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members manage company asaas payments"
  ON public.company_asaas_payments FOR ALL
  USING (is_company_member(company_id))
  WITH CHECK (is_company_member(company_id));

CREATE TRIGGER update_company_asaas_payments_updated_at
  BEFORE UPDATE ON public.company_asaas_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- 3. company_asaas_webhook_events
-- ============================================
CREATE TABLE public.company_asaas_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  event_id text NOT NULL,
  event_type text NOT NULL,
  event_category text NOT NULL,
  entity_id text,
  entity_type text,
  payload jsonb NOT NULL,
  processed boolean NOT NULL DEFAULT false,
  processed_at timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id, event_id)
);

ALTER TABLE public.company_asaas_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read company asaas webhook events"
  ON public.company_asaas_webhook_events FOR SELECT
  USING (is_company_member(company_id));

-- ============================================
-- 4. Enable realtime for company_asaas_payments
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.company_asaas_payments;
