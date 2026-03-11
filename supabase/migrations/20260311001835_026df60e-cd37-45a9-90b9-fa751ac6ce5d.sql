CREATE TABLE public.whatsapp_pending_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number text NOT NULL,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  pending_action jsonb NOT NULL DEFAULT '{}'::jsonb,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_pending_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on whatsapp_pending_actions"
  ON public.whatsapp_pending_actions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);