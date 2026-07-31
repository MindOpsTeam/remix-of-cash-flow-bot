-- Hardening pós-review (2 CRITICAL, 1 HIGH, 3 MEDIUM confirmados no diff
-- d38b394..HEAD). Cada bloco nomeia o achado.

-- ── CRITICAL 1: escalada de privilégio via convites ─────────────────────
-- (a) member criava convite de ADMIN; (b) qualquer membro podia dar UPDATE
-- no role de convite pendente alheio. Convite de admin agora exige criador
-- admin, e convite é IMUTÁVEL via API (revogar = DELETE; a RPC de aceite é
-- SECURITY DEFINER e não passa por RLS).

DROP POLICY IF EXISTS "Convite admin exige admin" ON public.company_invites;
CREATE POLICY "Convite admin exige admin"
  ON public.company_invites AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    role <> 'admin'
    OR EXISTS (
      SELECT 1 FROM public.company_members m
       WHERE m.company_id = company_invites.company_id
         AND m.user_id = auth.uid()
         AND m.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Convite e imutavel" ON public.company_invites;
CREATE POLICY "Convite e imutavel"
  ON public.company_invites AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (false);

-- ── HIGH 3: viewer escrevia nos ITENS de pedido ─────────────────────────
-- sales_order_items/purchase_order_items não têm company_id; a régua entra
-- pelo pedido pai.

DO $$
DECLARE
  par record;
BEGIN
  FOR par IN SELECT * FROM (VALUES
    ('sales_order_items', 'sales_orders'),
    ('purchase_order_items', 'purchase_orders')
  ) AS t(filha, pai) LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Viewer nao insere itens" ON public.%I', par.filha);
    EXECUTE format(
      'CREATE POLICY "Viewer nao insere itens" ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated
       WITH CHECK (public.pode_escrever_na_empresa((SELECT company_id FROM public.%I p WHERE p.id = order_id)))',
      par.filha, par.pai);
    EXECUTE format('DROP POLICY IF EXISTS "Viewer nao altera itens" ON public.%I', par.filha);
    EXECUTE format(
      'CREATE POLICY "Viewer nao altera itens" ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated
       USING (public.pode_escrever_na_empresa((SELECT company_id FROM public.%I p WHERE p.id = order_id)))',
      par.filha, par.pai);
    EXECUTE format('DROP POLICY IF EXISTS "Viewer nao apaga itens" ON public.%I', par.filha);
    EXECUTE format(
      'CREATE POLICY "Viewer nao apaga itens" ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated
       USING (public.pode_escrever_na_empresa((SELECT company_id FROM public.%I p WHERE p.id = order_id)))',
      par.filha, par.pai);
  END LOOP;
END $$;

-- ── MEDIUM 4: rótulo PDV duplicável ─────────────────────────────────────
-- order_number era SERIAL sem unicidade por empresa (0 duplicatas hoje,
-- medido antes). O índice transforma a colisão do max+1 em erro que aborta a
-- venda — como o comentário da RPC já prometia.
CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_orders_company_number
  ON public.sales_orders (company_id, order_number);

-- ── MEDIUM 5: race no teto de plano ─────────────────────────────────────
-- Lock consultivo por empresa serializa as checagens concorrentes.
CREATE OR REPLACE FUNCTION public.checar_teto_agentes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plano public.plans;
  v_ativos integer;
BEGIN
  v_plano := public.plano_da_empresa(NEW.company_id);
  IF v_plano.max_agentes >= 0 THEN
    PERFORM pg_advisory_xact_lock(hashtext(NEW.company_id::text || ':teto_agentes'));
    SELECT count(*) INTO v_ativos FROM public.agent_instances
     WHERE company_id = NEW.company_id AND ativo = true AND id IS DISTINCT FROM NEW.id;
    IF NEW.ativo AND v_ativos >= v_plano.max_agentes THEN
      RAISE EXCEPTION 'O plano % permite % agente(s) ativo(s). Fale com o time para subir de plano.',
        v_plano.nome, v_plano.max_agentes USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.checar_teto_widgets()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plano public.plans;
  v_qtd integer;
BEGIN
  v_plano := public.plano_da_empresa(NEW.company_id);
  IF v_plano.max_widgets >= 0 THEN
    PERFORM pg_advisory_xact_lock(hashtext(NEW.company_id::text || ':teto_widgets'));
    SELECT count(*) INTO v_qtd FROM public.dashboard_widgets WHERE company_id = NEW.company_id;
    IF v_qtd >= v_plano.max_widgets THEN
      RAISE EXCEPTION 'O plano % permite % visão(ões) de BI. Fale com o time para subir de plano.',
        v_plano.nome, v_plano.max_widgets USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- ── MEDIUM 6 (parte SQL) + MEDIUM 7: venda_balcao checa a flag pdv do
-- plano e usa o DIA DA LOJA (America/Sao_Paulo), não o dia UTC — venda das
-- 21h às 23h59 pertencia ao dia seguinte no fechamento do caixa.
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
  v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_plano public.plans;
BEGIN
  IF NOT public.is_company_member(p_company_id) THEN
    RAISE EXCEPTION 'Sem acesso a esta empresa.' USING ERRCODE = '42501';
  END IF;

  IF NOT public.pode_escrever_na_empresa(p_company_id) THEN
    RAISE EXCEPTION 'Seu papel nesta empresa é somente leitura.' USING ERRCODE = '42501';
  END IF;

  v_plano := public.plano_da_empresa(p_company_id);
  IF NOT v_plano.pdv THEN
    RAISE EXCEPTION 'O plano % não inclui a frente de caixa. Fale com o time para subir de plano.', v_plano.nome
      USING ERRCODE = 'P0001';
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

  SELECT p.account_id INTO v_conta
    FROM jsonb_array_elements(p_itens) i
    JOIN public.products p ON p.id = (i->>'product_id')::uuid
   WHERE p.account_id IS NOT NULL AND p.company_id = p_company_id
   ORDER BY (coalesce((i->>'quantity')::numeric, 0) * coalesce((i->>'unit_price')::numeric, 0)) DESC
   LIMIT 1;

  SELECT coalesce(max(order_number), 0) + 1 INTO v_numero
    FROM public.sales_orders WHERE company_id = p_company_id;
  v_rotulo := 'PDV-' || v_numero::text;

  INSERT INTO public.sales_orders (
    company_id, user_id, order_number, status, issue_date, subtotal, discount_value, total,
    payment_method, contact_id, notes
  ) VALUES (
    p_company_id, auth.uid(), v_numero, 'quote', v_hoje, v_subtotal, v_desconto, v_total,
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

  UPDATE public.sales_orders SET status = 'confirmed', updated_at = now() WHERE id = v_order_id;
  UPDATE public.sales_orders SET status = 'delivered', updated_at = now() WHERE id = v_order_id;

  INSERT INTO public.transactions (
    company_id, user_id, date, description, amount, type, status, source,
    account_id, contact_id, payment_method
  ) VALUES (
    p_company_id, auth.uid(), v_hoje,
    'Venda balcão ' || v_rotulo, v_total, 'revenue', 'confirmed', 'pdv',
    v_conta, p_contact_id, p_forma_pagamento
  ) RETURNING id INTO v_tx_id;

  INSERT INTO public.receivables (
    company_id, description, amount, due_date, payment_date, status, source,
    contact_id, sales_order_id, transaction_id, account_id
  ) VALUES (
    p_company_id, 'Venda balcão ' || v_rotulo, v_total, v_hoje, v_hoje,
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
