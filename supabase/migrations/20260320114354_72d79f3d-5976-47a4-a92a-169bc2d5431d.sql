
-- Backfill orphaned PF transactions: touch them to trigger the journal entry creation
UPDATE public.personal_transactions 
SET updated_at = now() 
WHERE id IN (
  '9211ac87-bbf9-4e12-acbe-63626a3979cb',
  '79d65115-71d1-402d-9929-9312e6e9cdd7',
  'f535c858-735e-4bb5-994b-e0836edd20e5'
);
