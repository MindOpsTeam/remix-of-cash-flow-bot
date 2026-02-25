
-- Drop old tables
DROP TABLE IF EXISTS public.asaas_webhook_logs CASCADE;
DROP TABLE IF EXISTS public.asaas_config CASCADE;

-- Create asaas_config (user-based)
CREATE TABLE public.asaas_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  api_key_production TEXT,
  api_key_sandbox TEXT,
  environment TEXT NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox', 'production')),
  webhook_auth_token TEXT,
  webhook_id TEXT,
  webhook_url TEXT,
  webhook_email TEXT,
  webhook_status TEXT NOT NULL DEFAULT 'inactive',
  webhook_send_type TEXT DEFAULT 'SEQUENTIALLY',
  notification_email TEXT,
  enabled_events TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.asaas_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own config" ON public.asaas_config
  FOR ALL USING (auth.uid() = user_id);

CREATE TRIGGER update_asaas_config_updated_at
  BEFORE UPDATE ON public.asaas_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create asaas_webhook_events
CREATE TABLE public.asaas_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_category TEXT NOT NULL,
  entity_id TEXT,
  entity_type TEXT,
  payload JSONB NOT NULL,
  processed BOOLEAN NOT NULL DEFAULT false,
  processed_at TIMESTAMPTZ,
  error TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, event_id)
);

CREATE INDEX idx_webhook_events_type ON public.asaas_webhook_events(event_type);
CREATE INDEX idx_webhook_events_processed ON public.asaas_webhook_events(processed);
CREATE INDEX idx_webhook_events_created ON public.asaas_webhook_events(created_at DESC);
CREATE INDEX idx_webhook_events_entity ON public.asaas_webhook_events(entity_id);

ALTER TABLE public.asaas_webhook_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own events" ON public.asaas_webhook_events
  FOR SELECT USING (auth.uid() = user_id);

-- Create asaas_payments (mirror)
CREATE TABLE public.asaas_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  asaas_id TEXT NOT NULL,
  customer_id TEXT,
  subscription_id TEXT,
  installment_id TEXT,
  payment_link TEXT,
  billing_type TEXT,
  status TEXT NOT NULL,
  value DECIMAL(12,2),
  net_value DECIMAL(12,2),
  description TEXT,
  external_reference TEXT,
  due_date DATE,
  payment_date DATE,
  confirmed_date DATE,
  credit_date DATE,
  invoice_url TEXT,
  bank_slip_url TEXT,
  pix_transaction JSONB,
  credit_card JSONB,
  discount JSONB,
  fine JSONB,
  interest JSONB,
  split JSONB,
  chargeback JSONB,
  refunds JSONB,
  raw_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, asaas_id)
);

ALTER TABLE public.asaas_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own payments" ON public.asaas_payments
  FOR ALL USING (auth.uid() = user_id);

CREATE TRIGGER update_asaas_payments_updated_at
  BEFORE UPDATE ON public.asaas_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
