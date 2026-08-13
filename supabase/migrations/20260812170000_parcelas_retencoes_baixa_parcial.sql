-- Resíduo da revisão (2026-08-12): fecha três furos de modelagem que o primeiro
-- passe deixou como plano:
--   (1/Estr-C3) recebível pelo BRUTO e em parcela única — ignora retenções (ISS
--       retido → depósito líquido ≠ recebível) e o parcelamento da nota (<dup>).
--   (5/Estr-A4) nota de entrada vira UMA conta a pagar em emissão+30 fixo, em vez
--       das N duplicatas nas datas reais do XML.
--   (3/Estr-A2) baixa é tudo-ou-nada: um crédito parcial não podia liquidar parte
--       do título deixando saldo.

-- ── 0. Carimbo de conciliação (o código do settle já o referenciava sem existir:
--        o UPDATE falhava calado e a transação não virava 'reconciled') ───────────
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS reconciled_at timestamptz;

-- ── 1. Nota carrega líquido, retenções e o cronograma de duplicatas ─────────────
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS valor_liquido   numeric,
  ADD COLUMN IF NOT EXISTS valor_retencoes numeric,
  ADD COLUMN IF NOT EXISTS duplicatas      jsonb;

ALTER TABLE public.inbound_documents
  ADD COLUMN IF NOT EXISTS duplicatas      jsonb,
  ADD COLUMN IF NOT EXISTS valor_retencoes numeric;

-- ── 2. Saldo baixado por título (suporta recebimento/pagamento parcial) ─────────
ALTER TABLE public.receivables
  ADD COLUMN IF NOT EXISTS valor_baixado numeric NOT NULL DEFAULT 0;
ALTER TABLE public.bills_payable
  ADD COLUMN IF NOT EXISTS valor_baixado numeric NOT NULL DEFAULT 0;

-- Evita recibos duplicados por parcela quando o trigger reprocessa a mesma nota.
CREATE UNIQUE INDEX IF NOT EXISTS receivables_invoice_parcela_uq
  ON public.receivables (invoice_id, parcela) WHERE invoice_id IS NOT NULL AND parcela IS NOT NULL;

-- ── 3. Livro-razão de baixas parciais (uma linha por pagamento aplicado) ─────────
-- Guarda cada crédito/débito real que abateu um título. Permite N pagamentos por
-- título e trava o reuso da mesma transação em dois títulos.
CREATE TABLE IF NOT EXISTS public.title_payments (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  title_kind     text NOT NULL CHECK (title_kind IN ('receivable','bill')),
  title_id       uuid NOT NULL,
  transaction_id uuid NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  amount         numeric NOT NULL CHECK (amount > 0),
  paid_at        date NOT NULL DEFAULT CURRENT_DATE,
  created_at     timestamptz NOT NULL DEFAULT now()
);
-- Uma transação do extrato só pode abater um título (não some em dois lugares).
CREATE UNIQUE INDEX IF NOT EXISTS title_payments_tx_uq ON public.title_payments (transaction_id);
CREATE INDEX IF NOT EXISTS title_payments_title_idx ON public.title_payments (title_kind, title_id);

ALTER TABLE public.title_payments ENABLE ROW LEVEL SECURITY;
-- Leitura só para membros da empresa; escrita só pelo service_role (edges de baixa).
DROP POLICY IF EXISTS title_payments_select ON public.title_payments;
CREATE POLICY title_payments_select ON public.title_payments
  FOR SELECT USING (public.is_company_member(company_id));

-- ── 4. Recebível da nota: líquido + parcelamento por duplicatas ──────────────────
CREATE OR REPLACE FUNCTION public.gerar_receivable_da_nota()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_prazo   integer;
  v_account uuid;
  v_liquido numeric;
  v_ndup    integer;
  v_i       integer := 0;
  v_dup     jsonb;
  v_venc    date;
  v_val     numeric;
BEGIN
  IF NEW.status IS DISTINCT FROM 'authorized' THEN RETURN NEW; END IF;
  IF COALESCE(NEW.total, 0) <= 0 THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM receivables WHERE invoice_id = NEW.id) THEN RETURN NEW; END IF;

  -- Conta de receita: serviço (3.1) para NFS-e, produto (3.2) caso contrário.
  SELECT id INTO v_account
    FROM chart_of_accounts
   WHERE company_id = NEW.company_id AND type = 'revenue'
   ORDER BY (code = CASE WHEN NEW.type = 'nfse' THEN '3.1' ELSE '3.2' END) DESC, code
   LIMIT 1;

  -- Nota de pedido: aproveita os recebíveis já gerados na venda.
  IF NEW.sales_order_id IS NOT NULL THEN
    UPDATE receivables
       SET invoice_id = NEW.id,
           account_id = COALESCE(account_id, v_account),
           updated_at = now()
     WHERE sales_order_id = NEW.sales_order_id AND invoice_id IS NULL AND company_id = NEW.company_id;
    IF FOUND THEN RETURN NEW; END IF;
  END IF;

  v_prazo   := COALESCE((SELECT prazo_recebimento_dias FROM nfse_config WHERE company_id = NEW.company_id), 30);
  -- Recebível reflete o que entra no caixa: líquido de retenções quando informado.
  v_liquido := COALESCE(NEW.valor_liquido, NEW.total);

  -- Nota parcelada (duplicatas do XML): gera uma parcela por <dup>, nas datas reais.
  IF jsonb_typeof(NEW.duplicatas) = 'array' AND jsonb_array_length(NEW.duplicatas) > 0 THEN
    v_ndup := jsonb_array_length(NEW.duplicatas);
    FOR v_dup IN SELECT * FROM jsonb_array_elements(NEW.duplicatas) LOOP
      v_i   := v_i + 1;
      v_venc := COALESCE(NULLIF(v_dup->>'vencimento','')::date,
                         COALESCE(NEW.issue_date, CURRENT_DATE) + (v_prazo || ' days')::interval);
      v_val  := COALESCE(NULLIF(v_dup->>'valor','')::numeric, v_liquido / v_ndup);
      INSERT INTO receivables (company_id, contact_id, invoice_id, sales_order_id, account_id,
                               description, amount, due_date, status, source, parcela, parcelas_total)
      VALUES (NEW.company_id, NEW.contact_id, NEW.id, NEW.sales_order_id, v_account,
              'Nota fiscal (' || COALESCE(NEW.type,'nf') || ') nº ' || COALESCE(NEW.number,'?')
                || ' — parcela ' || v_i || '/' || v_ndup,
              v_val, v_venc, 'a_receber', 'nota_fiscal', v_i, v_ndup);
    END LOOP;
    RETURN NEW;
  END IF;

  -- Nota à vista/prazo em parcela única, pelo líquido.
  INSERT INTO receivables (company_id, contact_id, invoice_id, sales_order_id, account_id,
                           description, amount, due_date, status, source)
  VALUES (NEW.company_id, NEW.contact_id, NEW.id, NEW.sales_order_id, v_account,
          'Nota fiscal (' || COALESCE(NEW.type,'nf') || ') nº ' || COALESCE(NEW.number,'?'),
          v_liquido, COALESCE(NEW.issue_date, CURRENT_DATE) + (v_prazo || ' days')::interval,
          'a_receber', 'nota_fiscal');
  RETURN NEW;
END; $$;

REVOKE EXECUTE ON FUNCTION public.gerar_receivable_da_nota() FROM PUBLIC, anon, authenticated;

-- ── 5. Baixa (total ou parcial) atômica de um título ────────────────────────────
-- Aplica um crédito/débito real do extrato a um recebível/conta a pagar de forma
-- atômica: trava a linha do título (FOR UPDATE), registra o pagamento no razão
-- (unique(transaction_id) impede reusar a mesma transação em dois títulos),
-- soma no saldo baixado e quita quando o saldo zera. A transação vira `reconciled`
-- e herda a conta contábil do título. Chamado só pelas edges (service_role).
CREATE OR REPLACE FUNCTION public.aplicar_baixa_titulo(
  p_kind text, p_title_id uuid, p_tx_id uuid, p_amount numeric, p_paid_at date
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_company  uuid;
  v_total    numeric;
  v_baixado  numeric;
  v_account  uuid;
  v_restante numeric;
  v_aplicar  numeric;
  v_novo     numeric;
  v_quitado  boolean;
  v_tol      numeric;
BEGIN
  IF p_kind = 'receivable' THEN
    SELECT company_id, amount, COALESCE(valor_baixado,0), account_id
      INTO v_company, v_total, v_baixado, v_account
      FROM receivables WHERE id = p_title_id FOR UPDATE;
  ELSIF p_kind = 'bill' THEN
    SELECT company_id, valor, COALESCE(valor_baixado,0), account_id
      INTO v_company, v_total, v_baixado, v_account
      FROM bills_payable WHERE id = p_title_id FOR UPDATE;
  ELSE
    RETURN jsonb_build_object('status','error','erro','kind invalido');
  END IF;

  IF v_company IS NULL THEN RETURN jsonb_build_object('status','not_found'); END IF;

  v_tol      := greatest(v_total * 0.02, 0.01);
  v_restante := greatest(0, v_total - v_baixado);
  IF v_restante <= 0 THEN RETURN jsonb_build_object('status','already_settled'); END IF;
  IF p_amount > v_restante + v_tol THEN
    RETURN jsonb_build_object('status','overpay','saldo', v_restante);
  END IF;
  v_aplicar := least(p_amount, v_restante);

  BEGIN
    INSERT INTO title_payments (company_id, title_kind, title_id, transaction_id, amount, paid_at)
    VALUES (v_company, p_kind, p_title_id, p_tx_id, v_aplicar, COALESCE(p_paid_at, CURRENT_DATE));
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('status','tx_reused');
  END;

  v_novo    := v_baixado + v_aplicar;
  v_quitado := v_novo >= v_total - v_tol;

  UPDATE transactions
     SET status = 'reconciled', reconciled_at = now(), account_id = COALESCE(account_id, v_account)
   WHERE id = p_tx_id;

  IF p_kind = 'receivable' THEN
    UPDATE receivables
       SET valor_baixado  = v_novo,
           status         = CASE WHEN v_quitado THEN 'recebido' ELSE status END,
           transaction_id = CASE WHEN v_quitado THEN p_tx_id ELSE transaction_id END,
           payment_date   = CASE WHEN v_quitado THEN COALESCE(p_paid_at, CURRENT_DATE) ELSE payment_date END,
           updated_at     = now()
     WHERE id = p_title_id;
  ELSE
    UPDATE bills_payable
       SET valor_baixado  = v_novo,
           status         = CASE WHEN v_quitado THEN 'pago' ELSE status END,
           transaction_id = CASE WHEN v_quitado THEN p_tx_id ELSE transaction_id END,
           payment_date   = CASE WHEN v_quitado THEN COALESCE(p_paid_at, CURRENT_DATE) ELSE payment_date END,
           updated_at     = now()
     WHERE id = p_title_id;
  END IF;

  RETURN jsonb_build_object(
    'status',  CASE WHEN v_quitado THEN 'settled' ELSE 'partial' END,
    'aplicado', v_aplicar,
    'saldo',    greatest(0, v_total - v_novo));
END; $$;

REVOKE EXECUTE ON FUNCTION public.aplicar_baixa_titulo(text,uuid,uuid,numeric,date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.aplicar_baixa_titulo(text,uuid,uuid,numeric,date) TO service_role;
