
CREATE TABLE IF NOT EXISTS public.reconciliation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  kept_transaction_id UUID NOT NULL,
  removed_transaction_id UUID NOT NULL,
  decision TEXT NOT NULL DEFAULT 'confirm',
  resolved_by TEXT DEFAULT 'user',
  removed_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.reconciliation_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view reconciliation log"
  ON public.reconciliation_log FOR SELECT
  USING (is_company_member(company_id));

CREATE POLICY "Service role full access on reconciliation_log"
  ON public.reconciliation_log FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
