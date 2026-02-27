
-- 1. Backfill: recalculate current_balance from initial_balance + transactions
UPDATE public.personal_accounts pa
SET current_balance = pa.initial_balance + COALESCE((
  SELECT SUM(CASE WHEN pt.type = 'receita' THEN pt.amount ELSE -pt.amount END)
  FROM public.personal_transactions pt
  WHERE pt.account_id = pa.id
), 0);

-- 2. Trigger function: personal_transactions -> personal_accounts.current_balance
CREATE OR REPLACE FUNCTION public.update_personal_account_balance()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_delta numeric;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.account_id IS NOT NULL THEN
      v_delta := CASE WHEN OLD.type = 'receita' THEN -OLD.amount ELSE OLD.amount END;
      UPDATE public.personal_accounts SET current_balance = current_balance + v_delta WHERE id = OLD.account_id;
    END IF;
    RETURN OLD;
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.account_id IS NOT NULL THEN
      v_delta := CASE WHEN NEW.type = 'receita' THEN NEW.amount ELSE -NEW.amount END;
      UPDATE public.personal_accounts SET current_balance = current_balance + v_delta WHERE id = NEW.account_id;
    END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF OLD.account_id IS NOT NULL THEN
      v_delta := CASE WHEN OLD.type = 'receita' THEN -OLD.amount ELSE OLD.amount END;
      UPDATE public.personal_accounts SET current_balance = current_balance + v_delta WHERE id = OLD.account_id;
    END IF;
    IF NEW.account_id IS NOT NULL THEN
      v_delta := CASE WHEN NEW.type = 'receita' THEN NEW.amount ELSE -NEW.amount END;
      UPDATE public.personal_accounts SET current_balance = current_balance + v_delta WHERE id = NEW.account_id;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END; $$;

CREATE TRIGGER trg_update_personal_account_balance
  AFTER INSERT OR UPDATE OR DELETE ON public.personal_transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_personal_account_balance();

-- 3. Trigger function: personal_transfers -> atualiza saldo das 2 contas
CREATE OR REPLACE FUNCTION public.update_personal_transfer_balance()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE public.personal_accounts SET current_balance = current_balance + OLD.amount WHERE id = OLD.from_account_id;
    UPDATE public.personal_accounts SET current_balance = current_balance - OLD.amount WHERE id = OLD.to_account_id;
    RETURN OLD;
  END IF;
  IF TG_OP = 'INSERT' THEN
    UPDATE public.personal_accounts SET current_balance = current_balance - NEW.amount WHERE id = NEW.from_account_id;
    UPDATE public.personal_accounts SET current_balance = current_balance + NEW.amount WHERE id = NEW.to_account_id;
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    UPDATE public.personal_accounts SET current_balance = current_balance + OLD.amount WHERE id = OLD.from_account_id;
    UPDATE public.personal_accounts SET current_balance = current_balance - OLD.amount WHERE id = OLD.to_account_id;
    UPDATE public.personal_accounts SET current_balance = current_balance - NEW.amount WHERE id = NEW.from_account_id;
    UPDATE public.personal_accounts SET current_balance = current_balance + NEW.amount WHERE id = NEW.to_account_id;
    RETURN NEW;
  END IF;
  RETURN NULL;
END; $$;

CREATE TRIGGER trg_update_personal_transfer_balance
  AFTER INSERT OR UPDATE OR DELETE ON public.personal_transfers
  FOR EACH ROW EXECUTE FUNCTION public.update_personal_transfer_balance();

-- 4. Constraint: contas diferentes em transferencias
ALTER TABLE public.personal_transfers
  ADD CONSTRAINT chk_different_accounts CHECK (from_account_id != to_account_id);

-- 5. Habilitar realtime para tabelas PF
ALTER PUBLICATION supabase_realtime ADD TABLE public.personal_transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.personal_accounts;
