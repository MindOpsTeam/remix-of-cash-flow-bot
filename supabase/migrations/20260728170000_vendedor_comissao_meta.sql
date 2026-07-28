-- F3: vendedor, comissão e meta.
--
-- O retrato: `sales_orders` JÁ TEM `commission_percent`, `commission_value`,
-- `payment_method` e `payment_terms`, e a tela não grava nenhuma delas.
-- `salesperson` é um Input de texto livre, então "João", "joão" e "Joao Silva"
-- são três vendedores diferentes e não existe ranking, comissão nem meta.
--
-- Colunas prontas que ninguém preenche são pior que colunas faltando: dão a
-- impressão de que o recurso existe.

CREATE TABLE IF NOT EXISTS public.salespeople (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text,
  /* Quando o vendedor também é usuário do sistema, dá para filtrar a tela dele. */
  user_id uuid,
  comissao_padrao numeric(6,3) NOT NULL DEFAULT 0 CHECK (comissao_padrao >= 0 AND comissao_padrao <= 100),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, name)
);

ALTER TABLE public.salespeople ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members manage salespeople" ON public.salespeople;
CREATE POLICY "Members manage salespeople" ON public.salespeople
  FOR ALL TO authenticated
  USING (public.is_company_member(company_id))
  WITH CHECK (public.is_company_member(company_id));
REVOKE ALL ON public.salespeople FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.salespeople TO authenticated;

ALTER TABLE public.sales_orders
  ADD COLUMN IF NOT EXISTS salesperson_id uuid REFERENCES public.salespeople(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS sales_orders_salesperson_idx
  ON public.sales_orders (company_id, salesperson_id) WHERE salesperson_id IS NOT NULL;

-- Migra o texto livre para entidade, sem perder nada. Nomes que só diferem por
-- caixa ou espaço viram o mesmo vendedor, que é o ponto de ter entidade.
INSERT INTO public.salespeople (company_id, name)
SELECT DISTINCT so.company_id, btrim(so.salesperson)
  FROM public.sales_orders so
 WHERE COALESCE(btrim(so.salesperson), '') <> ''
ON CONFLICT (company_id, name) DO NOTHING;

UPDATE public.sales_orders so
   SET salesperson_id = sp.id
  FROM public.salespeople sp
 WHERE sp.company_id = so.company_id
   AND lower(btrim(sp.name)) = lower(btrim(so.salesperson))
   AND so.salesperson_id IS NULL;

CREATE TABLE IF NOT EXISTS public.sales_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  salesperson_id uuid REFERENCES public.salespeople(id) ON DELETE CASCADE,
  mes date NOT NULL,
  meta numeric(14,2) NOT NULL CHECK (meta > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  /* Meta sem vendedor é a meta da empresa no mês. */
  UNIQUE (company_id, salesperson_id, mes)
);

ALTER TABLE public.sales_targets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members manage targets" ON public.sales_targets;
CREATE POLICY "Members manage targets" ON public.sales_targets
  FOR ALL TO authenticated
  USING (public.is_company_member(company_id))
  WITH CHECK (public.is_company_member(company_id));
REVOKE ALL ON public.sales_targets FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_targets TO authenticated;

/**
 * Meta x realizado por vendedor e mês.
 *
 * O realizado conta pedido FATURADO ou ENTREGUE, e não orçamento: comissão
 * sobre proposta que nunca virou nota é dívida que a empresa cria contra si
 * mesma. Pedido cancelado sai da conta.
 */
CREATE OR REPLACE VIEW public.v_meta_vendedor
WITH (security_invoker = on) AS
 WITH realizado AS (
   SELECT
     so.company_id,
     so.salesperson_id,
     date_trunc('month', so.issue_date::timestamptz)::date AS mes,
     sum(so.total) AS vendido,
     count(*) AS pedidos,
     sum(so.total * COALESCE(so.commission_percent, sp.comissao_padrao, 0) / 100) AS comissao
   FROM public.sales_orders so
   LEFT JOIN public.salespeople sp ON sp.id = so.salesperson_id
   WHERE so.status IN ('invoiced', 'delivered')
   GROUP BY so.company_id, so.salesperson_id, (date_trunc('month', so.issue_date::timestamptz))
 )
 SELECT
    COALESCE(r.company_id, t.company_id) AS company_id,
    COALESCE(r.salesperson_id, t.salesperson_id) AS salesperson_id,
    sp.name AS vendedor,
    COALESCE(r.mes, t.mes) AS mes,
    t.meta,
    COALESCE(r.vendido, 0) AS vendido,
    COALESCE(r.pedidos, 0) AS pedidos,
    round(COALESCE(r.comissao, 0), 2) AS comissao,
    CASE
      WHEN COALESCE(t.meta, 0) <= 0 THEN NULL
      ELSE round(COALESCE(r.vendido, 0) * 100 / t.meta, 1)
    END AS atingimento_pct
   FROM realizado r
   FULL OUTER JOIN public.sales_targets t
     ON t.company_id = r.company_id
    AND t.salesperson_id IS NOT DISTINCT FROM r.salesperson_id
    AND t.mes = r.mes
   LEFT JOIN public.salespeople sp
     ON sp.id = COALESCE(r.salesperson_id, t.salesperson_id);

REVOKE ALL ON public.v_meta_vendedor FROM anon;
GRANT SELECT ON public.v_meta_vendedor TO authenticated;

COMMENT ON VIEW public.v_meta_vendedor IS
  'Meta x realizado por vendedor e mês. Realizado conta só pedido faturado ou entregue.';

/**
 * Fecha a comissão do mês, gerando UMA conta a pagar por vendedor.
 *
 * Comissão que fica só em relatório não vira dinheiro saindo, então não aparece
 * no fluxo de caixa nem no DRE, e a empresa se surpreende quando o vendedor
 * cobra. Aqui ela vira obrigação de verdade.
 *
 * Idempotente por (empresa, vendedor, mês): rodar duas vezes não paga duas.
 */
CREATE OR REPLACE FUNCTION public.fechar_comissao(p_company_id uuid, p_mes date, p_vencimento date DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mes date := date_trunc('month', p_mes)::date;
  v_venc date := COALESCE(p_vencimento, (date_trunc('month', p_mes) + interval '1 month' + interval '9 days')::date);
  v_criadas integer := 0;
  v_total numeric := 0;
  r record;
BEGIN
  IF NOT public.is_company_member(p_company_id) THEN
    RAISE EXCEPTION 'Sem acesso a esta empresa.' USING ERRCODE = '42501';
  END IF;

  FOR r IN
    SELECT v.salesperson_id, v.vendedor, v.comissao
      FROM public.v_meta_vendedor v
     WHERE v.company_id = p_company_id AND v.mes = v_mes
       AND v.salesperson_id IS NOT NULL AND v.comissao > 0
  LOOP
    -- A referência na descrição é o que torna a repetição detectável sem
    -- precisar de coluna nova em bills_payable.
    IF EXISTS (
      SELECT 1 FROM public.bills_payable b
       WHERE b.company_id = p_company_id
         AND b.descricao = format('Comissão %s — %s', r.vendedor, to_char(v_mes, 'MM/YYYY'))
    ) THEN
      CONTINUE;
    END IF;

    -- `approval_status` explícito: o default da coluna é 'approved', e foi
    -- justamente esse default que deixou o pedido de compra furar o limite de
    -- alçada. Comissão apurada pelo sistema nasce aprovada de propósito, mas
    -- dizer isso em voz alta evita repetir o furo por omissão.
    INSERT INTO public.bills_payable
      (company_id, fornecedor, descricao, valor, vencimento, status, source, approval_status)
    VALUES (p_company_id,
            r.vendedor,
            format('Comissão %s — %s', r.vendedor, to_char(v_mes, 'MM/YYYY')),
            round(r.comissao, 2), v_venc, 'pending', 'comissao', 'approved');

    v_criadas := v_criadas + 1;
    v_total := v_total + round(r.comissao, 2);
  END LOOP;

  RETURN jsonb_build_object('contas_criadas', v_criadas, 'total', v_total, 'vencimento', v_venc);
END;
$$;

REVOKE ALL ON FUNCTION public.fechar_comissao(uuid, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fechar_comissao(uuid, date, date) TO authenticated;

COMMENT ON FUNCTION public.fechar_comissao(uuid, date, date) IS
  'Gera uma conta a pagar por vendedor com a comissão do mês. Idempotente pela descrição.';
