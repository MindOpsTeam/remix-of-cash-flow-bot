
-- Add invoice_id to tax_guides for traceability
ALTER TABLE public.tax_guides ADD COLUMN invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL;

-- Create idempotent trigger: when an invoice is created with type nfse/nfe and status authorized,
-- auto-create a tax_guide for ISS (5% default for services)
CREATE OR REPLACE FUNCTION public.auto_tax_guide_from_invoice()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only for authorized invoices
  IF NEW.status <> 'authorized' THEN RETURN NEW; END IF;
  -- Only on insert or when status changes to authorized
  IF TG_OP = 'UPDATE' AND OLD.status = 'authorized' THEN RETURN NEW; END IF;

  -- Idempotent: skip if guide already exists for this invoice
  IF EXISTS (SELECT 1 FROM public.tax_guides WHERE invoice_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  -- Create ISS guide for NFS-e
  IF NEW.type IN ('nfse', 'nfe') THEN
    INSERT INTO public.tax_guides (company_id, tipo, competencia, vencimento, valor, status, source, invoice_id)
    VALUES (
      NEW.company_id,
      CASE WHEN NEW.type = 'nfse' THEN 'ISS' ELSE 'ICMS' END,
      to_char(NEW.issue_date, 'MM/YYYY'),
      (date_trunc('month', NEW.issue_date) + interval '1 month' + interval '14 days')::date,
      ROUND(NEW.total * 0.05, 2),
      'a_pagar',
      'nf',
      NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_tax_guide_from_invoice
  AFTER INSERT OR UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.auto_tax_guide_from_invoice();
