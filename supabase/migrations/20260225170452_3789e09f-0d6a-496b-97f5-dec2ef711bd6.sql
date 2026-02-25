
DROP POLICY IF EXISTS "Authenticated users can create companies" ON public.companies;
CREATE POLICY "Authenticated users can create companies" 
  ON public.companies 
  FOR INSERT 
  TO authenticated 
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can add themselves to companies" ON public.company_members;
CREATE POLICY "Users can add themselves to companies" 
  ON public.company_members 
  FOR INSERT 
  TO authenticated 
  WITH CHECK (user_id = auth.uid());
