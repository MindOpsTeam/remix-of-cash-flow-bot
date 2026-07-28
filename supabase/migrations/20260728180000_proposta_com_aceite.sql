-- F4: a proposta que fecha sozinha.
--
-- Hoje "orçamento" é só `status='quote'` no mesmo registro do pedido, sem
-- numeração própria, sem validade e sem conversão. O cliente recebe um PDF por
-- WhatsApp, responde "fechado" numa conversa, e alguém tem que lembrar de
-- mudar o status na mão. O aceite não fica registrado em lugar nenhum.
--
-- Aqui o pedido em orçamento ganha um link público. O cliente abre, vê o que
-- foi proposto e aceita. O aceite grava quem, quando e de onde, e vira pedido
-- confirmado na hora.
--
-- SEGURANÇA: o link é a credencial, então ele precisa ser inadivinhável e
-- expirar. Token de 32 bytes aleatórios, validade obrigatória, e a leitura
-- pública devolve SÓ o que o cliente precisa ver. Nada de expor a tabela de
-- pedidos ao anon e filtrar no cliente.

ALTER TABLE public.sales_orders
  ADD COLUMN IF NOT EXISTS proposta_token text UNIQUE,
  ADD COLUMN IF NOT EXISTS proposta_validade date,
  ADD COLUMN IF NOT EXISTS aceite_em timestamptz,
  ADD COLUMN IF NOT EXISTS aceite_nome text,
  ADD COLUMN IF NOT EXISTS aceite_ip text;

COMMENT ON COLUMN public.sales_orders.proposta_token IS
  'Credencial do link público de aceite. Inadivinhável e com validade obrigatória.';

/**
 * Gera (ou renova) o link público da proposta.
 *
 * Renovar troca o token, o que invalida o link antigo. É o comportamento certo:
 * quem reenvia uma proposta corrigida não quer que a versão anterior continue
 * aceitável.
 */
CREATE OR REPLACE FUNCTION public.gerar_link_proposta(p_sales_order_id uuid, p_dias_validade integer DEFAULT 15)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pedido record;
  v_token text;
  v_validade date;
BEGIN
  SELECT * INTO v_pedido FROM public.sales_orders WHERE id = p_sales_order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado.' USING ERRCODE = '23503'; END IF;
  IF NOT public.is_company_member(v_pedido.company_id) THEN
    RAISE EXCEPTION 'Sem acesso a esta empresa.' USING ERRCODE = '42501'; END IF;
  IF v_pedido.aceite_em IS NOT NULL THEN
    RAISE EXCEPTION 'Esta proposta já foi aceita.' USING ERRCODE = '23505'; END IF;
  IF coalesce(v_pedido.total, 0) <= 0 THEN
    RAISE EXCEPTION 'Proposta sem valor não vai para o cliente.' USING ERRCODE = '23514'; END IF;

  -- pgcrypto mora no schema `extensions` no Supabase, e o search_path desta
  -- função é só `public` de propósito, para SECURITY DEFINER não herdar o
  -- caminho de quem chama. Por isso a chamada vem qualificada.
  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  v_validade := current_date + greatest(1, least(coalesce(p_dias_validade, 15), 180));

  UPDATE public.sales_orders
     SET proposta_token = v_token, proposta_validade = v_validade, updated_at = now()
   WHERE id = p_sales_order_id;

  RETURN jsonb_build_object('token', v_token, 'validade', v_validade);
END;
$$;

REVOKE ALL ON FUNCTION public.gerar_link_proposta(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gerar_link_proposta(uuid, integer) TO authenticated;

/**
 * Leitura pública da proposta, pelo token.
 *
 * Devolve só o que o cliente precisa ver. NÃO expõe id da empresa, custo,
 * comissão, margem nem notas internas: quem recebe a proposta é o comprador, e
 * o que ele não deveria ver não sai daqui, em vez de sair e ser escondido na
 * tela. Proposta vencida ou já aceita devolve o estado, não os itens.
 */
CREATE OR REPLACE FUNCTION public.ver_proposta(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v record;
  v_itens jsonb;
BEGIN
  IF p_token IS NULL OR length(p_token) < 32 THEN
    RETURN jsonb_build_object('estado', 'invalido');
  END IF;

  SELECT so.*, c.name AS empresa_nome, ct.name AS cliente_nome
    INTO v
    FROM public.sales_orders so
    JOIN public.companies c ON c.id = so.company_id
    LEFT JOIN public.contacts ct ON ct.id = so.contact_id
   WHERE so.proposta_token = p_token;

  IF NOT FOUND THEN RETURN jsonb_build_object('estado', 'invalido'); END IF;
  IF v.aceite_em IS NOT NULL THEN
    RETURN jsonb_build_object('estado', 'aceita', 'aceite_em', v.aceite_em, 'aceite_nome', v.aceite_nome);
  END IF;
  IF v.status = 'cancelled' THEN RETURN jsonb_build_object('estado', 'cancelada'); END IF;
  IF v.proposta_validade IS NULL OR v.proposta_validade < current_date THEN
    RETURN jsonb_build_object('estado', 'vencida', 'validade', v.proposta_validade);
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'descricao', COALESCE(p.name, i.description),
           'quantidade', i.quantity,
           'valor_unitario', i.unit_price,
           'total', i.total
         ) ORDER BY i.id), '[]'::jsonb)
    INTO v_itens
    FROM public.sales_order_items i
    LEFT JOIN public.products p ON p.id = i.product_id
   WHERE i.order_id = v.id;

  RETURN jsonb_build_object(
    'estado', 'aberta',
    'numero', v.order_number,
    'empresa', v.empresa_nome,
    'cliente', v.cliente_nome,
    'emissao', v.issue_date,
    'validade', v.proposta_validade,
    'subtotal', v.subtotal,
    'desconto', v.discount_value,
    'frete', v.shipping,
    'total', v.total,
    'observacoes', v.notes,
    'itens', v_itens
  );
END;
$$;

/**
 * Aceite do cliente.
 *
 * Grava quem, quando e de onde, e move a proposta para pedido confirmado na
 * mesma transação. O token é queimado no aceite: link de proposta aceita não
 * pode continuar aceitando.
 */
CREATE OR REPLACE FUNCTION public.aceitar_proposta(p_token text, p_nome text, p_ip text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v record;
BEGIN
  IF coalesce(trim(p_nome), '') = '' THEN
    RAISE EXCEPTION 'Informe seu nome para aceitar.' USING ERRCODE = '23514';
  END IF;

  SELECT * INTO v FROM public.sales_orders WHERE proposta_token = p_token FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Proposta não encontrada.' USING ERRCODE = '23503'; END IF;
  IF v.aceite_em IS NOT NULL THEN
    RAISE EXCEPTION 'Esta proposta já foi aceita.' USING ERRCODE = '23505'; END IF;
  IF v.status = 'cancelled' THEN
    RAISE EXCEPTION 'Esta proposta foi cancelada.' USING ERRCODE = '23514'; END IF;
  IF v.proposta_validade IS NULL OR v.proposta_validade < current_date THEN
    RAISE EXCEPTION 'Esta proposta venceu em %.', to_char(v.proposta_validade, 'DD/MM/YYYY')
      USING ERRCODE = '23514'; END IF;

  UPDATE public.sales_orders
     SET aceite_em = now(),
         aceite_nome = trim(p_nome),
         aceite_ip = p_ip,
         status = 'confirmed',
         -- Token queimado: o link não aceita duas vezes.
         proposta_token = NULL,
         updated_at = now()
   WHERE id = v.id;

  RETURN jsonb_build_object('aceita', true, 'numero', v.order_number, 'total', v.total);
END;
$$;

-- As duas funções de fora rodam com o token como credencial, e por isso são as
-- ÚNICAS coisas que o anon pode executar. A tabela `sales_orders` continua
-- inteiramente fechada para ele.
REVOKE ALL ON FUNCTION public.ver_proposta(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.aceitar_proposta(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ver_proposta(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.aceitar_proposta(text, text, text) TO anon, authenticated;

COMMENT ON FUNCTION public.ver_proposta(text) IS
  'Leitura pública da proposta pelo token. Devolve só o que o comprador precisa ver.';
COMMENT ON FUNCTION public.aceitar_proposta(text, text, text) IS
  'Aceite do cliente: registra quem/quando/de onde, confirma o pedido e queima o token.';
