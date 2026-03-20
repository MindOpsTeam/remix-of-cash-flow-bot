-- Restore ALL essential triggers that are missing

-- 1. Auto journal entry for PJ transactions (INSERT/UPDATE/DELETE)
DROP TRIGGER IF EXISTS trg_auto_journal_pj ON public.transactions;
CREATE TRIGGER trg_auto_journal_pj
  AFTER INSERT OR UPDATE OR DELETE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.auto_journal_entry_pj();

-- 2. Auto journal entry for PF transactions (INSERT/UPDATE/DELETE)
DROP TRIGGER IF EXISTS trg_auto_journal_pf ON public.personal_transactions;
CREATE TRIGGER trg_auto_journal_pf
  AFTER INSERT OR UPDATE OR DELETE ON public.personal_transactions
  FOR EACH ROW EXECUTE FUNCTION public.auto_journal_entry_pf();

-- 3. Personal account balance update
DROP TRIGGER IF EXISTS trg_update_personal_account_balance ON public.personal_transactions;
CREATE TRIGGER trg_update_personal_account_balance
  AFTER INSERT OR UPDATE OR DELETE ON public.personal_transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_personal_account_balance();

-- 4. Personal transfer balance update
DROP TRIGGER IF EXISTS trg_update_personal_transfer_balance ON public.personal_transfers;
CREATE TRIGGER trg_update_personal_transfer_balance
  AFTER INSERT OR UPDATE OR DELETE ON public.personal_transfers
  FOR EACH ROW EXECUTE FUNCTION public.update_personal_transfer_balance();

-- 5. Seed default accounts on company creation
DROP TRIGGER IF EXISTS trg_seed_default_accounts ON public.companies;
CREATE TRIGGER trg_seed_default_accounts
  AFTER INSERT ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.seed_default_accounts();

-- 6. updated_at triggers for relevant tables
DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'companies', 'contacts', 'inter_config', 'nfse_config',
    'asaas_config', 'company_asaas_config',
    'owner_transactions'
  ])
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_updated_at ON public.%I', tbl);
    EXECUTE format(
      'CREATE TRIGGER trg_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()',
      tbl
    );
  END LOOP;
END $$;