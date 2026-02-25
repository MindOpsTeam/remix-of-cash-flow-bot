
-- Table: asaas_config
CREATE TABLE public.asaas_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  environment text NOT NULL DEFAULT 'sandbox',
  api_key_sandbox text,
  api_key_production text,
  webhook_auth_token text,
  webhook_id text,
  webhook_status text NOT NULL DEFAULT 'inactive',
  notification_email text,
  enabled_events jsonb NOT NULL DEFAULT '["PAYMENT_CREATED","PAYMENT_UPDATED","PAYMENT_CONFIRMED","PAYMENT_RECEIVED","PAYMENT_OVERDUE","PAYMENT_DELETED","PAYMENT_RESTORED","PAYMENT_REFUNDED","PAYMENT_RECEIVED_IN_CASH_UNDONE","PAYMENT_CHARGEBACK_REQUESTED","PAYMENT_CHARGEBACK_DISPUTE","PAYMENT_AWAITING_CHARGEBACK_REVERSAL","PAYMENT_DUNNING_RECEIVED","PAYMENT_DUNNING_REQUESTED","PAYMENT_BANK_SLIP_VIEWED","PAYMENT_CHECKOUT_VIEWED","PAYMENT_DUEDATE_WARNING","TRANSFER_CREATED","TRANSFER_PENDING","TRANSFER_IN_BANK_PROCESSING","TRANSFER_BLOCKED","TRANSFER_DONE","TRANSFER_FAILED","TRANSFER_CANCELLED","BILL_CREATED","BILL_PENDING","BILL_BANK_PROCESSING","BILL_PAID","BILL_CANCELLED","BILL_FAILED","BILL_REFUNDED","INVOICE_CREATED","INVOICE_UPDATED","INVOICE_SYNCHRONIZED","INVOICE_AUTHORIZED","INVOICE_PROCESSING_CANCELLATION","INVOICE_CANCELLED","INVOICE_CANCELLATION_DENIED","INVOICE_ERROR","ANTICIPATION_CREATED","ANTICIPATION_APPROVED","ANTICIPATION_DENIED","ANTICIPATION_CREDITED","ANTICIPATION_OVERDUE","ANTICIPATION_DEBITED","MOBILE_PHONE_RECHARGE_CONFIRMED","MOBILE_PHONE_RECHARGE_CANCELLED","ACCOUNT_STATUS_INITIAL_ALERT","ACCOUNT_STATUS_FINAL_ALERT","ACCOUNT_STATUS_AWAITING_ACTION_AUTHORIZATION"]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT asaas_config_company_unique UNIQUE (company_id)
);

ALTER TABLE public.asaas_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view asaas config"
  ON public.asaas_config FOR SELECT
  USING (public.is_company_member(company_id));

CREATE POLICY "Members can insert asaas config"
  ON public.asaas_config FOR INSERT
  WITH CHECK (public.is_company_member(company_id));

CREATE POLICY "Members can update asaas config"
  ON public.asaas_config FOR UPDATE
  USING (public.is_company_member(company_id));

CREATE POLICY "Members can delete asaas config"
  ON public.asaas_config FOR DELETE
  USING (public.is_company_member(company_id));

CREATE TRIGGER update_asaas_config_updated_at
  BEFORE UPDATE ON public.asaas_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Table: asaas_webhook_logs
CREATE TABLE public.asaas_webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  asaas_event text NOT NULL,
  entity_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  http_status_returned integer NOT NULL DEFAULT 200,
  idempotency_key text NOT NULL,
  processed boolean NOT NULL DEFAULT false,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT asaas_webhook_logs_idempotency UNIQUE (idempotency_key)
);

ALTER TABLE public.asaas_webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view asaas webhook logs"
  ON public.asaas_webhook_logs FOR SELECT
  USING (public.is_company_member(company_id));

CREATE INDEX idx_asaas_webhook_logs_company ON public.asaas_webhook_logs(company_id, created_at DESC);
CREATE INDEX idx_asaas_webhook_logs_event ON public.asaas_webhook_logs(asaas_event);
