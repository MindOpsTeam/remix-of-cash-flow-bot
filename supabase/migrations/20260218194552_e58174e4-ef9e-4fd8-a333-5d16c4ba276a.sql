-- Remove duplicate triggers, keep only one
DROP TRIGGER IF EXISTS seed_accounts_on_company_create ON public.companies;
DROP TRIGGER IF EXISTS seed_default_accounts_trigger ON public.companies;
DROP TRIGGER IF EXISTS on_company_created ON public.companies;

-- Recreate single trigger
CREATE TRIGGER on_company_created
  AFTER INSERT ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.seed_default_accounts();

-- Force PostgREST schema reload
NOTIFY pgrst, 'reload schema';