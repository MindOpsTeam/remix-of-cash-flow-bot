-- Achado 1 (mapa de integração): nota fiscal autorizada gera a conta a receber,
-- ligada por invoice_id, de forma idempotente (não duplica; vincula o recebível
-- do pedido quando já existir).
ALTER TABLE public.receivables DROP CONSTRAINT IF EXISTS receivables_source_check;
ALTER TABLE public.receivables ADD CONSTRAINT receivables_source_check
  CHECK (source = ANY (ARRAY['contrato','asaas','manual','pedido','pdv','contaazul','nota_fiscal']));

CREATE OR REPLACE FUNCTION public.gerar_receivable_da_nota()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM 'authorized' THEN RETURN NEW; END IF;
  IF COALESCE(NEW.total, 0) <= 0 THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM receivables WHERE invoice_id = NEW.id) THEN RETURN NEW; END IF;
  IF NEW.sales_order_id IS NOT NULL THEN
    UPDATE receivables SET invoice_id = NEW.id, updated_at = now()
     WHERE sales_order_id = NEW.sales_order_id AND invoice_id IS NULL AND company_id = NEW.company_id;
    IF FOUND THEN RETURN NEW; END IF;
  END IF;
  INSERT INTO receivables (company_id, contact_id, invoice_id, sales_order_id, description, amount, due_date, status, source)
  VALUES (NEW.company_id, NEW.contact_id, NEW.id, NEW.sales_order_id,
          'Nota fiscal (' || COALESCE(NEW.type,'nf') || ') nº ' || COALESCE(NEW.number,'?'),
          NEW.total, COALESCE(NEW.issue_date, CURRENT_DATE), 'a_receber', 'nota_fiscal');
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_receivable_from_invoice ON public.invoices;
CREATE TRIGGER trg_receivable_from_invoice
  AFTER INSERT OR UPDATE OF status ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.gerar_receivable_da_nota();

REVOKE EXECUTE ON FUNCTION public.gerar_receivable_da_nota() FROM PUBLIC, anon, authenticated;
