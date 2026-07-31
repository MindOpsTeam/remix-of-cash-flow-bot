-- RBAC de verdade: viewer passa a ser SOMENTE leitura no banco, não na UI.
--
-- Estado medido antes: 131 membros, todos 'admin' — esta migration não muda
-- nada para ninguém hoje; ela torna o papel 'viewer' real daqui pra frente.
-- Mecânica: políticas RESTRICTIVE (AND com as permissivas existentes) de
-- INSERT/UPDATE/DELETE em toda tabela núcleo com company_id. service_role
-- (edges) não passa por RLS e segue intacto; RPCs SECURITY DEFINER ganham a
-- checagem explícita onde escrevem (venda_balcao aqui; as demais ficam
-- registradas como próximo passo).

CREATE OR REPLACE FUNCTION public.pode_escrever_na_empresa(p_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_members
     WHERE company_id = p_company_id
       AND user_id = auth.uid()
       AND role IN ('admin', 'member')
  );
$$;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'transactions', 'receivables', 'bills_payable', 'sales_orders', 'products',
    'contacts', 'contracts', 'kpi_metas', 'dashboard_widgets', 'agent_instances',
    'stock_movements', 'chart_of_accounts', 'cost_centers', 'budgets', 'warehouses'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Viewer nao insere" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "Viewer nao insere" ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.pode_escrever_na_empresa(company_id))', t);
    EXECUTE format('DROP POLICY IF EXISTS "Viewer nao altera" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "Viewer nao altera" ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.pode_escrever_na_empresa(company_id))', t);
    EXECUTE format('DROP POLICY IF EXISTS "Viewer nao apaga" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "Viewer nao apaga" ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (public.pode_escrever_na_empresa(company_id))', t);
  END LOOP;
END $$;

-- venda_balcao é SECURITY DEFINER (RLS não a alcança): checagem explícita.
-- As demais RPCs SECURITY DEFINER que escrevem (faturar_pedido, fechar_mes,
-- registrar_movimento_estoque) recebem a mesma linha na próxima revisão.

CREATE OR REPLACE FUNCTION public.venda_balcao(
  p_company_id uuid,
  p_itens jsonb,
  p_forma_pagamento text DEFAULT 'dinheiro',
  p_desconto numeric DEFAULT 0,
  p_contact_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item jsonb;
  v_subtotal numeric := 0;
  v_desconto numeric := greatest(0, coalesce(p_desconto, 0));
  v_total numeric;
  v_order_id uuid;
  v_numero integer;
  v_rotulo text;
  v_conta uuid;
  v_tx_id uuid;
  v_recebivel_id uuid;
  v_qtd numeric;
  v_preco numeric;
  v_ordem integer := 0;
BEGIN
  IF NOT public.is_company_member(p_company_id) THEN
    RAISE EXCEPTION 'Sem acesso a esta empresa.' USING ERRCODE = '42501';
  END IF;

  IF NOT public.pode_escrever_na_empresa(p_company_id) THEN
    RAISE EXCEPTION 'Seu papel nesta empresa é somente leitura.' USING ERRCODE = '42501';
  END IF;

  IF p_itens IS NULL OR jsonb_array_length(p_itens) = 0 THEN
    RAISE EXCEPTION 'A venda precisa de pelo menos um item.' USING ERRCODE = '23514';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
    v_qtd := coalesce((v_item->>'quantity')::numeric, 0);
    v_preco := coalesce((v_item->>'unit_price')::numeric, 0);
    IF v_qtd <= 0 OR v_preco < 0 THEN
      RAISE EXCEPTION 'Item com quantidade ou preço inválido.' USING ERRCODE = '23514';
    END IF;
    v_subtotal := v_subtotal + v_qtd * v_preco;
  END LOOP;

  v_total := greatest(0, v_subtotal - v_desconto);

  -- Conta de receita: a do produto que mais pesa na venda; sem produto com
  -- conta, fica sem classificação e o fechamento resolve (nunca conta errada).
  SELECT p.account_id INTO v_conta
    FROM jsonb_array_elements(p_itens) i
    JOIN public.products p ON p.id = (i->>'product_id')::uuid
   WHERE p.account_id IS NOT NULL AND p.company_id = p_company_id
   ORDER BY (coalesce((i->>'quantity')::numeric, 0) * coalesce((i->>'unit_price')::numeric, 0)) DESC
   LIMIT 1;

  -- order_number é sequencial por empresa (integer). O lock da linha de maior
  -- número não existe; max+1 dentro da transação é suficiente no volume de
  -- balcão e colisão estoura a unique, abortando a venda sem efeito.
  SELECT coalesce(max(order_number), 0) + 1 INTO v_numero
    FROM public.sales_orders WHERE company_id = p_company_id;
  v_rotulo := 'PDV-' || v_numero::text;

  INSERT INTO public.sales_orders (
    company_id, user_id, order_number, status, issue_date, subtotal, discount_value, total,
    payment_method, contact_id, notes
  ) VALUES (
    p_company_id, auth.uid(), v_numero, 'quote', current_date, v_subtotal, v_desconto, v_total,
    p_forma_pagamento, p_contact_id, 'Venda de balcão (frente de caixa)'
  ) RETURNING id INTO v_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
    v_ordem := v_ordem + 1;
    INSERT INTO public.sales_order_items (order_id, product_id, description, quantity, unit_price, total, sort_order)
    VALUES (
      v_order_id,
      NULLIF(v_item->>'product_id', '')::uuid,
      coalesce(v_item->>'description', 'Item'),
      (v_item->>'quantity')::numeric,
      (v_item->>'unit_price')::numeric,
      (v_item->>'quantity')::numeric * (v_item->>'unit_price')::numeric,
      v_ordem
    );
  END LOOP;

  -- quote → confirmed → delivered: o primeiro passo dispara a baixa de
  -- estoque (trigger movimentar_estoque_do_pedido); o segundo registra a
  -- entrega imediata do balcão. Falta de estoque aborta aqui.
  UPDATE public.sales_orders SET status = 'confirmed', updated_at = now() WHERE id = v_order_id;
  UPDATE public.sales_orders SET status = 'delivered', updated_at = now() WHERE id = v_order_id;

  INSERT INTO public.transactions (
    company_id, user_id, date, description, amount, type, status, source,
    account_id, contact_id, payment_method
  ) VALUES (
    p_company_id, auth.uid(), current_date,
    'Venda balcão ' || v_rotulo, v_total, 'revenue', 'confirmed', 'pdv',
    v_conta, p_contact_id, p_forma_pagamento
  ) RETURNING id INTO v_tx_id;

  INSERT INTO public.receivables (
    company_id, description, amount, due_date, payment_date, status, source,
    contact_id, sales_order_id, transaction_id, account_id
  ) VALUES (
    p_company_id, 'Venda balcão ' || v_rotulo, v_total, current_date, current_date,
    'recebido', 'pdv', p_contact_id, v_order_id, v_tx_id, v_conta
  ) RETURNING id INTO v_recebivel_id;

  RETURN jsonb_build_object(
    'order_id', v_order_id,
    'order_number', v_rotulo,
    'total', v_total,
    'transaction_id', v_tx_id,
    'receivable_id', v_recebivel_id,
    'account_id', v_conta
  );
END;
$$;
