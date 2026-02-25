
-- ===========================================
-- FASE 1: Views + Colunas source/source_id + Realtime
-- ===========================================

-- 1. Adicionar colunas source e source_id em personal_transactions
ALTER TABLE public.personal_transactions
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS source_id text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_personal_tx_source_unique
  ON public.personal_transactions(user_id, source, source_id)
  WHERE source_id IS NOT NULL;

-- 2. View: v_personal_kpis (KPIs do mês atual)
CREATE OR REPLACE VIEW public.v_personal_kpis AS
SELECT
  pt.user_id,
  COALESCE(SUM(CASE WHEN pt.type = 'receita' THEN pt.amount ELSE 0 END), 0) AS entradas_mes,
  COALESCE(SUM(CASE WHEN pt.type = 'despesa' THEN pt.amount ELSE 0 END), 0) AS saidas_mes,
  COALESCE(SUM(CASE WHEN pt.type = 'receita' THEN pt.amount ELSE 0 END), 0)
    - COALESCE(SUM(CASE WHEN pt.type = 'despesa' THEN pt.amount ELSE 0 END), 0) AS saldo_mes,
  -- Taxas do Asaas no mês (value - net_value)
  COALESCE((
    SELECT SUM(ap.value - COALESCE(ap.net_value, ap.value))
    FROM public.asaas_payments ap
    WHERE ap.user_id = pt.user_id
      AND ap.payment_date >= date_trunc('month', CURRENT_DATE)
      AND ap.payment_date < date_trunc('month', CURRENT_DATE) + interval '1 month'
      AND ap.status IN ('RECEIVED', 'CONFIRMED')
  ), 0) AS taxas_mes,
  -- Cobranças vencidas
  COALESCE((
    SELECT SUM(ap2.value)
    FROM public.asaas_payments ap2
    WHERE ap2.user_id = pt.user_id
      AND ap2.status = 'OVERDUE'
  ), 0) AS vencidas,
  COALESCE((
    SELECT COUNT(*)
    FROM public.asaas_payments ap3
    WHERE ap3.user_id = pt.user_id
      AND ap3.status = 'OVERDUE'
  ), 0) AS vencidas_count
FROM public.personal_transactions pt
WHERE pt.date >= date_trunc('month', CURRENT_DATE)
  AND pt.date < date_trunc('month', CURRENT_DATE) + interval '1 month'
GROUP BY pt.user_id;

-- 3. View: v_personal_month_compare (comparativo mês atual vs anterior)
CREATE OR REPLACE VIEW public.v_personal_month_compare AS
SELECT
  user_id,
  -- Mês atual
  COALESCE(SUM(CASE WHEN date >= date_trunc('month', CURRENT_DATE)
    AND type = 'receita' THEN amount ELSE 0 END), 0) AS receita_atual,
  COALESCE(SUM(CASE WHEN date >= date_trunc('month', CURRENT_DATE)
    AND type = 'despesa' THEN amount ELSE 0 END), 0) AS despesa_atual,
  -- Mês anterior
  COALESCE(SUM(CASE WHEN date >= date_trunc('month', CURRENT_DATE) - interval '1 month'
    AND date < date_trunc('month', CURRENT_DATE)
    AND type = 'receita' THEN amount ELSE 0 END), 0) AS receita_anterior,
  COALESCE(SUM(CASE WHEN date >= date_trunc('month', CURRENT_DATE) - interval '1 month'
    AND date < date_trunc('month', CURRENT_DATE)
    AND type = 'despesa' THEN amount ELSE 0 END), 0) AS despesa_anterior
FROM public.personal_transactions
WHERE date >= date_trunc('month', CURRENT_DATE) - interval '1 month'
  AND date < date_trunc('month', CURRENT_DATE) + interval '1 month'
GROUP BY user_id;

-- 4. Habilitar realtime na tabela asaas_webhook_events
ALTER PUBLICATION supabase_realtime ADD TABLE public.asaas_webhook_events;
