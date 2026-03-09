
-- ============================================================
-- FIX 1: owner_transactions — INSERT e UPDATE
-- ============================================================
DROP POLICY IF EXISTS "Users can insert own owner transactions" ON public.owner_transactions;
DROP POLICY IF EXISTS "Users can update own owner transactions" ON public.owner_transactions;

CREATE POLICY "Users can insert own owner transactions"
ON public.owner_transactions FOR INSERT
WITH CHECK (
    auth.uid() = user_id
AND is_company_member(company_id)
AND (
      pf_account_id IS NULL
OR EXISTS (
SELECT 1 FROM public.personal_accounts
WHERE id = pf_account_id AND user_id = auth.uid()
      )
    )
AND (
      pj_bank_account_id IS NULL
OR EXISTS (
SELECT 1 FROM public.bank_accounts ba
WHERE ba.id = pj_bank_account_id AND ba.company_id = company_id
      )
    )
  );

CREATE POLICY "Users can update own owner transactions"
ON public.owner_transactions FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (
    auth.uid() = user_id
AND is_company_member(company_id)
AND (
      pf_account_id IS NULL
OR EXISTS (
SELECT 1 FROM public.personal_accounts
WHERE id = pf_account_id AND user_id = auth.uid()
      )
    )
AND (
      pj_bank_account_id IS NULL
OR EXISTS (
SELECT 1 FROM public.bank_accounts ba
WHERE ba.id = pj_bank_account_id AND ba.company_id = company_id
      )
    )
  );

-- ============================================================
-- FIX 2: personal_transfers — INSERT e UPDATE
-- ============================================================
DROP POLICY IF EXISTS "Users can insert own transfers" ON public.personal_transfers;
DROP POLICY IF EXISTS "Users can update own transfers" ON public.personal_transfers;

CREATE POLICY "Users can insert own transfers"
ON public.personal_transfers FOR INSERT
WITH CHECK (
    auth.uid() = user_id
AND EXISTS (
SELECT 1 FROM public.personal_accounts
WHERE id = from_account_id AND user_id = auth.uid()
    )
AND EXISTS (
SELECT 1 FROM public.personal_accounts
WHERE id = to_account_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own transfers"
ON public.personal_transfers FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (
    auth.uid() = user_id
AND EXISTS (
SELECT 1 FROM public.personal_accounts
WHERE id = from_account_id AND user_id = auth.uid()
    )
AND EXISTS (
SELECT 1 FROM public.personal_accounts
WHERE id = to_account_id AND user_id = auth.uid()
    )
  );

-- ============================================================
-- FIX 3: Trigger update_personal_account_balance
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_personal_account_balance()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_delta numeric;
BEGIN
IF TG_OP = 'DELETE' THEN
IF OLD.account_id IS NOT NULL THEN
      v_delta := CASE WHEN OLD.type = 'receita' THEN -OLD.amount ELSE OLD.amount END;
UPDATE public.personal_accounts
SET current_balance = current_balance + v_delta
WHERE id = OLD.account_id AND user_id = OLD.user_id;
END IF;
RETURN OLD;
END IF;
IF TG_OP = 'INSERT' THEN
IF NEW.account_id IS NOT NULL THEN
      v_delta := CASE WHEN NEW.type = 'receita' THEN NEW.amount ELSE -NEW.amount END;
UPDATE public.personal_accounts
SET current_balance = current_balance + v_delta
WHERE id = NEW.account_id AND user_id = NEW.user_id;
END IF;
RETURN NEW;
END IF;
IF TG_OP = 'UPDATE' THEN
IF OLD.account_id IS NOT NULL THEN
      v_delta := CASE WHEN OLD.type = 'receita' THEN -OLD.amount ELSE OLD.amount END;
UPDATE public.personal_accounts
SET current_balance = current_balance + v_delta
WHERE id = OLD.account_id AND user_id = OLD.user_id;
END IF;
IF NEW.account_id IS NOT NULL THEN
      v_delta := CASE WHEN NEW.type = 'receita' THEN NEW.amount ELSE -NEW.amount END;
UPDATE public.personal_accounts
SET current_balance = current_balance + v_delta
WHERE id = NEW.account_id AND user_id = NEW.user_id;
END IF;
RETURN NEW;
END IF;
RETURN NULL;
END; $$;

-- ============================================================
-- FIX 4: Trigger update_personal_transfer_balance
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_personal_transfer_balance()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
IF TG_OP = 'DELETE' THEN
UPDATE public.personal_accounts SET current_balance = current_balance + OLD.amount WHERE id = OLD.from_account_id AND user_id = OLD.user_id;
UPDATE public.personal_accounts SET current_balance = current_balance - OLD.amount WHERE id = OLD.to_account_id   AND user_id = OLD.user_id;
RETURN OLD;
END IF;
IF TG_OP = 'INSERT' THEN
UPDATE public.personal_accounts SET current_balance = current_balance - NEW.amount WHERE id = NEW.from_account_id AND user_id = NEW.user_id;
UPDATE public.personal_accounts SET current_balance = current_balance + NEW.amount WHERE id = NEW.to_account_id   AND user_id = NEW.user_id;
RETURN NEW;
END IF;
IF TG_OP = 'UPDATE' THEN
UPDATE public.personal_accounts SET current_balance = current_balance + OLD.amount WHERE id = OLD.from_account_id AND user_id = OLD.user_id;
UPDATE public.personal_accounts SET current_balance = current_balance - OLD.amount WHERE id = OLD.to_account_id   AND user_id = OLD.user_id;
UPDATE public.personal_accounts SET current_balance = current_balance - NEW.amount WHERE id = NEW.from_account_id AND user_id = NEW.user_id;
UPDATE public.personal_accounts SET current_balance = current_balance + NEW.amount WHERE id = NEW.to_account_id   AND user_id = NEW.user_id;
RETURN NEW;
END IF;
RETURN NULL;
END; $$;

-- ============================================================
-- FIX 5: personal_subcategories — policies
-- ============================================================
DROP POLICY IF EXISTS "Users can view subcategories"   ON public.personal_subcategories;
DROP POLICY IF EXISTS "Users can manage subcategories" ON public.personal_subcategories;
DROP POLICY IF EXISTS "Users can update subcategories" ON public.personal_subcategories;
DROP POLICY IF EXISTS "Users can delete subcategories" ON public.personal_subcategories;

CREATE POLICY "Users can view subcategories"
ON public.personal_subcategories FOR SELECT
USING (
EXISTS (
SELECT 1 FROM public.personal_categories pc
WHERE pc.id = category_id
AND (pc.user_id IS NULL OR pc.user_id = auth.uid())
    )
  );

CREATE POLICY "Users can insert subcategories"
ON public.personal_subcategories FOR INSERT
WITH CHECK (
EXISTS (
SELECT 1 FROM public.personal_categories pc
WHERE pc.id = category_id AND pc.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update subcategories"
ON public.personal_subcategories FOR UPDATE
USING (
EXISTS (
SELECT 1 FROM public.personal_categories pc
WHERE pc.id = category_id AND pc.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete subcategories"
ON public.personal_subcategories FOR DELETE
USING (
EXISTS (
SELECT 1 FROM public.personal_categories pc
WHERE pc.id = category_id AND pc.user_id = auth.uid()
    )
  );
