-- Correção de modelagem (revisão 2026-08-12): fecha os furos que impediam o
-- resultado de "bater":
--   1. Recebível nascia vencido (due_date = data de emissão) e sem conta contábil.
--   2. Conta a pagar não tinha conta contábil → despesa caía em "Sem conta".
--   3. Cancelar a nota não estornava o recebível já aberto.
-- A dupla contagem do OCR (nota gerando título + transação de caixa) foi corrigida
-- no front (useDocumentScanner): título não gera mais transação de receita/despesa;
-- a transação nasce só na baixa (conciliação). Ver docs/REVISAO-BURACOS-2026-08-12.md.

-- ── 1. Prazo de recebimento configurável por empresa (default 30 dias) ──────────
ALTER TABLE public.nfse_config
  ADD COLUMN IF NOT EXISTS prazo_recebimento_dias integer NOT NULL DEFAULT 30;

-- ── 2. Conta a pagar ganha conta contábil ───────────────────────────────────────
ALTER TABLE public.bills_payable
  ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL;

-- Preenche a conta de despesa padrão (4.1 Custo de Mercadoria/Serviço) sempre que
-- a conta a pagar entrar sem classificação. Centraliza a regra: cobre OCR, nota de
-- entrada (to_bill) e lançamento manual, independentemente de quem inseriu.
CREATE OR REPLACE FUNCTION public.default_account_bill()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.account_id IS NULL THEN
    SELECT id INTO NEW.account_id
      FROM chart_of_accounts
     WHERE company_id = NEW.company_id AND type = 'expense'
     ORDER BY (code = '4.1') DESC, code
     LIMIT 1;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_default_account_bill ON public.bills_payable;
CREATE TRIGGER trg_default_account_bill
  BEFORE INSERT ON public.bills_payable
  FOR EACH ROW EXECUTE FUNCTION public.default_account_bill();

REVOKE EXECUTE ON FUNCTION public.default_account_bill() FROM PUBLIC, anon, authenticated;

-- Retroativo: contas a pagar ainda em aberto passam a carregar a conta de despesa,
-- para que ao serem baixadas a despesa apareça no lugar certo do DRE.
UPDATE public.bills_payable b
   SET account_id = (
        SELECT id FROM chart_of_accounts
         WHERE company_id = b.company_id AND type = 'expense'
         ORDER BY (code = '4.1') DESC, code LIMIT 1)
 WHERE b.account_id IS NULL
   AND b.status IN ('a_vencer','vencido');

-- ── 3. Recebível da nota: prazo real + conta de receita ─────────────────────────
CREATE OR REPLACE FUNCTION public.gerar_receivable_da_nota()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_prazo   integer;
  v_due     date;
  v_account uuid;
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

  -- Nota vinculada a pedido: aproveita o recebível do pedido (mantém o vencimento
  -- combinado na venda) e só completa a conta contábil se estiver faltando.
  IF NEW.sales_order_id IS NOT NULL THEN
    UPDATE receivables
       SET invoice_id = NEW.id,
           account_id = COALESCE(account_id, v_account),
           updated_at = now()
     WHERE sales_order_id = NEW.sales_order_id AND invoice_id IS NULL AND company_id = NEW.company_id;
    IF FOUND THEN RETURN NEW; END IF;
  END IF;

  -- Nota avulsa: vencimento = emissão + prazo (nunca nasce vencida à vista).
  v_prazo := COALESCE((SELECT prazo_recebimento_dias FROM nfse_config WHERE company_id = NEW.company_id), 30);
  v_due   := COALESCE(NEW.issue_date, CURRENT_DATE) + (v_prazo || ' days')::interval;

  INSERT INTO receivables (company_id, contact_id, invoice_id, sales_order_id, account_id,
                           description, amount, due_date, status, source)
  VALUES (NEW.company_id, NEW.contact_id, NEW.id, NEW.sales_order_id, v_account,
          'Nota fiscal (' || COALESCE(NEW.type,'nf') || ') nº ' || COALESCE(NEW.number,'?'),
          NEW.total, v_due, 'a_receber', 'nota_fiscal');
  RETURN NEW;
END; $$;

REVOKE EXECUTE ON FUNCTION public.gerar_receivable_da_nota() FROM PUBLIC, anon, authenticated;

-- ── 4. Cancelamento da nota estorna o recebível ─────────────────────────────────
-- Nota cancelada não gera direito de cobrança. Estorna só recebíveis ainda em
-- aberto (a_receber/vencido) e não baixados; se já foi recebido, exige estorno
-- manual (o dinheiro entrou) e é deixado como está de propósito.
CREATE OR REPLACE FUNCTION public.estornar_receivable_nota_cancelada()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status = 'cancelled' AND NEW.status IS DISTINCT FROM OLD.status THEN
    UPDATE receivables
       SET status = 'cancelado', updated_at = now()
     WHERE invoice_id = NEW.id
       AND status IN ('a_receber','vencido')
       AND transaction_id IS NULL;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_estorno_receivable_nota ON public.invoices;
CREATE TRIGGER trg_estorno_receivable_nota
  AFTER UPDATE OF status ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.estornar_receivable_nota_cancelada();

REVOKE EXECUTE ON FUNCTION public.estornar_receivable_nota_cancelada() FROM PUBLIC, anon, authenticated;
