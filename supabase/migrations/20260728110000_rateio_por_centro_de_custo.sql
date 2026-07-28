-- Rateio por centro de custo.
--
-- O conselho: "`cost_centers` é lista, não hierarquia, e a relação com o
-- lançamento é um para um. 'Aluguel de dez mil, 40% comercial e 60%
-- operacional' é impossível, e numa PME de serviços isso é a controladoria
-- inteira."
--
-- `transactions.cost_center_id` continua existindo e continua valendo: ele é o
-- caso de um centro só, que é a maioria. O rateio entra como tabela filha, e a
-- regra é simples: SE existe rateio, ele manda; senão, vale o centro único.
-- Assim nada quebra e ninguém precisa migrar dado.

CREATE TABLE IF NOT EXISTS public.transaction_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  transaction_id uuid NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  cost_center_id uuid NOT NULL REFERENCES public.cost_centers(id) ON DELETE RESTRICT,
  -- Guarda-se o PERCENTUAL e o VALOR. O percentual é o que o usuário pensa; o
  -- valor é o que precisa fechar com o lançamento até o centavo. Recalcular o
  -- valor a cada consulta traria diferença de arredondamento para dentro do
  -- relatório, que é onde ela dói mais.
  percentual numeric(7,4) NOT NULL CHECK (percentual > 0 AND percentual <= 100),
  valor numeric(14,2) NOT NULL CHECK (valor > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (transaction_id, cost_center_id)
);

ALTER TABLE public.transaction_allocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members manage allocations" ON public.transaction_allocations;
CREATE POLICY "Members manage allocations" ON public.transaction_allocations
  FOR ALL TO authenticated
  USING (public.is_company_member(company_id))
  WITH CHECK (public.is_company_member(company_id));

REVOKE ALL ON public.transaction_allocations FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transaction_allocations TO authenticated;

CREATE INDEX IF NOT EXISTS transaction_allocations_tx_idx
  ON public.transaction_allocations (transaction_id);
CREATE INDEX IF NOT EXISTS transaction_allocations_cc_idx
  ON public.transaction_allocations (company_id, cost_center_id);

/**
 * Grava o rateio de um lançamento, substituindo o anterior.
 *
 * Existe como função, e não como insert solto da tela, porque rateio parcial é
 * pior que rateio nenhum: metade das linhas gravadas significa despesa
 * desaparecendo do relatório por centro de custo sem ninguém notar. Aqui é tudo
 * ou nada, e a soma é conferida contra o valor do lançamento antes de gravar.
 *
 * p_rateio: [{"cost_center_id": "...", "percentual": 40}, ...]
 */
CREATE OR REPLACE FUNCTION public.ratear_lancamento(p_transaction_id uuid, p_rateio jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tx record;
  v_soma_pct numeric := 0;
  v_item jsonb;
  v_pct numeric;
  v_cc uuid;
  v_valor numeric;
  v_acumulado numeric := 0;
  v_n integer := 0;
  v_total integer;
BEGIN
  SELECT * INTO v_tx FROM public.transactions WHERE id = p_transaction_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lançamento não encontrado.' USING ERRCODE = '23503';
  END IF;

  IF NOT public.is_company_member(v_tx.company_id) THEN
    RAISE EXCEPTION 'Sem acesso a esta empresa.' USING ERRCODE = '42501';
  END IF;

  -- Rateio vazio significa desfazer: volta a valer o centro de custo único.
  IF p_rateio IS NULL OR jsonb_array_length(p_rateio) = 0 THEN
    DELETE FROM public.transaction_allocations WHERE transaction_id = p_transaction_id;
    RETURN jsonb_build_object('linhas', 0, 'desfeito', true);
  END IF;

  v_total := jsonb_array_length(p_rateio);

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_rateio) LOOP
    v_pct := (v_item ->> 'percentual')::numeric;
    IF v_pct IS NULL OR v_pct <= 0 THEN
      RAISE EXCEPTION 'Percentual precisa ser maior que zero.' USING ERRCODE = '23514';
    END IF;
    v_soma_pct := v_soma_pct + v_pct;
  END LOOP;

  -- Tolerância de um centésimo para 33,33 + 33,33 + 33,34 e afins.
  IF abs(v_soma_pct - 100) > 0.01 THEN
    RAISE EXCEPTION 'O rateio soma %%, e precisa somar 100%%.', round(v_soma_pct, 2)
      USING ERRCODE = '23514';
  END IF;

  DELETE FROM public.transaction_allocations WHERE transaction_id = p_transaction_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_rateio) LOOP
    v_n := v_n + 1;
    v_cc := (v_item ->> 'cost_center_id')::uuid;
    v_pct := (v_item ->> 'percentual')::numeric;

    -- A última linha recebe a diferença, para a soma dos valores fechar EXATO
    -- com o lançamento. Sem isto, 10.000 em três partes perde um centavo e o
    -- relatório por centro de custo não bate com o DRE.
    IF v_n = v_total THEN
      v_valor := round(v_tx.amount - v_acumulado, 2);
    ELSE
      v_valor := round(v_tx.amount * v_pct / 100, 2);
      v_acumulado := v_acumulado + v_valor;
    END IF;

    IF v_valor <= 0 THEN
      RAISE EXCEPTION 'Rateio gerou parcela de valor zero ou negativo.' USING ERRCODE = '23514';
    END IF;

    INSERT INTO public.transaction_allocations
      (company_id, transaction_id, cost_center_id, percentual, valor)
    VALUES (v_tx.company_id, p_transaction_id, v_cc, v_pct, v_valor);
  END LOOP;

  RETURN jsonb_build_object('linhas', v_total, 'total', v_tx.amount);
END;
$$;

REVOKE ALL ON FUNCTION public.ratear_lancamento(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ratear_lancamento(uuid, jsonb) TO authenticated;

COMMENT ON FUNCTION public.ratear_lancamento(uuid, jsonb) IS
  'Substitui o rateio de um lançamento. Tudo ou nada, com a soma conferida contra o valor. Rateio vazio desfaz.';

-- A view de centro de custo passa a enxergar o rateio.
--
-- Antes ela agrupava por `transactions.cost_center_id`, então um aluguel
-- rateado entre comercial e operacional apareceria inteiro num centro só. Agora
-- o rateio manda quando existe, e o centro único vale quando não existe.
CREATE OR REPLACE VIEW public.v_centro_custo_mes
WITH (security_invoker = on) AS
 WITH base AS (
   SELECT
     t.id,
     t.company_id,
     t.date,
     t.type,
     COALESCE(a.cost_center_id, t.cost_center_id) AS cost_center_id,
     COALESCE(a.valor, t.amount) AS valor
   FROM public.transactions t
   LEFT JOIN public.transaction_allocations a ON a.transaction_id = t.id
   WHERE t.status = ANY (ARRAY['confirmed'::text, 'reconciled'::text])
 )
 SELECT
    b.company_id,
    date_trunc('month'::text, b.date::timestamp with time zone)::date AS mes,
    b.cost_center_id,
    COALESCE(cc.name, 'Sem centro de custo'::text) AS centro_nome,
    b.type,
    sum(b.valor) AS total,
    -- Conta POR CENTRO: um aluguel rateado em três aparece como um lançamento
    -- em cada um dos três, que é como o gestor daquele centro enxerga. Somar a
    -- contagem entre centros não faz sentido e ninguém faz.
    count(*) AS lancamentos
   FROM base b
   LEFT JOIN public.cost_centers cc ON cc.id = b.cost_center_id
  GROUP BY b.company_id,
           (date_trunc('month'::text, b.date::timestamp with time zone)),
           b.cost_center_id, cc.name, b.type;

REVOKE ALL ON public.v_centro_custo_mes FROM anon;
GRANT SELECT ON public.v_centro_custo_mes TO authenticated;

-- Achado durante a verificação: a trava do fechamento impedia até APAGAR a
-- empresa, porque o CASCADE de `companies` chega em `transactions` e o gatilho
-- recusa excluir lançamento de mês fechado. Ou seja, cliente que fechasse um
-- mês nunca mais poderia ser removido.
--
-- O fechamento existe para proteger o resultado publicado, não para impedir o
-- offboarding. Durante o CASCADE a linha da empresa já não existe, e é isso que
-- distingue "apagar o cliente inteiro" de "mexer num período fechado".
CREATE OR REPLACE FUNCTION public.mes_esta_fechado(p_company_id uuid, p_data date)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.companies c WHERE c.id = p_company_id)
     AND EXISTS (
    SELECT 1 FROM public.monthly_close mc
     WHERE mc.company_id = p_company_id
       AND mc.status = 'closed'
       AND mc.month = date_trunc('month', p_data)::date
  );
$$;
