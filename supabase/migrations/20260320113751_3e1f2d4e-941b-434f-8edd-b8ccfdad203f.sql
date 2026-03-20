
-- =====================================================
-- FIX: PJ journal trigger — handle INSERT, UPDATE, DELETE
-- =====================================================
CREATE OR REPLACE FUNCTION public.auto_journal_entry_pj()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_debit text;
  v_credit text;
  v_account_name text;
  v_bank_name text;
BEGIN
  -- DELETE: remove corresponding journal entry
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.company_journal_entries WHERE transaction_id = OLD.id;
    RETURN OLD;
  END IF;

  -- UPDATE: remove old entry first, then re-insert
  IF TG_OP = 'UPDATE' THEN
    DELETE FROM public.company_journal_entries WHERE transaction_id = OLD.id;
  END IF;

  -- INSERT or UPDATE: create journal entry
  IF NEW.account_id IS NOT NULL THEN
    SELECT name INTO v_account_name FROM public.chart_of_accounts WHERE id = NEW.account_id;
  END IF;
  v_account_name := COALESCE(v_account_name, CASE WHEN NEW.type = 'revenue' THEN 'Receitas' ELSE 'Despesas' END);

  IF NEW.bank_account_id IS NOT NULL THEN
    SELECT name INTO v_bank_name FROM public.bank_accounts WHERE id = NEW.bank_account_id;
  END IF;
  v_bank_name := COALESCE(v_bank_name, 'Caixa');

  IF NEW.type = 'expense' THEN
    v_debit := 'Despesas:' || v_account_name;
    v_credit := 'Ativo:' || v_bank_name;
  ELSE
    v_debit := 'Ativo:' || v_bank_name;
    v_credit := 'Receitas:' || v_account_name;
  END IF;

  INSERT INTO public.company_journal_entries (company_id, transaction_id, debit_account, credit_account, amount, date, description)
  VALUES (NEW.company_id, NEW.id, v_debit, v_credit, NEW.amount, NEW.date::date, NEW.description);

  RETURN NEW;
END;
$function$;

-- Change trigger to fire on INSERT OR UPDATE OR DELETE
DROP TRIGGER IF EXISTS trg_auto_journal_pj ON public.transactions;
CREATE TRIGGER trg_auto_journal_pj
  AFTER INSERT OR UPDATE OR DELETE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION auto_journal_entry_pj();
