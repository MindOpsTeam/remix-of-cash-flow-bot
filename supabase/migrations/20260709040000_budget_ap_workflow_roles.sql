-- F3: orçamento×realizado + workflow de aprovação em contas a pagar + alçadas.
-- Aditiva e idempotente.

-- Orçamento mensal por empresa (nível macro: receita/custos/despesas)
CREATE TABLE IF NOT EXISTS public.budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  month date NOT NULL,
  receita numeric(14,2) NOT NULL DEFAULT 0,
  custos numeric(14,2) NOT NULL DEFAULT 0,
  despesas numeric(14,2) NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, month)
);

ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Members manage budgets"
    ON public.budgets FOR ALL
    USING (public.is_company_member(company_id))
    WITH CHECK (public.is_company_member(company_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Workflow de aprovação em contas a pagar.
-- Estados: draft → awaiting_approval → approved → scheduled → paid (ou rejected).
-- Status legado ('pendente','pago', etc.) permanece válido — coluna nova separada.
ALTER TABLE public.bills_payable
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'approved'
    CHECK (approval_status IN ('draft', 'awaiting_approval', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS requested_by uuid,
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;

-- Alçada de aprovação por membro: contas acima do limite exigem aprovação
-- de um membro com alçada suficiente. NULL = sem limite (admin).
ALTER TABLE public.company_members
  ADD COLUMN IF NOT EXISTS approval_limit numeric(14,2);

COMMENT ON COLUMN public.company_members.approval_limit IS
  'Valor máximo que este membro aprova em contas a pagar; NULL = ilimitado';
