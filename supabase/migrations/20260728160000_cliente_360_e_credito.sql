-- F2: cliente 360 e o limite de crédito que era decorativo.
--
-- O retrato: `contacts` é uma tabela rica (endereço completo, documento,
-- `credit_limit`, `default_payment_terms`, WhatsApp). A tela grava tudo e
-- NADA disso é lido depois.
--
--   - `credit_limit` é gravado e nunca consultado em lugar nenhum. Não existe
--     aviso nem bloqueio ao vender para quem já deve.
--   - Nenhuma tela agrega pedidos, notas ou recebíveis por cliente.
--   - `transactions` e `bills_payable` não têm `contact_id`, então o
--     financeiro puro não sabe de quem é o dinheiro.
--
-- Cadastro que ninguém lê é formulário, não relacionamento.

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL;

ALTER TABLE public.bills_payable
  ADD COLUMN IF NOT EXISTS contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS transactions_contact_idx
  ON public.transactions (company_id, contact_id) WHERE contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS bills_payable_contact_idx
  ON public.bills_payable (company_id, contact_id) WHERE contact_id IS NOT NULL;

/**
 * O cliente inteiro numa linha.
 *
 * Faturado, em aberto, vencido, atraso médio, ticket e a data do último
 * movimento. É o que responde "posso vender mais para ele?" sem abrir quatro
 * telas.
 *
 * `atraso_medio_dias` só olha o que JÁ FOI PAGO. Incluir título em aberto
 * misturaria "ele costuma atrasar" com "ele está atrasado agora", que são
 * perguntas diferentes: a primeira é comportamento, a segunda é situação.
 */
CREATE OR REPLACE VIEW public.v_cliente_360
WITH (security_invoker = on) AS
 SELECT
    c.id AS contact_id,
    c.company_id,
    c.name,
    c.type,
    c.document,
    c.whatsapp,
    c.credit_limit,
    c.default_payment_terms,
    COALESCE(r.faturado, 0) AS faturado,
    COALESCE(r.em_aberto, 0) AS em_aberto,
    COALESCE(r.vencido, 0) AS vencido,
    COALESCE(r.recebido, 0) AS recebido,
    COALESCE(r.titulos, 0) AS titulos,
    r.atraso_medio_dias,
    r.ultimo_vencimento,
    COALESCE(p.pedidos, 0) AS pedidos,
    p.ultimo_pedido_em,
    CASE
      WHEN COALESCE(p.pedidos, 0) = 0 THEN NULL
      ELSE round(COALESCE(p.total_pedidos, 0) / p.pedidos, 2)
    END AS ticket_medio,
    -- Quanto do limite já está comprometido. Acima de 100 significa que a
    -- empresa está vendendo para quem já estourou o próprio limite.
    CASE
      WHEN COALESCE(c.credit_limit, 0) <= 0 THEN NULL
      ELSE round(COALESCE(r.em_aberto, 0) * 100 / c.credit_limit, 1)
    END AS uso_do_limite_pct
   FROM public.contacts c
   LEFT JOIN LATERAL (
     SELECT
       sum(rc.amount) AS faturado,
       sum(rc.amount) FILTER (WHERE rc.status IN ('a_receber', 'vencido')) AS em_aberto,
       sum(rc.amount) FILTER (WHERE rc.status = 'vencido'
                                 OR (rc.status = 'a_receber' AND rc.due_date < current_date)) AS vencido,
       sum(rc.amount) FILTER (WHERE rc.status = 'recebido') AS recebido,
       count(*) AS titulos,
       round(avg(rc.payment_date - rc.due_date) FILTER (WHERE rc.payment_date IS NOT NULL), 1)
         AS atraso_medio_dias,
       max(rc.due_date) AS ultimo_vencimento
     FROM public.receivables rc
     WHERE rc.contact_id = c.id
   ) r ON true
   LEFT JOIN LATERAL (
     SELECT count(*) AS pedidos, sum(so.total) AS total_pedidos, max(so.issue_date) AS ultimo_pedido_em
     FROM public.sales_orders so
     WHERE so.contact_id = c.id AND so.status <> 'cancelled'
   ) p ON true
  WHERE c.active = true;

REVOKE ALL ON public.v_cliente_360 FROM anon;
GRANT SELECT ON public.v_cliente_360 TO authenticated;

COMMENT ON VIEW public.v_cliente_360 IS
  'Cliente inteiro numa linha: faturado, em aberto, vencido, atraso médio (só do que já foi pago), ticket e uso do limite.';

-- `faturar_pedido` passa a olhar o limite de crédito.
--
-- Avisa, e não bloqueia: quem decide vender para um cliente estourado é o dono
-- do negócio, que às vezes tem contexto que o sistema não tem. Bloquear faria
-- ele desligar o controle inteiro na primeira vez que atrapalhasse uma venda
-- legítima. O aviso volta no retorno e a tela mostra antes de confirmar.
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
  v_base date; v_valor_parcela numeric; v_resto numeric; v_valor numeric;
  v_venc date; v_i integer; v_criados integer := 0; v_ids uuid[] := '{}'; v_id uuid;
  v_limite numeric; v_em_aberto numeric := 0; v_alerta text := NULL;
BEGIN
  SELECT * INTO v_pedido FROM public.sales_orders WHERE id = p_sales_order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado.' USING ERRCODE = '23503'; END IF;
  IF NOT public.is_company_member(v_pedido.company_id) THEN
    RAISE EXCEPTION 'Sem acesso a esta empresa.' USING ERRCODE = '42501'; END IF;
  IF v_pedido.status = 'cancelled' THEN
    RAISE EXCEPTION 'Pedido cancelado não pode ser faturado.' USING ERRCODE = '23514'; END IF;
  IF coalesce(v_pedido.total, 0) <= 0 THEN
    RAISE EXCEPTION 'Pedido sem valor não gera recebível.' USING ERRCODE = '23514'; END IF;
  IF EXISTS (SELECT 1 FROM public.receivables WHERE sales_order_id = p_sales_order_id) THEN
    RAISE EXCEPTION 'Este pedido já foi faturado.' USING ERRCODE = '23505'; END IF;

  IF v_pedido.contact_id IS NOT NULL THEN
    SELECT credit_limit INTO v_limite FROM public.contacts WHERE id = v_pedido.contact_id;
    IF COALESCE(v_limite, 0) > 0 THEN
      SELECT COALESCE(sum(amount), 0) INTO v_em_aberto
        FROM public.receivables
       WHERE contact_id = v_pedido.contact_id AND status IN ('a_receber', 'vencido');

      IF v_em_aberto + v_pedido.total > v_limite THEN
        v_alerta := format(
          'Este faturamento leva o cliente a %s em aberto, acima do limite de %s.',
          to_char(v_em_aberto + v_pedido.total, 'FM999G999G990D00'),
          to_char(v_limite, 'FM999G999G990D00'));
      END IF;
    END IF;
  END IF;

  v_base := coalesce(p_primeiro_vencimento, v_pedido.due_date, current_date);
  v_valor_parcela := trunc((v_pedido.total / v_parcelas)::numeric, 2);
  v_resto := round(v_pedido.total - (v_valor_parcela * v_parcelas), 2);

  FOR v_i IN 1..v_parcelas LOOP
    v_valor := v_valor_parcela + CASE WHEN v_i = 1 THEN v_resto ELSE 0 END;
    v_venc := v_base + ((v_i - 1) * v_intervalo);
    INSERT INTO public.receivables (
      company_id, contact_id, sales_order_id, description, amount, due_date,
      status, source, parcela, parcelas_total
    ) VALUES (
      v_pedido.company_id, v_pedido.contact_id, p_sales_order_id,
      'Pedido ' || v_pedido.order_number ||
        CASE WHEN v_parcelas > 1 THEN ' (' || v_i || '/' || v_parcelas || ')' ELSE '' END,
      v_valor, v_venc, 'a_receber', 'pedido', v_i, v_parcelas
    ) RETURNING id INTO v_id;
    v_ids := v_ids || v_id; v_criados := v_criados + 1;
  END LOOP;

  UPDATE public.sales_orders SET status = 'invoiced', updated_at = now() WHERE id = p_sales_order_id;

  RETURN jsonb_build_object(
    'recebiveis_criados', v_criados, 'ids', to_jsonb(v_ids),
    'total', v_pedido.total, 'primeiro_vencimento', v_base,
    'alerta_credito', v_alerta);
END;
$$;

/**
 * Situação de crédito do cliente ANTES de faturar.
 *
 * Existe separada porque a tela precisa avisar antes de o usuário clicar, e
 * não depois de o recebível existir.
 */
CREATE OR REPLACE FUNCTION public.checar_credito(p_contact_id uuid, p_valor numeric)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_c record;
  v_em_aberto numeric := 0;
BEGIN
  SELECT id, company_id, name, credit_limit INTO v_c FROM public.contacts WHERE id = p_contact_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('tem_limite', false); END IF;
  IF NOT public.is_company_member(v_c.company_id) THEN
    RAISE EXCEPTION 'Sem acesso a esta empresa.' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(sum(amount), 0) INTO v_em_aberto
    FROM public.receivables
   WHERE contact_id = p_contact_id AND status IN ('a_receber', 'vencido');

  RETURN jsonb_build_object(
    'tem_limite', COALESCE(v_c.credit_limit, 0) > 0,
    'limite', v_c.credit_limit,
    'em_aberto', v_em_aberto,
    'depois_desta_venda', v_em_aberto + COALESCE(p_valor, 0),
    'estoura', COALESCE(v_c.credit_limit, 0) > 0
               AND (v_em_aberto + COALESCE(p_valor, 0)) > v_c.credit_limit
  );
END;
$$;

REVOKE ALL ON FUNCTION public.checar_credito(uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.checar_credito(uuid, numeric) TO authenticated;
