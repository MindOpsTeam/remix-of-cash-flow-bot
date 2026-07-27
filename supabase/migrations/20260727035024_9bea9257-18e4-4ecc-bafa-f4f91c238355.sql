
REVOKE EXECUTE ON FUNCTION public.reserve_next_dps_number(uuid) FROM authenticated;

CREATE OR REPLACE FUNCTION public.gen_org_id()
RETURNS text
LANGUAGE sql
SET search_path = public
AS $$
  SELECT 'ORG-' || upper(substr(md5(gen_random_uuid()::text), 1, 6))
$$;
