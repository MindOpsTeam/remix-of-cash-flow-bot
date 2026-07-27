ALTER TABLE public.bills_payable
  ADD COLUMN IF NOT EXISTS is_recurring boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recurrence_group_id uuid,
  ADD COLUMN IF NOT EXISTS recurrence_index integer,
  ADD COLUMN IF NOT EXISTS recurrence_total integer;

CREATE INDEX IF NOT EXISTS bills_payable_recurrence_group_idx
  ON public.bills_payable (recurrence_group_id)
  WHERE recurrence_group_id IS NOT NULL;