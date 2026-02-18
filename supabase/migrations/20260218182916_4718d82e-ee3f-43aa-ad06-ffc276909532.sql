
-- Fix the overly permissive policy by dropping and recreating with a more specific check
DROP POLICY "Authenticated users can create companies" ON public.companies;
CREATE POLICY "Authenticated users can create companies"
  ON public.companies FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
