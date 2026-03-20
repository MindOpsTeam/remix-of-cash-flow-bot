
-- =====================================================
-- FIX: PF journal trigger — handle INSERT, UPDATE, DELETE
-- =====================================================
CREATE OR REPLACE FUNCTION public.auto_journal_entry_pf()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_debit text;
  v_credit text;
  v_account_name text;
  v_category_name text;
BEGIN
  -- DELETE: remove corresponding journal entry
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.journal_entries WHERE transaction_id = OLD.id;
    RETURN OLD;
  END IF;

  -- UPDATE: remove old entry first, then re-insert
  IF TG_OP = 'UPDATE' THEN
    DELETE FROM public.journal_entries WHERE transaction_id = OLD.id;
  END IF;

  -- INSERT or UPDATE: create journal entry
  IF NEW.account_id IS NOT NULL THEN
    SELECT name INTO v_account_name FROM public.personal_accounts WHERE id = NEW.account_id;
  ELSIF NEW.credit_card_id IS NOT NULL THEN
    SELECT name INTO v_account_name FROM public.personal_credit_cards WHERE id = NEW.credit_card_id;
  END IF;
  v_account_name := COALESCE(v_account_name, 'Caixa');

  IF NEW.category_id IS NOT NULL THEN
    SELECT name INTO v_category_name FROM public.personal_categories WHERE id = NEW.category_id;
  END IF;
  v_category_name := COALESCE(v_category_name, CASE WHEN NEW.type = 'receita' THEN 'Receitas' ELSE 'Despesas' END);

  IF NEW.type = 'despesa' THEN
    v_debit := 'Despesas:' || v_category_name;
    v_credit := 'Ativo:' || v_account_name;
  ELSE
    v_debit := 'Ativo:' || v_account_name;
    v_credit := 'Receitas:' || v_category_name;
  END IF;

  INSERT INTO public.journal_entries (user_id, transaction_id, debit_account, credit_account, amount, date, description)
  VALUES (NEW.user_id, NEW.id, v_debit, v_credit, NEW.amount, NEW.date::date, NEW.title);

  RETURN NEW;
END;
$function$;

-- Change trigger to fire on INSERT OR UPDATE OR DELETE
DROP TRIGGER IF EXISTS trg_auto_journal_pf ON public.personal_transactions;
CREATE TRIGGER trg_auto_journal_pf
  AFTER INSERT OR UPDATE OR DELETE ON public.personal_transactions
  FOR EACH ROW EXECUTE FUNCTION auto_journal_entry_pf();
