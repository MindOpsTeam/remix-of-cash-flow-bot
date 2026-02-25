
CREATE OR REPLACE FUNCTION public.create_company_for_user(company_name text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_company_id uuid;
  result json;
BEGIN
  INSERT INTO companies (name) VALUES (company_name)
  RETURNING id INTO new_company_id;

  INSERT INTO company_members (company_id, user_id, role)
  VALUES (new_company_id, auth.uid(), 'admin');

  SELECT json_build_object(
    'id', c.id,
    'name', c.name,
    'cnpj', c.cnpj
  ) INTO result
  FROM companies c WHERE c.id = new_company_id;

  RETURN result;
END;
$$;
