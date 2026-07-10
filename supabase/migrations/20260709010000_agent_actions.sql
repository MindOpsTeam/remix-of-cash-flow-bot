-- Fila de ações dos agentes de IA (cobrança, fechamento, alertas).
-- Toda ação de agente exige aprovação humana antes de executar.
-- Aditiva e idempotente.

CREATE TABLE IF NOT EXISTS public.agent_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  agent text NOT NULL CHECK (agent IN ('collections', 'close', 'alerts')),
  action_type text NOT NULL,
  title text NOT NULL,
  description text,
  -- Mensagem rascunhada pelo agente (ex.: texto de cobrança pro WhatsApp)
  suggested_message text,
  payload jsonb,
  amount numeric(14,2),
  due_date date,
  contact_name text,
  contact_whatsapp text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'executed', 'failed', 'expired')),
  -- Evita o agente recriar a mesma ação enquanto uma pendente existe
  dedupe_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  decided_by uuid,
  executed_at timestamptz,
  result jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS agent_actions_dedupe
  ON public.agent_actions (company_id, dedupe_key)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS agent_actions_company_status
  ON public.agent_actions (company_id, status, created_at DESC);

ALTER TABLE public.agent_actions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Members manage agent actions"
    ON public.agent_actions FOR ALL
    USING (public.is_company_member(company_id))
    WITH CHECK (public.is_company_member(company_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
