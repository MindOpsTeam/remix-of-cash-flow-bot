
-- Webhooks configuration table
CREATE TABLE public.webhooks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  direction TEXT NOT NULL DEFAULT 'inbound' CHECK (direction IN ('inbound', 'outbound')),
  url TEXT, -- For outbound: destination URL. For inbound: auto-generated.
  secret_token TEXT NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  auto_create_transaction BOOLEAN NOT NULL DEFAULT false,
  default_type TEXT DEFAULT 'expense' CHECK (default_type IN ('revenue', 'expense')),
  default_account_id UUID REFERENCES public.chart_of_accounts(id),
  default_cost_center_id UUID REFERENCES public.cost_centers(id),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Webhook logs table
CREATE TABLE public.webhook_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  webhook_id UUID NOT NULL REFERENCES public.webhooks(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  payload JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'processed', 'failed', 'sent')),
  response_status INTEGER,
  error_message TEXT,
  transaction_id UUID REFERENCES public.transactions(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for webhooks
CREATE POLICY "Members can view webhooks" ON public.webhooks FOR SELECT USING (is_company_member(company_id));
CREATE POLICY "Members can create webhooks" ON public.webhooks FOR INSERT WITH CHECK (is_company_member(company_id));
CREATE POLICY "Members can update webhooks" ON public.webhooks FOR UPDATE USING (is_company_member(company_id));
CREATE POLICY "Members can delete webhooks" ON public.webhooks FOR DELETE USING (is_company_member(company_id));

-- RLS policies for webhook_logs
CREATE POLICY "Members can view webhook logs" ON public.webhook_logs FOR SELECT USING (is_company_member(company_id));
CREATE POLICY "Members can create webhook logs" ON public.webhook_logs FOR INSERT WITH CHECK (is_company_member(company_id));

-- Indexes
CREATE INDEX idx_webhooks_company ON public.webhooks(company_id);
CREATE INDEX idx_webhook_logs_webhook ON public.webhook_logs(webhook_id);
CREATE INDEX idx_webhook_logs_company ON public.webhook_logs(company_id);

-- Updated_at trigger
CREATE TRIGGER update_webhooks_updated_at
  BEFORE UPDATE ON public.webhooks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
