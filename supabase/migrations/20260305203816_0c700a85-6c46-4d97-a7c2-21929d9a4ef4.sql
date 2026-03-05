
-- Delete duplicate "Carteira" accounts, keeping only the oldest one per user
DELETE FROM public.personal_accounts
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id, name, type ORDER BY created_at ASC) as rn
    FROM public.personal_accounts
    WHERE name = 'Carteira' AND type = 'checking'
  ) sub
  WHERE rn > 1
);

-- Add unique constraint to prevent future duplicates of auto-created default accounts
CREATE UNIQUE INDEX IF NOT EXISTS idx_personal_accounts_default_per_user
ON public.personal_accounts (user_id, name, type)
WHERE is_active = true AND name = 'Carteira' AND type = 'checking';
