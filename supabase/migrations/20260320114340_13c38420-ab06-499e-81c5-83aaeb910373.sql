
-- Add unique constraint for idempotency on external_id per company
-- Only non-null external_ids need to be unique
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_external_id_unique 
ON public.transactions (company_id, external_id) 
WHERE external_id IS NOT NULL;

-- Same for personal_transactions if applicable
CREATE UNIQUE INDEX IF NOT EXISTS idx_personal_transactions_external_id_unique 
ON public.personal_transactions (user_id, external_id) 
WHERE external_id IS NOT NULL;
