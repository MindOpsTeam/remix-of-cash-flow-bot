
-- Fix subcategories policies to check ownership via parent category
DROP POLICY "Users can manage subcategories" ON public.personal_subcategories;
DROP POLICY "Users can update subcategories" ON public.personal_subcategories;
DROP POLICY "Users can delete subcategories" ON public.personal_subcategories;

CREATE POLICY "Users can manage subcategories" ON public.personal_subcategories FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.personal_categories c WHERE c.id = category_id AND (c.user_id IS NULL OR c.user_id = auth.uid())));
CREATE POLICY "Users can update subcategories" ON public.personal_subcategories FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.personal_categories c WHERE c.id = category_id AND (c.user_id IS NULL OR c.user_id = auth.uid())));
CREATE POLICY "Users can delete subcategories" ON public.personal_subcategories FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.personal_categories c WHERE c.id = category_id AND (c.user_id IS NULL OR c.user_id = auth.uid())));
