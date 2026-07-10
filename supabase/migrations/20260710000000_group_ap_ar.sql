-- Hub consolidado AP/AR (benchmark Intuit Enterprise Suite):
-- posição de contas a pagar (bills_payable) e a receber (company_asaas_payments)
-- por empresa, para o dashboard consolidado multi-CNPJ.
-- Aditiva e idempotente.

CREATE OR REPLACE VIEW public.v_group_ap_ar
WITH (security_invoker = true) AS
SELECT
  c.id AS company_id,
  -- A pagar (exclui pagas e rejeitadas)
  COALESCE((
    SELECT sum(b.valor) FROM public.bills_payable b
    WHERE b.company_id = c.id AND b.status <> 'pago'
      AND COALESCE(b.approval_status, 'approved') <> 'rejected'
      AND b.vencimento >= CURRENT_DATE
  ), 0) AS ap_a_vencer,
  COALESCE((
    SELECT sum(b.valor) FROM public.bills_payable b
    WHERE b.company_id = c.id AND b.status <> 'pago'
      AND COALESCE(b.approval_status, 'approved') <> 'rejected'
      AND b.vencimento < CURRENT_DATE
  ), 0) AS ap_vencido,
  -- A receber (cobranças Asaas em aberto)
  COALESCE((
    SELECT sum(p.value) FROM public.company_asaas_payments p
    WHERE p.company_id = c.id AND p.status = 'PENDING'
  ), 0) AS ar_a_vencer,
  COALESCE((
    SELECT sum(p.value) FROM public.company_asaas_payments p
    WHERE p.company_id = c.id AND p.status = 'OVERDUE'
  ), 0) AS ar_vencido
FROM public.companies c;
