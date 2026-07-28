-- A cadeia pedido, nota, recebível.
--
-- Decisão nº 2 do conselho: "duas colunas e um botão Faturar transformam três
-- ilhas em processo".
--
-- Hoje o pedido de venda é ilha completa. Não vira nota (SalesOrders.tsx manda
-- sales_order_id e NfseEmit.tsx descarta o parâmetro), não vira recebível, não
-- move estoque e não entra no DRE. Em produção: 4 pedidos de venda e ZERO
-- recebíveis.
--
-- Esta migration abre o caminho. A geração em si é a função `faturar_pedido`.

ALTER TABLE public.receivables
  ADD COLUMN IF NOT EXISTS sales_order_id uuid REFERENCES public.sales_orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  -- Pedido parcelado gera N recebíveis. Sem o número da parcela o cliente vê
  -- três linhas iguais e não sabe qual já pagou.
  ADD COLUMN IF NOT EXISTS parcela integer,
  ADD COLUMN IF NOT EXISTS parcelas_total integer;

-- 'pedido' é origem nova e precisa entrar no CHECK, senão o insert é recusado.
ALTER TABLE public.receivables DROP CONSTRAINT IF EXISTS receivables_source_check;
ALTER TABLE public.receivables
  ADD CONSTRAINT receivables_source_check
  CHECK (source IN ('contrato', 'asaas', 'manual', 'pedido'));

CREATE INDEX IF NOT EXISTS receivables_sales_order_idx
  ON public.receivables (sales_order_id) WHERE sales_order_id IS NOT NULL;

-- Faturar duas vezes o mesmo pedido é o erro clássico da tela dupla, e o
-- resultado é receita dobrada no DRE. O índice impede na raiz.
CREATE UNIQUE INDEX IF NOT EXISTS receivables_pedido_parcela_uq
  ON public.receivables (sales_order_id, parcela) WHERE sales_order_id IS NOT NULL;

/**
 * Fatura o pedido: gera os recebíveis e move o pedido para 'invoiced'.
 *
 * Tudo numa transação só. Meio caminho aqui significa pedido faturado sem
 * recebível, ou recebível sem pedido faturado, e os dois estados são piores
 * que o erro.
 */
CREATE OR REPLACE FUNCTION public.faturar_pedido(
  p_sales_order_id uuid,
  p_parcelas integer DEFAULT 1,
  p_primeiro_vencimento date DEFAULT NULL,
  p_intervalo_dias integer DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pedido record;
  v_parcelas integer := greatest(1, least(coalesce(p_parcelas, 1), 36));
  v_intervalo integer := greatest(1, least(coalesce(p_intervalo_dias, 30), 365));
  v_base date;
  v_valor_parcela numeric;
  v_resto numeric;
  v_valor numeric;
  v_venc date;
  v_i integer;
  v_criados integer := 0;
  v_ids uuid[] := '{}';
  v_id uuid;
BEGIN
  SELECT * INTO v_pedido FROM public.sales_orders WHERE id = p_sales_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado.' USING ERRCODE = '23503';
  END IF;

  -- SECURITY DEFINER desliga a RLS daqui para baixo, então a checagem é
  -- explícita e é a primeira coisa que roda.
  IF NOT public.is_company_member(v_pedido.company_id) THEN
    RAISE EXCEPTION 'Sem acesso a esta empresa.' USING ERRCODE = '42501';
  END IF;

  IF v_pedido.status = 'cancelled' THEN
    RAISE EXCEPTION 'Pedido cancelado não pode ser faturado.' USING ERRCODE = '23514';
  END IF;

  IF coalesce(v_pedido.total, 0) <= 0 THEN
    RAISE EXCEPTION 'Pedido sem valor não gera recebível.' USING ERRCODE = '23514';
  END IF;

  IF EXISTS (SELECT 1 FROM public.receivables WHERE sales_order_id = p_sales_order_id) THEN
    RAISE EXCEPTION 'Este pedido já foi faturado.' USING ERRCODE = '23505';
  END IF;

  v_base := coalesce(p_primeiro_vencimento, v_pedido.due_date, current_date);

  -- Divisão em centavos: o resto vai para a PRIMEIRA parcela, senão a soma das
  -- parcelas não fecha com o total do pedido e o DRE ganha uma diferença de
  -- centavos que ninguém explica depois.
  v_valor_parcela := trunc((v_pedido.total / v_parcelas)::numeric, 2);
  v_resto := round(v_pedido.total - (v_valor_parcela * v_parcelas), 2);

  FOR v_i IN 1..v_parcelas LOOP
    v_valor := v_valor_parcela + CASE WHEN v_i = 1 THEN v_resto ELSE 0 END;
    v_venc := v_base + ((v_i - 1) * v_intervalo);

    INSERT INTO public.receivables (
      company_id, contact_id, sales_order_id, description, amount, due_date,
      status, source, parcela, parcelas_total
    ) VALUES (
      v_pedido.company_id,
      v_pedido.contact_id,
      p_sales_order_id,
      'Pedido ' || v_pedido.order_number ||
        CASE WHEN v_parcelas > 1 THEN ' (' || v_i || '/' || v_parcelas || ')' ELSE '' END,
      v_valor,
      v_venc,
      'a_receber',
      'pedido',
      v_i,
      v_parcelas
    ) RETURNING id INTO v_id;

    v_ids := v_ids || v_id;
    v_criados := v_criados + 1;
  END LOOP;

  UPDATE public.sales_orders SET status = 'invoiced', updated_at = now()
   WHERE id = p_sales_order_id;

  RETURN jsonb_build_object(
    'recebiveis_criados', v_criados,
    'ids', to_jsonb(v_ids),
    'total', v_pedido.total,
    'primeiro_vencimento', v_base
  );
END;
$$;

REVOKE ALL ON FUNCTION public.faturar_pedido(uuid, integer, date, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.faturar_pedido(uuid, integer, date, integer) TO authenticated;

COMMENT ON FUNCTION public.faturar_pedido(uuid, integer, date, integer) IS
  'Gera os recebíveis do pedido, com parcelamento, e move o pedido para invoiced. Tudo numa transação.';
