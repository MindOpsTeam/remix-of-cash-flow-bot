-- Correções da revisão adversarial (técnica + estratégica) da solução fiscal.
-- H5/C1: recebível só para venda a prazo (NFC-e à vista e pedido já faturado não geram).
CREATE OR REPLACE FUNCTION public.gerar_receivable_da_nota()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM 'authorized' THEN RETURN NEW; END IF;
  IF COALESCE(NEW.total, 0) <= 0 THEN RETURN NEW; END IF;
  IF NEW.type IN ('nfce', 'cupom', 'sat') THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM receivables WHERE invoice_id = NEW.id) THEN RETURN NEW; END IF;
  IF NEW.sales_order_id IS NOT NULL THEN
    UPDATE receivables SET invoice_id = NEW.id, updated_at = now()
     WHERE sales_order_id = NEW.sales_order_id AND invoice_id IS NULL AND company_id = NEW.company_id;
    IF FOUND THEN RETURN NEW; END IF;
    IF EXISTS (SELECT 1 FROM receivables WHERE sales_order_id = NEW.sales_order_id AND company_id = NEW.company_id) THEN RETURN NEW; END IF;
  END IF;
  INSERT INTO receivables (company_id, contact_id, invoice_id, sales_order_id, description, amount, due_date, status, source)
  VALUES (NEW.company_id, NEW.contact_id, NEW.id, NEW.sales_order_id,
          'Nota fiscal (' || COALESCE(NEW.type,'nf') || ') nº ' || COALESCE(NEW.number,'?'),
          NEW.total, COALESCE(NEW.issue_date, CURRENT_DATE), 'a_receber', 'nota_fiscal');
  RETURN NEW;
END; $$;

-- H4/C2: unicidade por chave de acesso evita nota duplicada (import XML/OCR/emissão).
CREATE UNIQUE INDEX IF NOT EXISTS invoices_company_chave_uidx
  ON public.invoices(company_id, chave_acesso) WHERE chave_acesso IS NOT NULL;

-- M1: consolidação de grupo passa a contar transações conciliadas (Open Finance).
CREATE OR REPLACE VIEW public.v_group_account_totals AS
 SELECT t.company_id,
    date_trunc('month'::text, t.date::timestamp with time zone)::date AS month,
    COALESCE(coa.group_code, coa.code, 'sem-conta'::text) AS group_code,
    COALESCE(coa.group_name, coa.name, 'Sem conta contábil'::text) AS group_name,
    t.type,
    sum(t.amount) AS total
   FROM transactions t
     LEFT JOIN chart_of_accounts coa ON coa.id = t.account_id
  WHERE t.status = ANY (ARRAY['confirmed'::text, 'reconciled'::text]) AND t.is_intercompany = false
  GROUP BY t.company_id, (date_trunc('month'::text, t.date::timestamp with time zone)), (COALESCE(coa.group_code, coa.code, 'sem-conta'::text)), (COALESCE(coa.group_name, coa.name, 'Sem conta contábil'::text)), t.type;
