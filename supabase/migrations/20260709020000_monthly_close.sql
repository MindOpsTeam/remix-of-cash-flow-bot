-- Fechamento mensal assistido: um registro por empresa/mês.
-- "Fechar" é um marco gerencial (soft) — não bloqueia dados retroativos.
-- Aditiva e idempotente.

CREATE TABLE IF NOT EXISTS public.monthly_close (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  month date NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  -- Snapshot das pendências no momento do fechamento (auditoria)
  snapshot jsonb,
  closed_at timestamptz,
  closed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, month)
);

ALTER TABLE public.monthly_close ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Members manage monthly close"
    ON public.monthly_close FOR ALL
    USING (public.is_company_member(company_id))
    WITH CHECK (public.is_company_member(company_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
