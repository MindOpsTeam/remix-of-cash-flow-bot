-- Bomba armada, achada pela lente de controladoria.
--
-- reconcile-transactions grava status = 'reconciled' no lançamento conciliado.
-- A régua do DRE, das views de margem, do realizado do orçamento, da
-- consolidação de grupo e da API pública filtra status = 'confirmed'.
--
-- Resultado: CONCILIAR UM LANÇAMENTO O APAGAVA DO RESULTADO.
--
-- Ninguém foi mordido ainda porque a conciliação praticamente não roda (zero
-- lançamentos conciliados em produção). No dia em que o Open Finance entrar em
-- uso, o faturamento do cliente cairia na tela dele conforme os lançamentos
-- fossem conciliados, que é justamente o argumento de venda do produto.
--
-- As duas views passam a aceitar os dois status. src/pages/DRE.tsx foi
-- corrigido junto, no mesmo commit, porque a régua vive nos dois lugares.

CREATE OR REPLACE VIEW public.v_company_margin
WITH (security_invoker = on) AS
 SELECT t.company_id,
    date_trunc('month'::text, t.date::timestamp with time zone)::date AS month,
    COALESCE(sum(t.amount) FILTER (WHERE t.type = 'revenue'::text), 0::numeric) AS receita,
    COALESCE(sum(t.amount) FILTER (WHERE t.type = 'expense'::text AND "left"(COALESCE(coa.code, ''::text), 1) = '4'::text), 0::numeric) AS custos,
    COALESCE(sum(t.amount) FILTER (WHERE t.type = 'expense'::text AND "left"(COALESCE(coa.code, ''::text), 1) <> '4'::text), 0::numeric) AS despesas
   FROM transactions t
     LEFT JOIN chart_of_accounts coa ON coa.id = t.account_id
  WHERE t.status = ANY (ARRAY['confirmed'::text, 'reconciled'::text])
    AND t.is_intercompany = false
  GROUP BY t.company_id, (date_trunc('month'::text, t.date::timestamp with time zone));

CREATE OR REPLACE VIEW public.v_company_margin_full
WITH (security_invoker = on) AS
 SELECT t.company_id,
    date_trunc('month'::text, t.date::timestamp with time zone)::date AS month,
    COALESCE(sum(t.amount) FILTER (WHERE t.type = 'revenue'::text), 0::numeric) AS receita,
    COALESCE(sum(t.amount) FILTER (WHERE t.type = 'expense'::text AND "left"(COALESCE(coa.code, ''::text), 1) = '4'::text), 0::numeric) AS custos,
    COALESCE(sum(t.amount) FILTER (WHERE t.type = 'expense'::text AND "left"(COALESCE(coa.code, ''::text), 1) <> '4'::text), 0::numeric) AS despesas
   FROM transactions t
     LEFT JOIN chart_of_accounts coa ON coa.id = t.account_id
  WHERE t.status = ANY (ARRAY['confirmed'::text, 'reconciled'::text])
  GROUP BY t.company_id, (date_trunc('month'::text, t.date::timestamp with time zone));

-- Toda tela de resultado filtra por empresa, status e data. Com 34 lançamentos
-- ninguém sente; com um cliente real a 50 mil por ano, vira varredura.
CREATE INDEX IF NOT EXISTS transactions_company_status_date_idx
  ON public.transactions (company_id, status, date);
