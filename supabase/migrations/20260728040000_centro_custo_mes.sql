-- Centro de custo pela mesma régua do resultado.
--
-- O CFO Digital montava a quebra por centro de custo somando em TypeScript uma
-- lista de transações limitada a 1000 linhas e SEM filtro de status. Duas
-- consequências:
--
--   - empresa com mais de 1000 lançamentos recebia número errado, calado, e
--     quanto mais a empresa usa o produto, mais errado fica;
--   - lançamento pendente ou cancelado entrava na conta, então o número do
--     assistente não batia com o do DRE nem com o do painel na mesma tela.
--
-- Agregar no banco resolve os dois: sem teto de linhas e com a mesma régua de
-- status de v_dre_linhas.

CREATE OR REPLACE VIEW public.v_centro_custo_mes
WITH (security_invoker = on) AS
 SELECT
    t.company_id,
    date_trunc('month'::text, t.date::timestamp with time zone)::date AS mes,
    t.cost_center_id,
    COALESCE(cc.name, 'Sem centro de custo'::text) AS centro_nome,
    t.type,
    sum(t.amount) AS total,
    count(*) AS lancamentos
   FROM transactions t
     LEFT JOIN cost_centers cc ON cc.id = t.cost_center_id
  WHERE t.status = ANY (ARRAY['confirmed'::text, 'reconciled'::text])
  GROUP BY t.company_id, (date_trunc('month'::text, t.date::timestamp with time zone)),
           t.cost_center_id, cc.name, t.type;

REVOKE ALL ON public.v_centro_custo_mes FROM anon;
GRANT SELECT ON public.v_centro_custo_mes TO authenticated;

COMMENT ON VIEW public.v_centro_custo_mes IS
  'Gasto e receita por centro de custo e mês, mesma régua de status de v_dre_linhas. Agregado no banco: sem teto de linhas.';
