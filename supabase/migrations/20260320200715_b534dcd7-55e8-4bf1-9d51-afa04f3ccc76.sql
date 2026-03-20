ALTER TABLE public.company_members 
ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;