-- F3: consolidação multi-CNPJ nível grupo.
-- (a) Plano de contas do grupo: mapeamento aditivo por conta (group_code/name)
--     — permite consolidar DRE mesmo com planos divergentes entre CNPJs.
-- (b) Intercompany: transações entre empresas do grupo são marcadas e
--     ELIMINADAS da visão consolidada (v_company_margin) — não inflam
--     receita/despesa combinada. A visão individual por CNPJ segue completa
--     via v_company_margin_full.
-- Aditiva e idempotente.

ALTER TABLE public.chart_of_accounts
  ADD COLUMN IF NOT EXISTS group_code text,
  ADD COLUMN IF NOT EXISTS group_name text;

CREATE INDEX IF NOT EXISTS chart_of_accounts_group_code
  ON public.chart_of_accounts (group_code) WHERE group_code IS NOT NULL;

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS is_intercompany boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS counterparty_company_id uuid REFERENCES public.companies(id);

COMMENT ON COLUMN public.transactions.is_intercompany IS
  'Transação entre empresas do mesmo grupo (transferência, rateio, mútuo) — eliminada da consolidação';

-- Visão consolidada (padrão do BI): exclui intercompany
CREATE OR REPLACE VIEW public.v_company_margin
WITH (security_invoker = true) AS
SELECT t.company_id,
  date_trunc('month', t.date::timestamp with time zone)::date AS month,
  COALESCE(sum(t.amount) FILTER (WHERE t.type = 'revenue'), 0::numeric) AS receita,
  COALESCE(sum(t.amount) FILTER (WHERE t.type = 'expense' AND left(COALESCE(coa.code, ''), 1) = '4'), 0::numeric) AS custos,
  COALESCE(sum(t.amount) FILTER (WHERE t.type = 'expense' AND left(COALESCE(coa.code, ''), 1) <> '4'), 0::numeric) AS despesas
FROM transactions t
LEFT JOIN chart_of_accounts coa ON coa.id = t.account_id
WHERE t.status = 'confirmed'
  AND t.is_intercompany = false
GROUP BY t.company_id, date_trunc('month', t.date::timestamp with time zone);

-- Visão completa (inclui intercompany) para conferência por CNPJ
CREATE OR REPLACE VIEW public.v_company_margin_full
WITH (security_invoker = true) AS
SELECT t.company_id,
  date_trunc('month', t.date::timestamp with time zone)::date AS month,
  COALESCE(sum(t.amount) FILTER (WHERE t.type = 'revenue'), 0::numeric) AS receita,
  COALESCE(sum(t.amount) FILTER (WHERE t.type = 'expense' AND left(COALESCE(coa.code, ''), 1) = '4'), 0::numeric) AS custos,
  COALESCE(sum(t.amount) FILTER (WHERE t.type = 'expense' AND left(COALESCE(coa.code, ''), 1) <> '4'), 0::numeric) AS despesas
FROM transactions t
LEFT JOIN chart_of_accounts coa ON coa.id = t.account_id
WHERE t.status = 'confirmed'
GROUP BY t.company_id, date_trunc('month', t.date::timestamp with time zone);

-- Consolidação por conta do grupo (DRE consolidada)
CREATE OR REPLACE VIEW public.v_group_account_totals
WITH (security_invoker = true) AS
SELECT
  t.company_id,
  date_trunc('month', t.date::timestamp with time zone)::date AS month,
  COALESCE(coa.group_code, coa.code, 'sem-conta') AS group_code,
  COALESCE(coa.group_name, coa.name, 'Sem conta contábil') AS group_name,
  t.type,
  sum(t.amount) AS total
FROM transactions t
LEFT JOIN chart_of_accounts coa ON coa.id = t.account_id
WHERE t.status = 'confirmed'
  AND t.is_intercompany = false
GROUP BY t.company_id, date_trunc('month', t.date::timestamp with time zone),
  COALESCE(coa.group_code, coa.code, 'sem-conta'),
  COALESCE(coa.group_name, coa.name, 'Sem conta contábil'),
  t.type;
