-- Confirmar pedido baixa estoque, e o status vira máquina de estados.
--
-- Correção de uma afirmação minha. Marquei o F0 do plano comercial como "feito"
-- porque `faturar_pedido()` e a correção do `NfseEmit` saíram, mas dois itens
-- do mesmo F0 não existiam: a baixa de estoque na venda e a máquina de estados.
-- Ficou pior do que se eu não tivesse escrito nada, porque o documento passou a
-- dizer que estava pronto.
--
-- O efeito real do que faltava: vender NÃO reduzia estoque. `current_stock` só
-- mudava por lançamento manual na tela de Estoque. É a mesma família do defeito
-- que já corrigi nesta base, quando o ajuste gravava quantidade absoluta como
-- delta: estoque que mente.

-- ── 1. A RPC ganha procedência ────────────────────────────────────────────
--
-- `registrar_movimento_estoque` gravava `reference_type = 'manual'` fixo. Com a
-- venda passando a movimentar, "de onde veio este movimento" deixa de ser
-- detalhe: sem isso ninguém audita a diferença de inventário.
--
-- DROP e recria porque acrescentar parâmetro muda a assinatura, e CREATE OR
-- REPLACE com assinatura diferente criaria uma SEGUNDA função, deixando a
-- chamada ambígua. A lógica é a mesma, sem cópia: continua havendo uma função
-- só que mexe em estoque.

DROP FUNCTION IF EXISTS public.registrar_movimento_estoque(uuid, uuid, text, numeric, numeric, text, uuid);

CREATE OR REPLACE FUNCTION public.registrar_movimento_estoque(
  p_company_id uuid,
  p_product_id uuid,
  p_tipo text,
  p_quantidade numeric,
  p_custo_unitario numeric DEFAULT NULL,
  p_observacao text DEFAULT NULL,
  p_warehouse_id uuid DEFAULT NULL,
  p_reference_type text DEFAULT 'manual',
  p_reference_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  v_saldo numeric; v_custo numeric; v_cadastro numeric; v_delta numeric;
  v_novo numeric; v_novo_custo numeric; v_deposito uuid; v_user uuid := auth.uid();
begin
  if not public.is_company_member(p_company_id) then raise exception 'Sem permissão nesta empresa'; end if;
  if p_tipo not in ('in','out','adjustment') then raise exception 'Tipo de movimento inválido: %', p_tipo; end if;

  select current_stock, average_cost, cost_price into v_saldo, v_custo, v_cadastro
  from public.products where id = p_product_id and company_id = p_company_id for update;
  if not found then raise exception 'Produto não encontrado nesta empresa'; end if;
  v_saldo := coalesce(v_saldo, 0);
  -- Sem média formada ainda, o custo cadastrado no produto é a abertura. Só se
  -- não houver nem isso é que a própria entrada vira a base.
  v_custo := coalesce(v_custo, v_cadastro);

  if p_tipo = 'in' then v_delta := abs(p_quantidade);
  elsif p_tipo = 'out' then v_delta := -abs(p_quantidade);
  else v_delta := p_quantidade - v_saldo; end if;

  v_novo := v_saldo + v_delta;
  if p_tipo = 'out' and v_novo < 0 then
    raise exception 'Estoque insuficiente: disponível %, saída %', v_saldo, abs(p_quantidade);
  end if;

  if p_tipo = 'in' and p_custo_unitario is not null and v_novo > 0 then
    v_novo_custo := round(((greatest(v_saldo,0) * coalesce(v_custo, p_custo_unitario)) + (v_delta * p_custo_unitario)) / v_novo, 6);
  else
    v_novo_custo := v_custo;
  end if;

  if p_warehouse_id is not null then v_deposito := p_warehouse_id;
  else
    select id into v_deposito from public.warehouses where company_id = p_company_id limit 1;
    if v_deposito is null then
      insert into public.warehouses (company_id, name) values (p_company_id, 'Depósito principal') returning id into v_deposito;
    end if;
  end if;

  insert into public.stock_movements (company_id, product_id, warehouse_id, type, quantity, unit_cost, notes, user_id, reference_type, reference_id)
  values (p_company_id, p_product_id, v_deposito, p_tipo, v_delta, p_custo_unitario, p_observacao, v_user,
          coalesce(p_reference_type, 'manual'), p_reference_id);

  update public.products set current_stock = v_novo, average_cost = v_novo_custo where id = p_product_id;

  return json_build_object('saldo_anterior', v_saldo, 'delta', v_delta, 'saldo_novo', v_novo, 'custo_medio', v_novo_custo);
end;
$$;

REVOKE ALL ON FUNCTION public.registrar_movimento_estoque(uuid, uuid, text, numeric, numeric, text, uuid, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_movimento_estoque(uuid, uuid, text, numeric, numeric, text, uuid, text, uuid) TO authenticated;

-- ── 2. Confirmar baixa, cancelar devolve ──────────────────────────────────

ALTER TABLE public.sales_orders
  ADD COLUMN IF NOT EXISTS estoque_baixado_em timestamptz;

COMMENT ON COLUMN public.sales_orders.estoque_baixado_em IS
  'Quando o pedido saiu do estoque. Impede baixa dupla em confirmar/cancelar/confirmar.';

CREATE OR REPLACE FUNCTION public.movimentar_estoque_do_pedido()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
BEGIN
  -- Só produto com controle de estoque ligado. Serviço e item sem controle não
  -- movimentam nada, e produto sem `product_id` (item digitado à mão) também
  -- não: não dá para dar baixa no que não está cadastrado.

  -- SAÍDA: entrou em confirmado e ainda não baixou.
  IF NEW.status IN ('confirmed', 'invoiced', 'delivered')
     AND OLD.status = 'quote'
     AND NEW.estoque_baixado_em IS NULL THEN

    FOR r IN
      SELECT i.product_id, sum(i.quantity) AS qtd
        FROM public.sales_order_items i
        JOIN public.products p ON p.id = i.product_id
       WHERE i.order_id = NEW.id AND p.track_stock = true
       GROUP BY i.product_id
    LOOP
      PERFORM public.registrar_movimento_estoque(
        NEW.company_id, r.product_id, 'out', r.qtd, NULL,
        'Pedido ' || NEW.order_number, NULL, 'sales_order', NEW.id);
    END LOOP;

    NEW.estoque_baixado_em := now();
    RETURN NEW;
  END IF;

  -- DEVOLUÇÃO: cancelou um pedido que já tinha baixado.
  IF NEW.status = 'cancelled' AND OLD.status <> 'cancelled'
     AND OLD.estoque_baixado_em IS NOT NULL THEN

    FOR r IN
      SELECT i.product_id, sum(i.quantity) AS qtd
        FROM public.sales_order_items i
        JOIN public.products p ON p.id = i.product_id
       WHERE i.order_id = NEW.id AND p.track_stock = true
       GROUP BY i.product_id
    LOOP
      PERFORM public.registrar_movimento_estoque(
        NEW.company_id, r.product_id, 'in', r.qtd, NULL,
        'Cancelamento do pedido ' || NEW.order_number, NULL, 'sales_order_cancel', NEW.id);
    END LOOP;

    NEW.estoque_baixado_em := NULL;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

-- Nome com prefixo `b_` de propósito: o Postgres dispara gatilhos do mesmo
-- evento em ordem ALFABÉTICA, e a validação da transição (prefixo `a_`)
-- precisa correr antes da baixa. A transação abortada desfaria o movimento de
-- qualquer jeito, mas depender de rollback para não fazer besteira é frágil.
DROP TRIGGER IF EXISTS trg_estoque_do_pedido ON public.sales_orders;
DROP TRIGGER IF EXISTS trg_b_estoque_do_pedido ON public.sales_orders;
CREATE TRIGGER trg_b_estoque_do_pedido
  BEFORE UPDATE OF status ON public.sales_orders
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.movimentar_estoque_do_pedido();

-- ── 3. Máquina de estados ─────────────────────────────────────────────────
--
-- O status era um Select livre, então dava para levar um pedido de "entregue"
-- de volta para "orçamento" com recebível já gerado, e ninguém percebia.

CREATE OR REPLACE FUNCTION public.validar_transicao_pedido()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;

  -- Cancelar é sempre permitido, menos depois de faturado: aí existe recebível
  -- e cancelar sem tratar o título deixaria dinheiro fantasma no contas a
  -- receber. Quem quer desfazer precisa cancelar o recebível antes.
  IF NEW.status = 'cancelled' THEN
    IF EXISTS (SELECT 1 FROM public.receivables
                WHERE sales_order_id = NEW.id AND status <> 'cancelado') THEN
      RAISE EXCEPTION 'Este pedido tem recebível em aberto. Cancele o título antes de cancelar o pedido.'
        USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.status = 'cancelled' THEN
    RAISE EXCEPTION 'Pedido cancelado não volta. Crie um novo.' USING ERRCODE = '23514';
  END IF;

  IF NOT (
       (OLD.status = 'quote'     AND NEW.status = 'confirmed')
    OR (OLD.status = 'confirmed' AND NEW.status = 'invoiced')
    OR (OLD.status = 'invoiced'  AND NEW.status = 'delivered')
    -- Entregar sem faturar acontece em venda no balcão, e é legítimo.
    OR (OLD.status = 'confirmed' AND NEW.status = 'delivered')
  ) THEN
    RAISE EXCEPTION 'Não dá para ir de % para %. O caminho é orçamento, confirmado, faturado, entregue.',
      OLD.status, NEW.status USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_transicao_pedido ON public.sales_orders;
DROP TRIGGER IF EXISTS trg_a_transicao_pedido ON public.sales_orders;
CREATE TRIGGER trg_a_transicao_pedido
  BEFORE UPDATE OF status ON public.sales_orders
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.validar_transicao_pedido();
