
-- =============================================
-- Asaas Expanded Events: 10 new structured tables
-- 5 categories × 2 modes (PF user_id + PJ company_id)
-- =============================================

-- 1. TRANSFERS (PF)
CREATE TABLE public.asaas_transfers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  asaas_id TEXT NOT NULL,
  type TEXT,
  status TEXT NOT NULL,
  value NUMERIC,
  net_value NUMERIC,
  fee NUMERIC,
  transfer_fee NUMERIC,
  description TEXT,
  bank_account JSONB,
  scheduled_date DATE,
  transaction_receipt_url TEXT,
  authorized BOOLEAN,
  operation_type TEXT,
  external_reference TEXT,
  raw_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, asaas_id)
);
ALTER TABLE public.asaas_transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own transfers" ON public.asaas_transfers FOR ALL USING (auth.uid() = user_id);
CREATE TRIGGER update_asaas_transfers_updated_at BEFORE UPDATE ON public.asaas_transfers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_asaas_transfers_status ON public.asaas_transfers(status);
CREATE INDEX idx_asaas_transfers_created ON public.asaas_transfers(created_at);

-- 1b. TRANSFERS (PJ)
CREATE TABLE public.company_asaas_transfers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  asaas_id TEXT NOT NULL,
  type TEXT,
  status TEXT NOT NULL,
  value NUMERIC,
  net_value NUMERIC,
  fee NUMERIC,
  transfer_fee NUMERIC,
  description TEXT,
  bank_account JSONB,
  scheduled_date DATE,
  transaction_receipt_url TEXT,
  authorized BOOLEAN,
  operation_type TEXT,
  external_reference TEXT,
  raw_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, asaas_id)
);
ALTER TABLE public.company_asaas_transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members manage company transfers" ON public.company_asaas_transfers FOR ALL USING (is_company_member(company_id)) WITH CHECK (is_company_member(company_id));
CREATE TRIGGER update_company_asaas_transfers_updated_at BEFORE UPDATE ON public.company_asaas_transfers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_company_asaas_transfers_status ON public.company_asaas_transfers(status);
CREATE INDEX idx_company_asaas_transfers_created ON public.company_asaas_transfers(created_at);

-- 2. BILLS (PF)
CREATE TABLE public.asaas_bills (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  asaas_id TEXT NOT NULL,
  status TEXT NOT NULL,
  value NUMERIC,
  fee NUMERIC,
  description TEXT,
  company_name TEXT,
  identification_field TEXT,
  type TEXT,
  due_date DATE,
  schedule_date DATE,
  payment_date DATE,
  can_be_cancelled BOOLEAN,
  failure_reason TEXT,
  raw_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, asaas_id)
);
ALTER TABLE public.asaas_bills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own bills" ON public.asaas_bills FOR ALL USING (auth.uid() = user_id);
CREATE TRIGGER update_asaas_bills_updated_at BEFORE UPDATE ON public.asaas_bills FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_asaas_bills_status ON public.asaas_bills(status);
CREATE INDEX idx_asaas_bills_created ON public.asaas_bills(created_at);

-- 2b. BILLS (PJ)
CREATE TABLE public.company_asaas_bills (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  asaas_id TEXT NOT NULL,
  status TEXT NOT NULL,
  value NUMERIC,
  fee NUMERIC,
  description TEXT,
  company_name TEXT,
  identification_field TEXT,
  type TEXT,
  due_date DATE,
  schedule_date DATE,
  payment_date DATE,
  can_be_cancelled BOOLEAN,
  failure_reason TEXT,
  raw_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, asaas_id)
);
ALTER TABLE public.company_asaas_bills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members manage company bills" ON public.company_asaas_bills FOR ALL USING (is_company_member(company_id)) WITH CHECK (is_company_member(company_id));
CREATE TRIGGER update_company_asaas_bills_updated_at BEFORE UPDATE ON public.company_asaas_bills FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_company_asaas_bills_status ON public.company_asaas_bills(status);
CREATE INDEX idx_company_asaas_bills_created ON public.company_asaas_bills(created_at);

-- 3. SUBSCRIPTIONS (PF)
CREATE TABLE public.asaas_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  asaas_id TEXT NOT NULL,
  customer_id TEXT,
  billing_type TEXT,
  status TEXT NOT NULL,
  value NUMERIC,
  next_due_date DATE,
  cycle TEXT,
  description TEXT,
  discount JSONB,
  fine JSONB,
  interest JSONB,
  split JSONB,
  max_payments INTEGER,
  payment_count INTEGER,
  external_reference TEXT,
  end_date DATE,
  raw_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, asaas_id)
);
ALTER TABLE public.asaas_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own subscriptions" ON public.asaas_subscriptions FOR ALL USING (auth.uid() = user_id);
CREATE TRIGGER update_asaas_subscriptions_updated_at BEFORE UPDATE ON public.asaas_subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_asaas_subscriptions_status ON public.asaas_subscriptions(status);
CREATE INDEX idx_asaas_subscriptions_created ON public.asaas_subscriptions(created_at);

-- 3b. SUBSCRIPTIONS (PJ)
CREATE TABLE public.company_asaas_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  asaas_id TEXT NOT NULL,
  customer_id TEXT,
  billing_type TEXT,
  status TEXT NOT NULL,
  value NUMERIC,
  next_due_date DATE,
  cycle TEXT,
  description TEXT,
  discount JSONB,
  fine JSONB,
  interest JSONB,
  split JSONB,
  max_payments INTEGER,
  payment_count INTEGER,
  external_reference TEXT,
  end_date DATE,
  raw_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, asaas_id)
);
ALTER TABLE public.company_asaas_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members manage company subscriptions" ON public.company_asaas_subscriptions FOR ALL USING (is_company_member(company_id)) WITH CHECK (is_company_member(company_id));
CREATE TRIGGER update_company_asaas_subscriptions_updated_at BEFORE UPDATE ON public.company_asaas_subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_company_asaas_subscriptions_status ON public.company_asaas_subscriptions(status);
CREATE INDEX idx_company_asaas_subscriptions_created ON public.company_asaas_subscriptions(created_at);

-- 4. INVOICES (PF)
CREATE TABLE public.asaas_invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  asaas_id TEXT NOT NULL,
  payment_id TEXT,
  status TEXT NOT NULL,
  number TEXT,
  service_description TEXT,
  value NUMERIC,
  net_value NUMERIC,
  observations TEXT,
  taxes JSONB,
  customer_id TEXT,
  effective_date DATE,
  external_reference TEXT,
  municipality_inscription TEXT,
  rps_series TEXT,
  rps_number TEXT,
  pdf_url TEXT,
  xml_url TEXT,
  error_message TEXT,
  raw_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, asaas_id)
);
ALTER TABLE public.asaas_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own invoices" ON public.asaas_invoices FOR ALL USING (auth.uid() = user_id);
CREATE TRIGGER update_asaas_invoices_updated_at BEFORE UPDATE ON public.asaas_invoices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_asaas_invoices_status ON public.asaas_invoices(status);
CREATE INDEX idx_asaas_invoices_created ON public.asaas_invoices(created_at);

-- 4b. INVOICES (PJ)
CREATE TABLE public.company_asaas_invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  asaas_id TEXT NOT NULL,
  payment_id TEXT,
  status TEXT NOT NULL,
  number TEXT,
  service_description TEXT,
  value NUMERIC,
  net_value NUMERIC,
  observations TEXT,
  taxes JSONB,
  customer_id TEXT,
  effective_date DATE,
  external_reference TEXT,
  municipality_inscription TEXT,
  rps_series TEXT,
  rps_number TEXT,
  pdf_url TEXT,
  xml_url TEXT,
  error_message TEXT,
  raw_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, asaas_id)
);
ALTER TABLE public.company_asaas_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members manage company invoices" ON public.company_asaas_invoices FOR ALL USING (is_company_member(company_id)) WITH CHECK (is_company_member(company_id));
CREATE TRIGGER update_company_asaas_invoices_updated_at BEFORE UPDATE ON public.company_asaas_invoices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_company_asaas_invoices_status ON public.company_asaas_invoices(status);
CREATE INDEX idx_company_asaas_invoices_created ON public.company_asaas_invoices(created_at);

-- 5. ANTICIPATIONS (PF)
CREATE TABLE public.asaas_anticipations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  asaas_id TEXT NOT NULL,
  status TEXT NOT NULL,
  anticipated_value NUMERIC,
  net_value NUMERIC,
  fee NUMERIC,
  total_value NUMERIC,
  installment_count INTEGER,
  payment_id TEXT,
  anticipation_date DATE,
  credit_date DATE,
  debit_date DATE,
  due_date DATE,
  denial_reason TEXT,
  raw_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, asaas_id)
);
ALTER TABLE public.asaas_anticipations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own anticipations" ON public.asaas_anticipations FOR ALL USING (auth.uid() = user_id);
CREATE TRIGGER update_asaas_anticipations_updated_at BEFORE UPDATE ON public.asaas_anticipations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_asaas_anticipations_status ON public.asaas_anticipations(status);
CREATE INDEX idx_asaas_anticipations_created ON public.asaas_anticipations(created_at);

-- 5b. ANTICIPATIONS (PJ)
CREATE TABLE public.company_asaas_anticipations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  asaas_id TEXT NOT NULL,
  status TEXT NOT NULL,
  anticipated_value NUMERIC,
  net_value NUMERIC,
  fee NUMERIC,
  total_value NUMERIC,
  installment_count INTEGER,
  payment_id TEXT,
  anticipation_date DATE,
  credit_date DATE,
  debit_date DATE,
  due_date DATE,
  denial_reason TEXT,
  raw_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, asaas_id)
);
ALTER TABLE public.company_asaas_anticipations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members manage company anticipations" ON public.company_asaas_anticipations FOR ALL USING (is_company_member(company_id)) WITH CHECK (is_company_member(company_id));
CREATE TRIGGER update_company_asaas_anticipations_updated_at BEFORE UPDATE ON public.company_asaas_anticipations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_company_asaas_anticipations_status ON public.company_asaas_anticipations(status);
CREATE INDEX idx_company_asaas_anticipations_created ON public.company_asaas_anticipations(created_at);

-- Enable realtime for PF tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.asaas_transfers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.asaas_bills;
ALTER PUBLICATION supabase_realtime ADD TABLE public.asaas_subscriptions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.asaas_invoices;
ALTER PUBLICATION supabase_realtime ADD TABLE public.asaas_anticipations;
