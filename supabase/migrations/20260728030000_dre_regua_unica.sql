-- Régua única do DRE, e o dinheiro que ninguém via.
--
-- Dois defeitos que o conselho apontou, no mesmo lugar:
--
-- 1. A régua do resultado (o que é receita, o que é custo, o que é despesa,
--    quais status contam) vivia DUPLICADA: nas views de margem em SQL e de
--    novo, à mão, em src/pages/DRE.tsx. Duas cópias da mesma regra sempre
--    divergem, e já divergiram uma vez: o status 'reconciled' foi corrigido
--    na view e quase não foi corrigido na tela.
--
-- 2. Lançamento sem conta contábil simplesmente SUMIA do DRE. A tela monta as
--    linhas a partir do plano de contas, então o que não tem account_id não
--    aparece em nenhuma linha e nem no total. Em produção isso é a maior parte
--    do movimento importado, ou seja, o DRE mostrava um faturamento menor que
--    o real e ninguém tinha como perceber pela tela.
--
-- Esta view resolve os dois: ela é a única dona da régua, e devolve o não
-- classificado como um grupo explícito, para a tela ter obrigação de mostrar.

CREATE OR REPLACE VIEW public.v_dre_linhas
WITH (security_invoker = on) AS
 SELECT
    t.company_id,
    date_trunc('month'::text, t.date::timestamp with time zone)::date AS mes,
    t.account_id,
    coa.code AS account_code,
    coa.name AS account_name,
    t.type,
    t.is_intercompany,
    -- A régua. Muda aqui e muda em todo lugar, que é o ponto.
    -- coa.id IS NULL cobre os dois buracos: lançamento sem conta e lançamento
    -- apontando para conta que não existe mais.
    CASE
      WHEN coa.id IS NULL THEN 'a_classificar'::text
      WHEN t.type = 'revenue'::text THEN 'receita'::text
      WHEN t.type = 'expense'::text AND "left"(COALESCE(coa.code, ''::text), 1) = '4'::text THEN 'custo'::text
      ELSE 'despesa'::text
    END AS grupo,
    sum(t.amount) AS total,
    count(*) AS lancamentos
   FROM transactions t
     LEFT JOIN chart_of_accounts coa ON coa.id = t.account_id
  WHERE t.status = ANY (ARRAY['confirmed'::text, 'reconciled'::text])
  GROUP BY t.company_id, (date_trunc('month'::text, t.date::timestamp with time zone)),
           t.account_id, coa.id, coa.code, coa.name, t.type, t.is_intercompany;

-- security_invoker faz a RLS de transactions valer para quem consulta, então o
-- anon já não enxergaria nada. Mesmo assim tiramos o grant: a casa não deixa
-- privilégio herdado de default valendo em objeto de resultado financeiro.
REVOKE ALL ON public.v_dre_linhas FROM anon;
GRANT SELECT ON public.v_dre_linhas TO authenticated;

COMMENT ON VIEW public.v_dre_linhas IS
  'Linhas do DRE por empresa, mês e conta, com a régua de classificação aplicada aqui e em nenhum outro lugar. grupo = receita | custo | despesa | a_classificar.';
