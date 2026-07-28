-- Reajuste de contrato.
--
-- O conselho: `contracts.amount` é fixo, sem índice, sem data de aniversário e
-- sem carta. Contrato de recorrência sem reajuste perde margem sozinho todo
-- ano, e o cliente que mais custa a atender é justamente o mais antigo.
--
-- Decisão sobre índice: o sistema NÃO inventa IPCA nem IGPM. Guardar um número
-- de índice que ninguém buscou na fonte é o mesmo erro do cClassTrib escrito à
-- mão. Então:
--
--   - percentual combinado em contrato  -> aplica sozinho no aniversário;
--   - índice (IPCA, IGPM)               -> no aniversário o sistema AVISA e
--                                          pede o percentual do período, que é
--                                          exatamente o que o contador informa.
--
-- Em nenhum dos dois casos o valor muda calado: toda alteração vira linha em
-- `contract_adjustments`, que é o histórico que sustenta a carta ao cliente.

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS indice_reajuste text
    CHECK (indice_reajuste IS NULL OR indice_reajuste IN ('nenhum', 'fixo', 'ipca', 'igpm', 'inpc')),
  ADD COLUMN IF NOT EXISTS percentual_reajuste numeric(6,3),
  ADD COLUMN IF NOT EXISTS proximo_reajuste date,
  ADD COLUMN IF NOT EXISTS ultimo_reajuste_em date;

COMMENT ON COLUMN public.contracts.indice_reajuste IS
  'nenhum | fixo (usa percentual_reajuste) | ipca | igpm | inpc (pede o percentual no aniversário)';

CREATE TABLE IF NOT EXISTS public.contract_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  valor_anterior numeric(14,2) NOT NULL,
  valor_novo numeric(14,2) NOT NULL,
  percentual numeric(6,3) NOT NULL,
  indice text,
  vigencia date NOT NULL,
  aplicado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.contract_adjustments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members view adjustments" ON public.contract_adjustments;
CREATE POLICY "Members view adjustments" ON public.contract_adjustments
  FOR SELECT TO authenticated USING (public.is_company_member(company_id));

REVOKE ALL ON public.contract_adjustments FROM anon;
GRANT SELECT ON public.contract_adjustments TO authenticated;

CREATE INDEX IF NOT EXISTS contract_adjustments_contract_idx
  ON public.contract_adjustments (contract_id, vigencia DESC);

CREATE INDEX IF NOT EXISTS contracts_proximo_reajuste_idx
  ON public.contracts (company_id, proximo_reajuste)
  WHERE proximo_reajuste IS NOT NULL AND status = 'active';

/**
 * Aplica o reajuste, registra no histórico e agenda o próximo aniversário.
 *
 * Uma transação só: valor novo sem linha de histórico é aumento sem
 * justificativa, e é a primeira coisa que o cliente questiona.
 */
CREATE OR REPLACE FUNCTION public.reajustar_contrato(
  p_contract_id uuid,
  p_percentual numeric,
  p_vigencia date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_c record;
  v_novo numeric;
  v_vigencia date;
BEGIN
  SELECT * INTO v_c FROM public.contracts WHERE id = p_contract_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contrato não encontrado.' USING ERRCODE = '23503';
  END IF;

  IF NOT public.is_company_member(v_c.company_id) THEN
    RAISE EXCEPTION 'Sem acesso a esta empresa.' USING ERRCODE = '42501';
  END IF;

  -- Faixa fechada de propósito. Reajuste de 900% é dedo errado, não negócio, e
  -- percentual negativo grande zera a mensalidade sem ninguém perceber.
  IF p_percentual IS NULL OR p_percentual <= -100 OR p_percentual > 100 THEN
    RAISE EXCEPTION 'Percentual de reajuste fora da faixa aceitável.' USING ERRCODE = '23514';
  END IF;

  v_vigencia := COALESCE(p_vigencia, v_c.proximo_reajuste, current_date);
  v_novo := round(v_c.amount * (1 + p_percentual / 100), 2);

  IF v_novo <= 0 THEN
    RAISE EXCEPTION 'Reajuste zeraria o contrato.' USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.contract_adjustments
    (company_id, contract_id, valor_anterior, valor_novo, percentual, indice, vigencia, aplicado_por)
  VALUES (v_c.company_id, p_contract_id, v_c.amount, v_novo, p_percentual,
          v_c.indice_reajuste, v_vigencia, auth.uid());

  UPDATE public.contracts
     SET amount = v_novo,
         ultimo_reajuste_em = v_vigencia,
         -- Próximo aniversário é sempre um ano à frente do que acabou de valer,
         -- e não de hoje: reajuste aplicado com atraso não pode empurrar o
         -- aniversário para frente e presentear o cliente com meses de graça.
         proximo_reajuste = v_vigencia + interval '1 year',
         updated_at = now()
   WHERE id = p_contract_id;

  RETURN jsonb_build_object(
    'valor_anterior', v_c.amount,
    'valor_novo', v_novo,
    'percentual', p_percentual,
    'vigencia', v_vigencia,
    'proximo_reajuste', v_vigencia + interval '1 year'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reajustar_contrato(uuid, numeric, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reajustar_contrato(uuid, numeric, date) TO authenticated;

COMMENT ON FUNCTION public.reajustar_contrato(uuid, numeric, date) IS
  'Aplica reajuste, grava o histórico e agenda o próximo aniversário. Uma transação só.';

-- Contratos cujo aniversário chegou. É o que a tela mostra e o que o agente lê.
CREATE OR REPLACE VIEW public.v_contratos_a_reajustar
WITH (security_invoker = on) AS
 SELECT
    c.id,
    c.company_id,
    c.description,
    c.contact_id,
    ct.name AS contato_nome,
    c.amount AS valor_atual,
    c.indice_reajuste,
    c.percentual_reajuste,
    c.proximo_reajuste,
    c.ultimo_reajuste_em,
    (c.proximo_reajuste - current_date) AS dias_para_aniversario,
    -- Com percentual combinado dá para aplicar direto; com índice, alguém
    -- precisa informar quanto o índice acumulou no período.
    (c.indice_reajuste = 'fixo' AND c.percentual_reajuste IS NOT NULL) AS aplica_sozinho
   FROM public.contracts c
   LEFT JOIN public.contacts ct ON ct.id = c.contact_id
  WHERE c.status = 'active'
    AND c.proximo_reajuste IS NOT NULL
    AND COALESCE(c.indice_reajuste, 'nenhum') <> 'nenhum'
    AND c.proximo_reajuste <= current_date + 30;

REVOKE ALL ON public.v_contratos_a_reajustar FROM anon;
GRANT SELECT ON public.v_contratos_a_reajustar TO authenticated;

COMMENT ON VIEW public.v_contratos_a_reajustar IS
  'Contratos ativos com aniversário de reajuste nos próximos 30 dias ou vencido.';
