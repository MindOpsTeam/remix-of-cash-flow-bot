-- Motor de Recorrência & Recompra (somente leitura — NÃO toca a régua do DRE).
--
-- Duas frentes:
--  1) v_mrr_movimentos: saúde da receita recorrente (contratos) mês a mês —
--     MRR ativo, novo e perdido (churn). Base do painel de MRR.
--  2) v_recompra_clientes: cadência de recompra dos clientes que compram
--     avulso (sales_orders). Descobre o intervalo típico entre compras, a
--     próxima compra esperada e classifica em em_dia / previsto / atrasado /
--     perdido — o funil de recompra que transforma venda pontual em receita
--     previsível.
--
-- security_invoker: a RLS de quem consulta vale (is_company_member), como nas
-- demais views do painel.

-- ── MRR mês a mês (contratos) ──────────────────────────────────────────────
CREATE OR REPLACE VIEW public.v_mrr_movimentos
WITH (security_invoker = true) AS
WITH meses AS (
  SELECT cs.company_id,
         (date_trunc('month', current_date) - (n || ' months')::interval)::date AS mes
  FROM (SELECT DISTINCT company_id FROM public.contracts) cs
  CROSS JOIN generate_series(0, 11) AS n
),
ct AS (
  SELECT company_id, start_date, end_date, status,
    amount * CASE cycle
      WHEN 'WEEKLY' THEN 52.0/12 WHEN 'BIWEEKLY' THEN 26.0/12 WHEN 'MONTHLY' THEN 1
      WHEN 'BIMONTHLY' THEN 0.5 WHEN 'QUARTERLY' THEN 1.0/3 WHEN 'SEMIANNUALLY' THEN 1.0/6
      WHEN 'YEARLY' THEN 1.0/12 ELSE 1 END AS mrr
  FROM public.contracts
)
SELECT
  m.company_id,
  m.mes,
  round(coalesce(sum(ct.mrr) FILTER (
    WHERE ct.start_date <= (m.mes + interval '1 month' - interval '1 day')::date
      AND (ct.end_date IS NULL OR ct.end_date >= m.mes)
  ), 0), 2) AS mrr_ativo,
  round(coalesce(sum(ct.mrr) FILTER (
    WHERE date_trunc('month', ct.start_date)::date = m.mes
  ), 0), 2) AS mrr_novo,
  round(coalesce(sum(ct.mrr) FILTER (
    WHERE ct.end_date IS NOT NULL AND date_trunc('month', ct.end_date)::date = m.mes
  ), 0), 2) AS mrr_perdido,
  count(*) FILTER (WHERE date_trunc('month', ct.start_date)::date = m.mes) AS contratos_novos,
  count(*) FILTER (WHERE ct.end_date IS NOT NULL AND date_trunc('month', ct.end_date)::date = m.mes) AS contratos_perdidos
FROM meses m
LEFT JOIN ct ON ct.company_id = m.company_id
GROUP BY m.company_id, m.mes
ORDER BY m.mes;

-- ── Cadência de recompra (vendas avulsas) ──────────────────────────────────
CREATE OR REPLACE VIEW public.v_recompra_clientes
WITH (security_invoker = true) AS
SELECT
  base.*,
  CASE
    WHEN base.n_compras < 2 OR base.intervalo_medio_dias IS NULL OR base.intervalo_medio_dias <= 0 THEN 'novo'
    WHEN base.dias_desde_ultima::numeric / base.intervalo_medio_dias < 0.8 THEN 'em_dia'
    WHEN base.dias_desde_ultima::numeric / base.intervalo_medio_dias < 1.25 THEN 'previsto'
    WHEN base.dias_desde_ultima::numeric / base.intervalo_medio_dias < 2 THEN 'atrasado'
    ELSE 'perdido'
  END AS status
FROM (
  SELECT
    c.id AS contact_id,
    c.company_id,
    c.name,
    c.whatsapp,
    o.n_compras,
    o.primeira_compra,
    o.ultima_compra,
    round(o.total_gasto, 2) AS total_gasto,
    CASE WHEN o.n_compras > 0 THEN round(o.total_gasto / o.n_compras, 2) END AS ticket_medio,
    CASE WHEN o.n_compras >= 2
      THEN round((o.ultima_compra - o.primeira_compra)::numeric / (o.n_compras - 1))::int END AS intervalo_medio_dias,
    (current_date - o.ultima_compra) AS dias_desde_ultima,
    CASE WHEN o.n_compras >= 2
      THEN o.ultima_compra + round((o.ultima_compra - o.primeira_compra)::numeric / (o.n_compras - 1))::int END AS proxima_esperada,
    EXISTS (
      SELECT 1 FROM public.contracts k
      WHERE k.contact_id = c.id AND k.status = 'active'
    ) AS tem_contrato
  FROM public.contacts c
  JOIN LATERAL (
    SELECT count(*) AS n_compras,
           min(so.issue_date) AS primeira_compra,
           max(so.issue_date) AS ultima_compra,
           coalesce(sum(so.total), 0) AS total_gasto
    FROM public.sales_orders so
    WHERE so.contact_id = c.id AND so.status <> 'cancelled'
  ) o ON o.n_compras > 0
  WHERE c.active = true
) base;
