
-- 1) Fix owner_transactions bank account ownership check (was ba.company_id = ba.company_id)
DROP POLICY IF EXISTS "Users can insert own owner transactions" ON public.owner_transactions;
DROP POLICY IF EXISTS "Users can update own owner transactions" ON public.owner_transactions;

CREATE POLICY "Users can insert own owner transactions"
ON public.owner_transactions
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND public.is_company_member(company_id)
  AND (pf_account_id IS NULL OR EXISTS (
    SELECT 1 FROM public.personal_accounts pa
    WHERE pa.id = owner_transactions.pf_account_id AND pa.user_id = auth.uid()
  ))
  AND (pj_bank_account_id IS NULL OR EXISTS (
    SELECT 1 FROM public.bank_accounts ba
    WHERE ba.id = owner_transactions.pj_bank_account_id
      AND ba.company_id = owner_transactions.company_id
  ))
);

CREATE POLICY "Users can update own owner transactions"
ON public.owner_transactions
FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND public.is_company_member(company_id)
  AND (pf_account_id IS NULL OR EXISTS (
    SELECT 1 FROM public.personal_accounts pa
    WHERE pa.id = owner_transactions.pf_account_id AND pa.user_id = auth.uid()
  ))
  AND (pj_bank_account_id IS NULL OR EXISTS (
    SELECT 1 FROM public.bank_accounts ba
    WHERE ba.id = owner_transactions.pj_bank_account_id
      AND ba.company_id = owner_transactions.company_id
  ))
);

-- 2) Restrict documents bucket to user-owned folder prefix (path starts with {auth.uid()}/...)
DROP POLICY IF EXISTS "Users can read own documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload documents" ON storage.objects;

CREATE POLICY "Users can read own documents"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can upload own documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update own documents"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete own documents"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 3) whatsapp_pending_actions: add explicit user-scoped SELECT policy so any future read is bounded
CREATE POLICY "Users can view own whatsapp pending actions"
ON public.whatsapp_pending_actions
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- 4) Replace overly-permissive companies INSERT policy (WITH CHECK true).
-- Company creation flows through the SECURITY DEFINER RPC create_company_for_user,
-- which registers membership atomically. Remove the direct insert path.
DROP POLICY IF EXISTS "Authenticated users can create companies" ON public.companies;

-- 5) Lock down SECURITY DEFINER function execution.
-- Trigger functions do NOT need EXECUTE grants to client roles.
REVOKE EXECUTE ON FUNCTION public.auto_journal_entry_pf() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_journal_entry_pj() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_tax_guide_from_invoice() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_personal_account_balance() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_personal_transfer_balance() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.seed_default_accounts() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reserve_next_dps_number(uuid) FROM PUBLIC, anon;

-- is_company_member is used inside RLS policies (executes with policy context), so keep for authenticated
REVOKE EXECUTE ON FUNCTION public.is_company_member(uuid) FROM PUBLIC, anon;

-- create_company_for_user is a user-facing RPC; only authenticated should call it
REVOKE EXECUTE ON FUNCTION public.create_company_for_user(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_company_for_user(text, text) TO authenticated;
